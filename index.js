const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./routes/user.route.js');
const photoRoutes = require('./routes/photo.route.js');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const passport = require('passport');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Image = require('./models/Image.model.js');
const { validateEnvironmentVariables, getEnvironmentInfo } = require('./utils/envValidation');

require('./auth/google.js');

dotenv.config();

// Validate environment variables
try {
  validateEnvironmentVariables();
} catch (error) {
  console.error('Environment validation failed:', error.message);
  if (process.env.VERCEL === '1') {
    process.exit(1);
  }
}

// Initialize database connection
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// Environment-based CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Session configuration optimized for serverless
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Routes
app.use('/users', userRoutes);
app.use('/photos', photoRoutes);

// Static files (only for development)
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
}

// Health check endpoint for Vercel monitoring
app.get('/health', (req, res) => {
  const envInfo = getEnvironmentInfo();
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: envInfo.nodeEnv,
    isVercel: envInfo.isVercel,
    config: {
      hasMongoUri: envInfo.hasMongoUri,
      hasGoogleConfig: envInfo.hasGoogleConfig,
      hasGeocodingKey: envInfo.hasGeocodingKey,
      hasFrontendUrl: envInfo.hasFrontendUrl,
      hasSessionSecret: envInfo.hasSessionSecret
    }
  });
});

// Google Auth
app.get('/', (req, res) => {
  res.send('<a href="/auth/google">Continue With Google</a>');
});

app.get('/auth/google',
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/drive.readonly'
    ],
    accessType: 'offline',
    prompt: 'consent'
  })
);

app.get('/gtoken',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/home`,
    successRedirect: '/photos/sync-images',
  })
);

app.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/');
  });
});

// API endpoint for images
app.get('/api/images', async (req, res) => {
  try {
    const images = await Image.find({ latitude: { $ne: null }, longitude: { $ne: null } });
    res.json(images);
  } catch (err) {
    console.error('Failed to fetch images:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Only start server if not in Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
  });
}

// Export app for Vercel serverless functions
module.exports = app;