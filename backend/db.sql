-- =========================================
-- Drop existing tables (in reverse dependency order)
-- =========================================
DROP TABLE IF EXISTS user_blocks;
DROP TABLE IF EXISTS moderation_logs;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS offers;
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS listing_images;
DROP TABLE IF EXISTS listings;
DROP TABLE IF EXISTS auth_tokens;
DROP TABLE IF EXISTS site_settings;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- =========================================
-- 1. users
-- =========================================
CREATE TABLE users (
  uid TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT,
  display_name TEXT NOT NULL,
  bio TEXT,
  profile_pic_url TEXT,
  location TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  role TEXT NOT NULL DEFAULT 'buyer',
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  oauth_provider TEXT,
  oauth_id TEXT,
  notification_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT chk_users_role CHECK (role IN ('buyer','seller','admin'))
);

-- =========================================
-- 2. categories (self-referential)
-- =========================================
CREATE TABLE categories (
  uid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_uid TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_uid)
    REFERENCES categories(uid) ON DELETE SET NULL
);

-- =========================================
-- 3. site_settings
-- =========================================
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- =========================================
-- 4. auth_tokens
-- =========================================
CREATE TABLE auth_tokens (
  uid TEXT PRIMARY KEY,
  user_uid TEXT,
  phone TEXT,
  token TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_uid)
    REFERENCES users(uid) ON DELETE SET NULL,
  CONSTRAINT chk_auth_tokens_type CHECK (
    type IN ('email_verification','password_reset','phone_otp')
  )
);

-- =========================================
-- 5. listings
-- =========================================
CREATE TABLE listings (
  uid TEXT PRIMARY KEY,
  user_uid TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category_uid TEXT NOT NULL,
  condition TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL,
  negotiable BOOLEAN NOT NULL DEFAULT FALSE,
  location TEXT NOT NULL,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  listing_duration INTEGER NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  views_count INTEGER NOT NULL DEFAULT 0,
  favorites_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT fk_listings_user FOREIGN KEY (user_uid)
    REFERENCES users(uid) ON DELETE CASCADE,
  CONSTRAINT fk_listings_category FOREIGN KEY (category_uid)
    REFERENCES categories(uid),
  CONSTRAINT chk_listings_condition CHECK (
    condition IN ('new','like_new','good','acceptable')
  ),
  CONSTRAINT chk_listings_status CHECK (
    status IN ('draft','pending','active','sold','expired','archived')
  )
);

-- =========================================
-- 6. listing_images
-- =========================================
CREATE TABLE listing_images (
  uid TEXT PRIMARY KEY,
  listing_uid TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT fk_listing_images_listing FOREIGN KEY (listing_uid)
    REFERENCES listings(uid) ON DELETE CASCADE
);

-- =========================================
-- 7. favorites
-- =========================================
CREATE TABLE favorites (
  uid TEXT PRIMARY KEY,
  user_uid TEXT NOT NULL,
  listing_uid TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_uid)
    REFERENCES users(uid) ON DELETE CASCADE,
  CONSTRAINT fk_favorites_listing FOREIGN KEY (listing_uid)
    REFERENCES listings(uid) ON DELETE CASCADE
);

-- =========================================
-- 8. offers
-- =========================================
CREATE TABLE offers (
  uid TEXT PRIMARY KEY,
  listing_uid TEXT NOT NULL,
  buyer_uid TEXT NOT NULL,
  seller_uid TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  message TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  counter_offer_uid TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT fk_offers_listing FOREIGN KEY (listing_uid)
    REFERENCES listings(uid) ON DELETE CASCADE,
  CONSTRAINT fk_offers_buyer FOREIGN KEY (buyer_uid)
    REFERENCES users(uid) ON DELETE CASCADE,
  CONSTRAINT fk_offers_seller FOREIGN KEY (seller_uid)
    REFERENCES users(uid) ON DELETE CASCADE,
  CONSTRAINT fk_offers_counter_offer FOREIGN KEY (counter_offer_uid)
    REFERENCES offers(uid) ON DELETE SET NULL,
  CONSTRAINT chk_offers_type CHECK (
    type IN ('offer','buy_now')
  ),
  CONSTRAINT chk_offers_status CHECK (
    status IN ('pending','accepted','declined','countered','sold')
  )
);

-- =========================================
-- 9. conversations
-- =========================================
CREATE TABLE conversations (
  uid TEXT PRIMARY KEY,
  listing_uid TEXT NOT NULL,
  buyer_uid TEXT NOT NULL,
  seller_uid TEXT NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT fk_conversations_listing FOREIGN KEY (listing_uid)
    REFERENCES listings(uid) ON DELETE CASCADE,
  CONSTRAINT fk_conversations_buyer FOREIGN KEY (buyer_uid)
    REFERENCES users(uid) ON DELETE CASCADE,
  CONSTRAINT fk_conversations_seller FOREIGN KEY (seller_uid)
    REFERENCES users(uid) ON DELETE CASCADE,
  CONSTRAINT uq_conversations_listing_buyer UNIQUE (listing_uid, buyer_uid)
);

