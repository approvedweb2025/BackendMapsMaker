const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('../config/db'); // Adjusted path
const userRoutes = require('../routes/user.route.js'); // Adjusted path
const photoRoutes = require('../routes/photo.route.js'); // Adjusted path
const cookieParser = require('cookie-parser');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // ✅ Import connect-mongo
const path = require('path');
const fs = require('fs');
const Image = require('../models/Image.model.js'); // Adjusted path

require('../auth/google.js'); // Adjusted path

dotenv.config();
connectDB();

const app = express();

// ✅ Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL, // ✅ Use environment variable for production URL
  credentials: true,
}));

app.use(cookieParser());

// ✅ Session configuration with MongoStore
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI, // Your MongoDB connection string
    ttl: 14 * 24 * 60 * 60, // = 14 days. Default
    autoRemove: 'native'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // ✅ Set to true in production (https)
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    sameSite: 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());

// Routes
app.use('/users', userRoutes);
app.use('/photos', photoRoutes);

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
    // ✅ Use FRONTEND_URL for redirects
    failureRedirect: `${process.env.FRONTEND_URL}/login-failure`,
    successRedirect: `${process.env.FRONTEND_URL}/home`, // Redirect to frontend after sync
  })
);

// Redirect to sync after successful login
app.get('/auth/success', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/photos/sync-images');
    } else {
        res.redirect(`${process.env.FRONTEND_URL}/login-failure`);
    }
});


app.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/');
  });
});

// Test API for images
app.get('/api/images', async (req, res) => {
  try {
    const images = await Image.find({ latitude: { $ne: null }, longitude: { $ne: null } });
    res.json(images);
  } catch (err) {
    console.error('Failed to fetch images:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export the app for Vercel
module.exports = app;
