// server.mjs
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import fs from 'fs';
import axios from 'axios';
import qs from 'qs';

const { Pool } = pkg;
const {
  DATABASE_URL,
  PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT = 5432,
  PORT = 3000,
  JWT_SECRET,
  // SendGrid
  SENDGRID_API_KEY,
  EMAIL_FROM,
  CLIENT_URL,
  // Twilio
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_FROM,
  // OAuth providers
  GOOGLE_CLIENT_ID,
  FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET
} = process.env;

// Validate critical env vars
if(!JWT_SECRET){console.error('Missing JWT_SECRET environment variable');process.exit(1);} 

// Initialize PostgreSQL pool
const pool=new Pool(DATABASE_URL?{connectionString:DATABASE_URL,ssl:{rejectUnauthorized:false}}:{host:PGHOST,database:PGDATABASE,user:PGUSER,password:PGPASSWORD,port:Number(PGPORT),ssl:false});

// Helper: query wrapper
async function query(text,params){
  const client=await pool.connect();
  try{
    return await client.query(text,params);
  }finally{
    client.release();
  }
}

// JWT utilities
function generateToken(user){
  return jwt.sign({uid:user.uid,role:user.role},JWT_SECRET,{expiresIn:'7d'});
}
function authenticate(req,res,next){
  const auth=req.headers.authorization;
  if(!auth)return res.status(401).json({message:'Unauthorized'});
  const token=auth.split(' ')[1];
  try{
    const payload=jwt.verify(token,JWT_SECRET);
    req.user=payload;
    next();
  }catch(err){
    return res.status(401).json({message:'Invalid token'});
  }
}
function requireAdmin(req,res,next){
  if(req.user.role!=='admin')return res.status(403).json({message:'Forbidden'});
  next();
}

// ESM workaround for __dirname
const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);

// Create storage folder if needed
const storageDir=path.join(__dirname,'storage');
if(!fs.existsSync(storageDir))fs.mkdirSync(storageDir);

// Multer setup for uploads ≤5MB
const upload=multer({storage:multer.diskStorage({destination:(req,file,cb)=>cb(null,storageDir),filename:(req,file,cb)=>cb(null,uuidv4()+path.extname(file.originalname)),}),limits:{fileSize:5*1024*1024}});

// ===== External API integrations =====

/**
 * Send verification email via SendGrid
 */