-- =========================================
-- 10. messages
-- =========================================
CREATE TABLE messages (
  uid TEXT PRIMARY KEY,
  conversation_uid TEXT NOT NULL,
  sender_uid TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_uid)
    REFERENCES conversations(uid) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_uid)
    REFERENCES users(uid) ON DELETE CASCADE
);

-- =========================================
-- 11. notifications
-- =========================================
CREATE TABLE notifications (
  uid TEXT PRIMARY KEY,
  user_uid TEXT NOT NULL,
  type TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_uid)
    REFERENCES users(uid) ON DELETE CASCADE,
  CONSTRAINT chk_notifications_type CHECK (
    type IN ('new_message','new_offer','offer_update','listing_favorited')
  )
);

-- =========================================
-- 12. reports
-- =========================================
CREATE TABLE reports (
  uid TEXT PRIMARY KEY,
  reporter_uid TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_uid TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by_uid TEXT,
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_uid)
    REFERENCES users(uid) ON DELETE CASCADE,
  CONSTRAINT fk_reports_closed_by FOREIGN KEY (closed_by_uid)
    REFERENCES users(uid) ON DELETE SET NULL,
  CONSTRAINT chk_reports_target_type CHECK (
    target_type IN ('listing','user')
  ),
  CONSTRAINT chk_reports_reason CHECK (
    reason IN ('spam','prohibited','inappropriate','other')
  ),
  CONSTRAINT chk_reports_status CHECK (
    status IN ('open','closed')
  )
);

-- =========================================
-- 13. moderation_logs
-- =========================================
CREATE TABLE moderation_logs (
  uid TEXT PRIMARY KEY,
  admin_uid TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_uid TEXT NOT NULL,
  report_uid TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT fk_mlogs_admin FOREIGN KEY (admin_uid)
    REFERENCES users(uid) ON DELETE CASCADE,
  CONSTRAINT fk_mlogs_report FOREIGN KEY (report_uid)
    REFERENCES reports(uid) ON DELETE SET NULL,
  CONSTRAINT chk_mlogs_action CHECK (
    action IN ('warn','delete_listing','suspend_listing','ban_user','unban_user')
  ),
  CONSTRAINT chk_mlogs_target_type CHECK (
    target_type IN ('listing','user')
  )
);

-- =========================================
-- 14. user_blocks
-- =========================================
CREATE TABLE user_blocks (
  uid TEXT PRIMARY KEY,
  blocker_uid TEXT NOT NULL,
  blocked_uid TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT fk_user_blocks_blocker FOREIGN KEY (blocker_uid)
    REFERENCES users(uid) ON DELETE CASCADE,
  CONSTRAINT fk_user_blocks_blocked FOREIGN KEY (blocked_uid)
    REFERENCES users(uid) ON DELETE CASCADE
);

-- =========================================
-- Indexes for performance
-- =========================================
CREATE INDEX idx_users_email        ON users(email);
CREATE INDEX idx_users_phone        ON users(phone);
CREATE INDEX idx_users_role         ON users(role);

CREATE INDEX idx_categories_parent  ON categories(parent_uid);

CREATE INDEX idx_auth_tokens_user   ON auth_tokens(user_uid);
CREATE INDEX idx_auth_tokens_token  ON auth_tokens(token);

CREATE INDEX idx_listings_user      ON listings(user_uid);
CREATE INDEX idx_listings_category  ON listings(category_uid);
CREATE INDEX idx_listings_status    ON listings(status);
CREATE INDEX idx_listings_price     ON listings(price);
CREATE INDEX idx_listings_expires   ON listings(expires_at);
CREATE INDEX idx_listings_location  ON listings(location_lat, location_lng);

CREATE INDEX idx_listing_images_l   ON listing_images(listing_uid);

CREATE INDEX idx_favorites_user     ON favorites(user_uid);
CREATE INDEX idx_favorites_listing  ON favorites(listing_uid);

CREATE INDEX idx_offers_listing     ON offers(listing_uid);
CREATE INDEX idx_offers_buyer       ON offers(buyer_uid);
CREATE INDEX idx_offers_seller      ON offers(seller_uid);
CREATE INDEX idx_offers_status      ON offers(status);

CREATE INDEX idx_conversations_l_b  ON conversations(listing_uid, buyer_uid);
CREATE INDEX idx_conversations_last ON conversations(last_message_at);

CREATE INDEX idx_messages_conv      ON messages(conversation_uid);
CREATE INDEX idx_messages_read      ON messages(is_read);

