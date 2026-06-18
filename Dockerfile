# Multi-stage build
FROM node:20-alpine AS builder

# Install build tools for native modules (better-sqlite3, pdf-parse)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/

# Install all dependencies (including devDependencies for build)
RUN npm ci
RUN cd client && npm ci
RUN cd server && npm ci

# Copy source code
COPY client/ ./client/
COPY server/ ./server/

# Build client (Vite)
RUN cd client && npm run build

# Build server (TypeScript → JavaScript)
RUN cd server && npm run build

# --- Production stage ---
FROM node:20-alpine

# better-sqlite3 needs these at runtime too
RUN apk add --no-cache libstdc++

WORKDIR /app

# Copy server package files and install production deps only
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Copy built server code
COPY --from=builder /app/server/dist ./server/dist

# Copy built client code (served as static files by Express)
COPY --from=builder /app/client/dist ./client/dist

# Create data directory for SQLite database
RUN mkdir -p /app/server/data

WORKDIR /app/server

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/index.js"]
