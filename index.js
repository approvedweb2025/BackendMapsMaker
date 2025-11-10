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

// Connect to database (non-blocking for serverless)
connectDB().catch(err => {
  console.error('Database connection error:', err);
});

// Middleware to check database connection
const checkDBConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    console.warn('Database not connected. State:', mongoose.connection.readyState);
    // Try to reconnect
    connectDB().catch(err => {
      console.error('Reconnection attempt failed:', err);
    });
    // Continue anyway - Mongoose will buffer commands
  }
  next();
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

app.use(session({
  secret: process.env.SESSION_SECRET, // Yeh Vercel variables mein set hona chahiye
  resave: false,
  saveUninitialized: false,
  cookie: {
    // Production environment ke liye settings
    secure: true,           // Sirf HTTPS par cookie bhejein
    httpOnly: true,         // Client-side JavaScript se cookie access na ho
    sameSite: 'none',       // Cross-domain requests ke liye ijazat dein
    maxAge: 24 * 60 * 60 * 1000 // 1 din
  }
}));

app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());

// Apply DB connection check to database routes
app.use('/users', checkDBConnection, userRoutes);
app.use('/photos', checkDBConnection, photoRoutes);

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
    failureRedirect: `${process.env.FRONTEND_URL}/home`,
    successRedirect: '/photos/sync-images', // must exist in photoRoutes
  })
);

app.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/');
  });
});

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
