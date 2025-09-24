const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./routes/user.route.js');
const photoRoutes = require('./routes/photo.route.js');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const Image = require('./models/Image.model.js');
const serverless = require('serverless-http'); // ✅ Added

require('./auth/google.js');

dotenv.config();
connectDB();

const app = express();

// ✅ Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ✅ Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.use(cookieParser());

// ✅ Session config for Vercel
app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET || 'mysecret',
  resave: false,
  saveUninitialized: true, 
  cookie: {
    secure: true,           // only HTTPS
    httpOnly: true,         // not accessible by JS
    sameSite: 'none',       // allow frontend (different domain) to use cookies
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

// ✅ Static uploads
app.use('/uploads', express.static(uploadsDir));

// ✅ Routes
app.use('/users', userRoutes);
app.use('/photos', photoRoutes);

// ✅ Handle favicon requests (prevents 500 error in browser)
app.get('/favicon.ico', (req, res) => res.status(204));

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

app.get('/api/images', async (req, res) => {
  try {
    const images = await Image.find({ latitude: { $ne: null }, longitude: { $ne: null } });
    res.json(images);
  } catch (err) {
    console.error('Failed to fetch images:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ❌ No app.listen (not allowed on Vercel)

// ✅ Export for Vercel
module.exports = app;
module.exports.handler = serverless(app);
