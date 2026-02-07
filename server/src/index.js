import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Routes
import authRoutes from './routes/auth.js';
import agentRoutes from './routes/agents.js';
import causeRoutes from './routes/causes.js';
import insightRoutes from './routes/insights.js';
import bountyRoutes from './routes/bounties.js';
import leaderboardRoutes from './routes/leaderboard.js';
import validationRoutes from './routes/validations.js';
import branchRoutes from './routes/branches.js';
import credRoutes from './routes/cred.js';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for React
}));
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start
    }));
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'guild-api', version: '1.0.0' });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/agents', agentRoutes);
app.use('/api/v1/causes', causeRoutes);
app.use('/api/v1/insights', insightRoutes);
app.use('/api/v1/bounties', bountyRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/validations', validationRoutes);
app.use('/api/v1/cred', credRoutes);
app.use('/api/v1', branchRoutes); // Handles /causes/:id/branches and /branches/:id

// Serve static files
const publicPath = join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(join(publicPath, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: err.stack
  }));
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`OpenCause API running on port ${PORT}`);
});
