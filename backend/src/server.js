import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import { CONFIG, UPLOADS_DIR, ASSETS_DIR } from './config/index.js';
import { getActiveEngine, initDatabase } from './data/db.js';
import adminRoutes from './routes/adminRoutes.js';
import clientRoutes from './routes/clientRoutes.js';

const app = express();

// High-speed HTTP Compression (Gzip / Deflate)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  threshold: 1024 // Only compress responses larger than 1KB
}));

// Middlewares
app.use(cors({
  origin: '*', // Adjust in production
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1000mb' }));
app.use(express.urlencoded({ extended: true, limit: '1000mb' }));

// Static file servers for uploaded photos and branding assets with high-speed browser caching
const staticCacheOptions = {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (/\.(jpg|jpeg|png|webp|svg|gif|webm|mp4)$/i.test(path)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }
};

const uploadsCacheOptions = {
  etag: true,
  lastModified: true,
  setHeaders: (res) => {
    // Force revalidation: browser checks ETag/Last-Modified and receives 304 if unchanged,
    // but instantly loads fresh images whenever watermarks are reapplied or replaced.
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  }
};

app.use('/uploads', express.static(UPLOADS_DIR, uploadsCacheOptions));
app.use('/assets', express.static(ASSETS_DIR, staticCacheOptions));

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/client', clientRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    databaseEngine: getActiveEngine(),
    brand: CONFIG.brandName,
    time: new Date().toISOString()
  });
});

// Optional: Serve built frontend from dist folder if deployed together (e.g. on Spaceship / VPS)
const possibleDistPaths = [
  path.join(process.cwd(), '../frontend/dist'),
  path.join(process.cwd(), 'frontend/dist'),
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'dist')
];
for (const distPath of possibleDistPaths) {
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/assets')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
    break;
  }
}

// Error handling fallback
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An internal server error occurred.'
  });
});

const server = app.listen(CONFIG.port, () => {
  console.log(`=================================================`);
  console.log(`📸 ${CONFIG.brandName} Server Running`);
  console.log(`🚀 Port: ${CONFIG.port}`);
  console.log(`🌐 Base URL: http://localhost:${CONFIG.port}`);
  console.log(`=================================================`);
});

export default app;
