const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db'); // Path ko check kar lein
const userRoutes = require('./routes/user.route.js'); // Path ko check kar lein
const photoRoutes = require('./routes/photo.route.js'); // Path ko check kar lein
const cookieParser = require('cookie-parser');
const passport = require('passport');
const session = require('express-session');
const Image = require('./models/Image.model.js'); // Path ko check kar lein

// Passport configuration ko import karein
require('./auth/google.js'); // Path ko check kar lein

// Environment variables ko load karein
dotenv.config();

// Database se connect karein
connectDB();

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL, // Vercel environment variable se URL set karein
  credentials: true,
}));

app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET, // Isko Vercel env variables mein zaroor set karein
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Production mein secure cookie
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 din
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());

// Routes
app.use('/users', userRoutes);
app.use('/photos', photoRoutes);

// Google Auth Routes
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
    successRedirect: '/photos/sync-images',
  })
);

app.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/');
  });
});

// Test API
app.get('/api/images', async (req, res) => {
  try {
    const images = await Image.find({ latitude: { $ne: null }, longitude: { $ne: null } }).select('-imageData');
    res.json(images);
  } catch (err) {
    console.error('Failed to fetch images:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Vercel ke liye app ko export karein
module.exports = app;
