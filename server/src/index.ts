import express from 'express';
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

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// Initialize database
getDb();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/mcp', mcpRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In production, serve the client's built static files
if (isProduction) {
  const clientDistPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));
  // SPA fallback: all non-API routes serve index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Multi-Model AI Server running on http://localhost:${PORT} (env: ${isProduction ? 'production' : 'development'})`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});
