const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./routes/user.route.js');
const photoRoutes = require('./routes/photo.route.js');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const session = require('express-session');
const Image = require('./models/Image.model.js');

require('./auth/google.js');

dotenv.config();
connectDB();

const app = express();

// Middlewares
app.use(cors({
  // ❗️ FRONTEND_URL ko environment variable se lein
  origin: process.env.FRONTEND_URL || 'https://maps-maker-frontend.vercel.app',
  credentials: true,
  optionsSuccessStatus: 200
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
app.get('/api/images', async (req, res) => {
  try {
    const images = await Image.find({ latitude: { $ne: null }, longitude: { $ne: null } });
    res.json(images);
  } catch (err) {
    console.error('Failed to fetch images:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Vercel ke liye app ko export karein
module.exports = app;