CREATE INDEX idx_notifications_user ON notifications(user_uid);
CREATE INDEX idx_notifications_read ON notifications(is_read);

CREATE INDEX idx_reports_reporter   ON reports(reporter_uid);
CREATE INDEX idx_reports_target     ON reports(target_type, target_uid);
CREATE INDEX idx_reports_status     ON reports(status);

CREATE INDEX idx_mlogs_admin        ON moderation_logs(admin_uid);
CREATE INDEX idx_mlogs_target       ON moderation_logs(target_type, target_uid);

CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_uid);
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_uid);


-- =========================================
-- Seed data
-- =========================================

-- 1. users
INSERT INTO users (
  uid, email, phone, password_hash, display_name, bio, profile_pic_url,
  location, location_lat, location_lng, role, is_email_verified, is_phone_verified,
  oauth_provider, oauth_id, notification_settings, last_login_at, created_at, updated_at
) VALUES
('user_1','alice@example.com','1234567890','hash1','Alice','Love buying gadgets',
 'https://picsum.photos/seed/user1/200/200','New York, NY',40.7128,-74.0060,
 'buyer',TRUE,FALSE,NULL,NULL,
 '{"new_message_email": true, "offer_email": true, "favorite_email": false}'::jsonb,
 '2025-06-01T10:00:00Z','2025-01-01T12:00:00Z','2025-05-01T12:00:00Z'),
('user_2','bob@example.com','2345678901','hash2','Bob the Seller','Selling quality used items',
 'https://picsum.photos/seed/user2/200/200','Los Angeles, CA',34.0522,-118.2437,
 'seller',TRUE,TRUE,'google','google-2',
 '{"new_message_email": false, "offer_email": true, "favorite_email": true}'::jsonb,
 '2025-06-02T11:00:00Z','2025-02-01T12:00:00Z','2025-05-02T12:00:00Z'),
('user_3',NULL,'3456789012',NULL,'Charlie Admin','Site administrator',
 'https://picsum.photos/seed/user3/200/200','Chicago, IL',41.8781,-87.6298,
 'admin',FALSE,TRUE,'facebook','fb-3',
 '{"new_message_email": true, "offer_email": false, "favorite_email": false}'::jsonb,
 '2025-06-03T09:00:00Z','2025-03-01T12:00:00Z','2025-05-03T12:00:00Z'),
('user_4','dave@example.com',NULL,'hash4','Dave',NULL,
 NULL,'Seattle, WA',47.6062,-122.3321,
 'buyer',TRUE,FALSE,NULL,NULL,
 '{}'::jsonb,
 NULL,'2025-04-01T12:00:00Z','2025-05-04T12:00:00Z'
);

-- 2. categories
INSERT INTO categories (uid, name, parent_uid, created_at, updated_at) VALUES
('cat_1','Electronics',NULL,'2025-01-01T00:00:00Z','2025-01-01T00:00:00Z'),
('cat_2','Phones','cat_1','2025-01-02T00:00:00Z','2025-01-02T00:00:00Z'),
('cat_3','Clothing',NULL,'2025-01-03T00:00:00Z','2025-01-03T00:00:00Z');

-- 3. site_settings
INSERT INTO site_settings (key, value, updated_at) VALUES
('maintenance_mode','{"enabled": false}'::jsonb,'2025-06-01T00:00:00Z'),
('max_listing_duration','{"days": 30}'::jsonb,'2025-06-01T00:00:00Z');

-- 4. auth_tokens
INSERT INTO auth_tokens (
  uid, user_uid, phone, token, type, data, created_at, expires_at, used_at
) VALUES
('auth_1','user_1',NULL,'token123','email_verification',NULL,
 '2025-05-01T09:00:00Z','2025-05-02T09:00:00Z',NULL),
('auth_2',NULL,'5550001111','otp456','phone_otp','{"attempts": 0}'::jsonb,
 '2025-05-05T12:00:00Z','2025-05-05T12:05:00Z','2025-05-05T12:03:00Z');

-- 5. listings
INSERT INTO listings (
  uid, user_uid, title, description, category_uid, condition, price, currency,
  negotiable, location, location_lat, location_lng, status, listing_duration,
  tags, views_count, favorites_count, created_at, updated_at, expires_at
) VALUES
('list_1','user_2','iPhone 12','Slightly used iPhone 12 in great condition',
 'cat_2','like_new',699.00,'USD',TRUE,'Los Angeles, CA',34.0522,-118.2437,
 'active',30,'["phone","apple","iphone"]'::jsonb,150,5,
 '2025-05-01T08:00:00Z','2025-05-02T09:00:00Z','2025-06-01T08:00:00Z'),
