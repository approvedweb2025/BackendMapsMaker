const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./routes/user.route.js');
const photoRoutes = require('./routes/photo.route.js');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // ✅ Added
const Image = require('./models/Image.model.js');

require('./auth/google.js');

dotenv.config();
const connectionPromise = connectDB(); // Ensure this returns the mongoose connection

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL, // e.g., https://maps-maker-frontend.vercel.app
  credentials: true,
  optionsSuccessStatus: 200
}));

app.set('trust proxy', 1); // ✅ Vercel ke liye zaroori hai

app.use(express.json());
app.use(cookieParser());

// ✅ Updated Session with MongoStore
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI, // Aapka MongoDB connection string
    ttl: 24 * 60 * 60 // 1 din tak session rahega
  }),
  cookie: {
    secure: true,       // HTTPS zaroori hai (Vercel provides this)
    httpOnly: true,
    sameSite: 'none',   // Cross-domain (frontend-backend alag domains) ke liye
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/users', userRoutes);
app.use('/photos', photoRoutes);

app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive.readonly'],
    accessType: 'offline',
    prompt: 'consent'
  })
);

app.get('/gtoken',
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login` }),
  (req, res) => {
    // Sync hone ke baad wapis FRONTEND par bhejna zaroori hai
    res.redirect('/photos/sync-images'); 
  }
);

// Photo Routes ke andar sync-images ke baad redirect lazmi karein:
// res.redirect(`${process.env.FRONTEND_URL}/home`);

app.get('/api/images', async (req, res) => {
  try {
    const images = await Image.find({ latitude: { $ne: null }, longitude: { $ne: null } });
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = app;
