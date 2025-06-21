# Build stage for frontend
FROM node:18 AS frontend-build

WORKDIR /app/vitereact
COPY vitereact/package*.json ./
RUN npm install
COPY vitereact/ ./
RUN npm run build

# Build stage for backend and final image
FROM node:18

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production

COPY backend/ ./

# Copy frontend build from previous stage
COPY --from=frontend-build /app/vitereact/dist /app/backend/public

EXPOSE 3001
CMD ["node", "server.js"]