('list_2','user_2','Samsung Galaxy S20','Gently used Galaxy S20',
 'cat_2','good',499.00,'USD',FALSE,'Los Angeles, CA',34.0522,-118.2437,
 'pending',15,'["samsung","galaxy"]'::jsonb,20,2,
 '2025-05-10T10:00:00Z','2025-05-11T11:00:00Z','2025-05-25T10:00:00Z');

-- 6. listing_images
INSERT INTO listing_images (uid, listing_uid, url, sort_order, created_at) VALUES
('img_1','list_1','https://picsum.photos/seed/img1/600/400',1,'2025-05-01T08:10:00Z'),
('img_2','list_1','https://picsum.photos/seed/img2/600/400',2,'2025-05-01T08:15:00Z'),
('img_3','list_2','https://picsum.photos/seed/img3/600/400',1,'2025-05-10T10:10:00Z'),
('img_4','list_2','https://picsum.photos/seed/img4/600/400',2,'2025-05-10T10:15:00Z');

-- 7. favorites
INSERT INTO favorites (uid, user_uid, listing_uid, created_at) VALUES
('fav_1','user_1','list_1','2025-05-02T14:00:00Z'),
('fav_2','user_4','list_1','2025-05-03T15:00:00Z');

-- 8. offers
INSERT INTO offers (
  uid, listing_uid, buyer_uid, seller_uid, amount, message, type, status,
  counter_offer_uid, created_at, updated_at
) VALUES
('off_1','list_1','user_1','user_2',650.00,'Is the price negotiable?','offer','pending',
 NULL,'2025-05-03T09:00:00Z','2025-05-03T09:00:00Z'),
('off_2','list_1','user_1','user_2',680.00,NULL,'offer','countered',
 'off_1','2025-05-04T10:00:00Z','2025-05-04T10:00:00Z'),
('off_3','list_1','user_4','user_2',699.00,NULL,'buy_now','sold',
 NULL,'2025-05-05T11:00:00Z','2025-05-06T12:00:00Z');

-- 9. conversations
INSERT INTO conversations (
  uid, listing_uid, buyer_uid, seller_uid, last_message_at, created_at, updated_at
) VALUES
('conv_1','list_1','user_1','user_2','2025-05-03T09:00:00Z',
 '2025-05-01T09:00:00Z','2025-05-03T09:00:00Z'),
('conv_2','list_2','user_4','user_2','2025-05-11T11:00:00Z',
 '2025-05-10T10:00:00Z','2025-05-11T11:00:00Z');

-- 10. messages
INSERT INTO messages (uid, conversation_uid, sender_uid, content, is_read, created_at) VALUES
('msg_1','conv_1','user_1','Is this still available?',FALSE,'2025-05-01T10:00:00Z'),
('msg_2','conv_1','user_2','Yes, still available.',FALSE,'2025-05-01T10:05:00Z'),
('msg_3','conv_1','user_1','Great, would you accept $650?',FALSE,'2025-05-03T09:00:00Z'),
('msg_4','conv_2','user_4','Is the price negotiable?',FALSE,'2025-05-10T10:30:00Z'),
('msg_5','conv_2','user_2','No, price is firm.',FALSE,'2025-05-11T11:00:00Z');

-- 11. notifications
INSERT INTO notifications (uid, user_uid, type, metadata, is_read, created_at) VALUES
('notif_1','user_2','new_message',
 '{"conversation_uid":"conv_1","message_uid":"msg_1"}'::jsonb,
 FALSE,'2025-05-01T10:10:00Z'),
('notif_2','user_2','new_offer',
 '{"offer_uid":"off_1"}'::jsonb,
 FALSE,'2025-05-03T09:05:00Z'),
('notif_3','user_1','offer_update',
 '{"offer_uid":"off_2"}'::jsonb,
 FALSE,'2025-05-04T10:05:00Z');

-- 12. reports
INSERT INTO reports (
  uid, reporter_uid, target_type, target_uid, reason, details,
  status, created_at, closed_at, closed_by_uid
) VALUES
('rep_1','user_4','listing','list_2','inappropriate','Contains offensive language',
 'open','2025-05-15T12:00:00Z',NULL,NULL),
('rep_2','user_1','user','user_4','spam','User sends spam messages',
 'closed','2025-05-10T08:00:00Z','2025-05-12T15:00:00Z','user_3');

-- 13. moderation_logs
INSERT INTO moderation_logs (
  uid, admin_uid, action, target_type, target_uid, report_uid, details, created_at
) VALUES
('log_1','user_3','warn','user','user_4','rep_2',
 '{"message":"User warned for spam"}'::jsonb,'2025-05-12T15:30:00Z'),
('log_2','user_3','delete_listing','listing','list_2','rep_1',
 NULL,'2025-05-17T09:00:00Z');

-- 14. user_blocks
INSERT INTO user_blocks (uid, blocker_uid, blocked_uid, created_at) VALUES
('blk_1','user_1','user_4','2025-06-01T00:00:00Z');