async function sendVerificationEmail(email, token) {
  if (!SENDGRID_API_KEY || !EMAIL_FROM || !CLIENT_URL) {
    throw new Error('Missing SendGrid configuration or CLIENT_URL');
  }
  const verificationUrl = `${CLIENT_URL}/verify?token=${encodeURIComponent(token)}`;
  const mailBody = {
    personalizations: [
      {
        to: [{ email }],
        subject: 'Please verify your email',
      },
    ],
    from: { email: EMAIL_FROM },
    content: [
      {
        type: 'text/html',
        value: `<p>Welcome! Please verify your email by clicking <a href="${verificationUrl}">this link</a>.</p>`,
      },
    ],
  };
  try {
    const res = await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      mailBody,
      {
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (res.status !== 202) {
      console.error('SendGrid error response:', res.data);
      throw new Error(`Unexpected SendGrid status: ${res.status}`);
    }
    return { success: true };
  } catch (err) {
    console.error('Failed to send verification email:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Send OTP SMS via Twilio
 */
async function sendSMS(phone, token) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_FROM) {
    throw new Error('Missing Twilio configuration env vars');
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const data = qs.stringify({
    To: phone,
    From: TWILIO_PHONE_FROM,
    Body: `Your verification code is ${token}`,
  });
  try {
    const res = await axios.post(url, data, {
      auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (res.status !== 201) {
      console.error('Twilio error response:', res.data);
      throw new Error(`Unexpected Twilio status: ${res.status}`);
    }
    return { success: true, sid: res.data.sid };
  } catch (err) {
    console.error('Failed to send SMS:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Validate OAuth token and fetch user profile
 */
async function validateOAuth(provider, accessToken) {
  if (!provider || !accessToken) throw new Error('Missing provider or access token');
  try {
    switch (provider) {
      case 'google': {
        await axios.get('https://oauth2.googleapis.com/tokeninfo', {
          params: { access_token: accessToken, audience: GOOGLE_CLIENT_ID },
        });
        const userinfo = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { params: { access_token: accessToken } }
        );
        return {
          oauth_id: userinfo.data.sub,
          email: userinfo.data.email,
          display_name: userinfo.data.name,
          picture: userinfo.data.picture,
        };
      }
      case 'facebook': {
        const appToken = `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`;
        await axios.get('https://graph.facebook.com/debug_token', {
          params: { input_token: accessToken, access_token: appToken },
        });
        const resp = await axios.get('https://graph.facebook.com/me', {
          params: {
            fields: 'id,name,email,picture.width(200).height(200)',
            access_token: accessToken,
          },
        });
        return {
          oauth_id: resp.data.id,
          email: resp.data.email,
          display_name: resp.data.name,
          picture: resp.data.picture.data.url,
        };
      }
      case 'github': {
        const userResp = await axios.get('https://api.github.com/user', {
          headers: { Authorization: `token ${accessToken}` },
        });
        const emailsResp = await axios.get('https://api.github.com/user/emails', {
          headers: { Authorization: `token ${accessToken}` },
        });
        const primary =
          emailsResp.data.find(e => e.primary && e.verified) || emailsResp.data[0];
        return {
          oauth_id: String(userResp.data.id),
          email: primary.email,
          display_name: userResp.data.name || userResp.data.login,
          picture: userResp.data.avatar_url,
        };
      }
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
  } catch (err) {
    console.error('OAuth validation error:', err.response?.data || err.message);
    throw new Error('Invalid OAuth token');
  }
}

// App init
const app=express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Serve storage and public
app.use('/storage',express.static(storageDir));app.use(express.static(path.join(__dirname,'public')));

// -------- AUTH ROUTES --------
const auth=express.Router();

// ... (rest of the existing routes remain unchanged, including
// signup/email, verify-email, signup/sms, signup/social, login,
// logout, forgot-password, reset-password, resend-verification)

app.use('/api/auth',auth);

// -------- USER ROUTES --------
const users=express.Router();
// ... (existing user routes: /me, /me password, profile-pic, public profile, settings, block/unblock)
app.use('/api/users',users);

// -------- CATEGORIES ROUTES --------
const categories=express.Router();
// ... (existing category routes)
app.use('/api/categories',categories);

// -------- LISTINGS ROUTES --------
const listings=express.Router();
// ... (existing listing CRUD, images, renew, mark-sold)
app.use('/api/listings',listings);

// -------- FAVORITES --------
const favs=express.Router();
// ... (existing favorites routes)
app.use('/api/favorites',favs);

// -------- OFFERS & TRANSACTIONS --------
const offers=express.Router();
// ... (existing offers routes)
app.use('/api/offers',offers);

// -------- CONVERSATIONS & MESSAGES --------
const conv=express.Router();
// ... (existing conversation routes)
app.use('/api/conversations',conv);

// -------- NOTIFICATIONS --------
const notifs=express.Router();
// ... (existing notifications routes)
app.use('/api/notifications',notifs);

// -------- REPORTS & MODERATION --------
const reports=express.Router();
// ... (existing reports routes)
app.use('/api/reports',reports);

// -------- ADMIN DASHBOARD --------
const admin=express.Router();
// ... (existing admin routes for users, listings, categories, settings)
app.use('/api/admin',admin);

// Serve static and catch-all for SPA
app.get('*',(req,res)=>{res.sendFile(path.join(__dirname,'public','index.html'));});

// Global error handler
app.use((err,req,res,next)=>{
  console.error(err);
  res.status(500).json({message:'Internal server error'});
});

// Start server
app.listen(PORT,()=>{console.log(`Server listening on port ${PORT}`);});