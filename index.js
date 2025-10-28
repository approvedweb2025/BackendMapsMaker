// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./routes/user.route.js');
const photoRoutes = require('./routes/photo.route.js');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const session = require('express-session');

// Environment variables ko load karein (sabse pehle)
dotenv.config();

// Passport configuration ko import karein
require('./auth/google.js');

// Express app ko initialize karein
const app = express();

// Middlewares
// CORS ko pehle rakhein
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Express Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 din
  }
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// API Routes
app.use('/users', userRoutes);
app.use('/photos', photoRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('<h1>Backend is running!</h1><a href="/auth/google">Continue With Google</a>');
});

// Google Auth Routes
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive.readonly'],
    accessType: 'offline',
    prompt: 'consent'
  })
);

app.get('/gtoken',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
    successRedirect: '/photos/sync-images',
  })
);

app.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect(`${process.env.FRONTEND_URL}/login`);
  });
});

// Vercel ke liye Serverless Function Handler
const handler = async (req, res) => {
  try {
    // Har request se pehle database connection yaqeeni banayein
    await connectDB();
    // Express app ko call karein
    return app(req, res);
  } catch (error) {
    console.error('[HANDLER_ERROR]', error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
};

module.exports = handler;
