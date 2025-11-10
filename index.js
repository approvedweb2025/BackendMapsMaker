const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const userRoutes = require('./routes/user.route.js');
const photoRoutes = require('./routes/photo.route.js');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const session = require('express-session');
const Image = require('./models/Image.model.js');

require('./auth/google.js');

dotenv.config();

const app = express();

// Check for required environment variables
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI environment variable is not set!');
  console.error('Please set MONGO_URI in your Vercel environment variables');
} else {
  console.log('✅ MONGO_URI is set');
}

// Connect to database (non-blocking for serverless)
if (process.env.MONGO_URI) {
  connectDB().catch(err => {
    console.error('Database connection error:', err.message);
    console.error('Full error:', err);
  });
} else {
  console.error('⚠️  Cannot connect to database - MONGO_URI not set');
}

// Middleware to check database connection and ensure it's ready
const checkDBConnection = async (req, res, next) => {
  try {
    const state = mongoose.connection.readyState;
    console.log('DB Connection State:', state, '(0=disconnected, 1=connected, 2=connecting, 3=disconnecting)');
    
    if (state !== 1) {
      console.warn('Database not connected. Attempting to connect...');
      // Wait for connection with timeout
      await Promise.race([
        connectDB(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        )
      ]);
      console.log('Database connection established');
    }
    next();
  } catch (error) {
    console.error('Database connection error in middleware:', error);
    // Still continue - Mongoose will buffer, but log the error
    next();
  }
};

// Middlewares
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://maps-maker-frontend-8ntc.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean); // Remove any undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Log for debugging (remove in production if needed)
      console.log('CORS: Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
}));

app.set('trust proxy', 1); 

// Session configuration - only use if SESSION_SECRET is set
// For registration/login endpoints, sessions are optional
if (process.env.SESSION_SECRET) {
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
  }));
} else {
  console.warn('⚠️  SESSION_SECRET not set - sessions disabled');
}

app.use(cookieParser());

// Passport middleware - only initialize if session is configured
if (process.env.SESSION_SECRET) {
  app.use(passport.initialize());
  app.use(passport.session());
}

app.use(express.json());

// Request logging middleware (for debugging)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Apply DB connection check to database routes
app.use('/users', checkDBConnection, userRoutes);
app.use('/photos', checkDBConnection, photoRoutes);

// Google Auth routes - only available if sessions are configured
app.get('/', (req, res) => {
  res.send('<a href="/auth/google">Continue With Google</a>');
});

if (process.env.SESSION_SECRET && process.env.GOOGLE_CLIENT_ID) {
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
      successRedirect: '/photos/sync-images', // must exist in photoRoutes
    })
  );

  app.get('/logout', (req, res, next) => {
    if (req.logout) {
      req.logout(err => {
        if (err) return next(err);
        res.redirect('/');
      });
    } else {
      res.redirect('/');
    }
  });
} else {
  console.warn('⚠️  Google Auth routes disabled - SESSION_SECRET or GOOGLE_CLIENT_ID not set');
}

// ✅ Test API for images
app.get('/api/images', checkDBConnection, async (req, res) => {
  try {
    const images = await Image.find({ latitude: { $ne: null }, longitude: { $ne: null } });
    res.json(images);
  } catch (err) {
    console.error('Failed to fetch images:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      message: 'CORS error', 
      error: 'Origin not allowed' 
    });
  }
  
  // Default error
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.stack
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ✅ Vercel ke liye app ko export karein
module.exports = app;
