import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import { getDb, closeDb } from './database';
import stationRoutes from './routes/stations';
import modelRoutes from './routes/models';
import conversationRoutes from './routes/conversations';
import chatRoutes from './routes/chat';
import memoryRoutes from './routes/memories';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import mcpRoutes from './routes/mcp';
import fileRoutes from './routes/files';
import regexRoutes from './routes/regex';
import arenaRoutes from './routes/arena';
import prefsRoutes from './routes/prefs';
import mediaRoutes from './routes/media';
import roomRoutes from './routes/rooms';
import usageRoutes from './routes/usage';
import personaRoutes from './routes/personas';
import backupRoutes from './routes/backup';
import announcementRoutes from './routes/announcement';
import { startHealthCheckJob, stopHealthCheckJob } from './services/healthCheck';
import { startBackupJob, stopBackupJob } from './services/backup';
import { startRetentionJob, stopRetentionJob } from './services/retention';
import { attachRoomHub } from './services/roomHub';
import { assertAuthSecurity, optionalAuth } from './middleware/auth';
import { rateLimit } from './middleware/rateLimit';

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Fail fast on insecure production config (default JWT secret → forgeable tokens).
assertAuthSecurity();

// Middleware
app.use(helmet());
// CORS: open by default for easy local/dev use; set CORS_ORIGIN (comma-separated
// origins) to lock the API down to the team's frontend origin(s) in production.
const corsOrigin = process.env.CORS_ORIGIN?.trim();
app.use(cors({ origin: corsOrigin ? corsOrigin.split(',').map((s) => s.trim()) : '*' }));
app.use(express.json({ limit: '50mb' }));

// Initialize database
getDb();

// Routes
// Per-user (or per-IP) rate limits on the paths that hit paid upstream model APIs.
// Tunable via RATE_LIMIT_CHAT_PER_MIN / RATE_LIMIT_ARENA_PER_MIN; optionalAuth first so
// authenticated members are counted by user id rather than shared IP.
const chatPerMin = Number(process.env.RATE_LIMIT_CHAT_PER_MIN) || 60;
const arenaPerMin = Number(process.env.RATE_LIMIT_ARENA_PER_MIN) || 120;

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/chat', optionalAuth, rateLimit({ windowMs: 60_000, max: chatPerMin, key: 'chat' }), chatRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/regex', regexRoutes);
app.use('/api/arena', optionalAuth, rateLimit({ windowMs: 60_000, max: arenaPerMin, key: 'arena' }), arenaRoutes);
app.use('/api/prefs', prefsRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/personas', personaRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/announcement', announcementRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In production, serve the client's built static files
if (isProduction) {
  const clientDistPath = path.join(__dirname, '../../client/dist');

  // Serve hashed assets (JS/CSS) with long-term caching
  app.use(express.static(clientDistPath, {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      // index.html should never be cached — always revalidate
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));

  // SPA fallback: all non-API routes serve index.html (no cache)
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message });
});

// Start server. We wrap the express app in an explicit http.Server so the
// WebSocket hub (§10.6 realtime) can share the same port via the HTTP upgrade
// handshake — ws needs the raw server, not the express app.
const server = http.createServer(app);
attachRoomHub(server);
server.listen(PORT, () => {
  console.log(`🚀 Multi-Model AI Server running on http://localhost:${PORT} (env: ${isProduction ? 'production' : 'development'})`);
  console.log(`🔌 Room WebSocket hub listening on ws://localhost:${PORT}/ws/rooms`);
  // Begin periodic station health checks so unhealthy stations are auto-detected
  // and auto-recovered without a manual check (§8.3).
  startHealthCheckJob();
  // Periodic DB snapshots so a shared team DB is never a single point of loss
  // (§10.8 Phase 2). Env-tunable; skipped for in-memory DBs.
  startBackupJob();
  // Enforce memory_config.retention_days (TC1 #5) — the setting existed in the
  // UI since day one but nothing ever purged. 0 (default) = keep forever.
  startRetentionJob();
});

// Graceful shutdown
process.on('SIGINT', () => {
  stopHealthCheckJob();
  stopBackupJob();
  stopRetentionJob();
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopHealthCheckJob();
  stopBackupJob();
  stopRetentionJob();
  closeDb();
  process.exit(0);
});
