// index.js

// 1. ENVIRONMENT VARIABLES (sabse upar)
const dotenv = require('dotenv');
dotenv.config();

// 2. IMPORTS
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const session = require('express-session');
const connectDB = require('./config/db');

// Route files ko import karein
const userRoutes = require('./routes/user.route.js');
const photoRoutes = require('./routes/photo.route.js');

// Passport configuration ko import karein (yeh Passport ko setup karega)
require('./auth/google.js');

// 3. EXPRESS APP INITIALIZATION
const app = express();

// 4. CORE MIDDLEWARES (in correct order)

// CORS ko sabse pehle rakhein taaki cross-origin requests handle ho sakein
app.use(cors({
  origin: process.env.FRONTEND_URL, // .env file se frontend ka URL lein
  credentials: true, // Cookies aur authorization headers ke liye zaroori hai
}));

// Request body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser (JWT token cookie ko padhne ke liye)
app.use(cookieParser());

// Express Session (Passport.js ke liye zaroori hai)
app.use(session({
  secret: process.env.SESSION_SECRET, // Session ko secure karne ke liye secret key
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Production mein 'true' rakhein
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 din
  }
}));

// Passport Middleware (session ke baad aana chahiye)
app.use(passport.initialize());
app.use(passport.session());


// 5. API ROUTES
// Best practice ke liye apne API routes ko '/api/v1' jaise prefix ke saath rakhein
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/photos', photoRoutes);


// 6. GOOGLE AUTHENTICATION & OTHER ROOT-LEVEL ROUTES

// Test route
app.get('/', (req, res) => {
  res.send('<h1>Backend is running!</h1><a href="/auth/google">Continue With Google</a>');
});

// Google Auth - Step 1: Redirect to Google
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive.readonly'],
    accessType: 'offline', // Refresh token ke liye
    prompt: 'consent'     // Har baar user se permission maange
  })
);

// Google Auth - Step 2: Callback from Google
app.get('/gtoken',
  passport.authenticate('google', {
    // Agar authentication fail ho, to login page par bhej dein
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
    // Agar success ho, to /photos/sync-images par bhej dein (jaisa aapke code mein tha)
    successRedirect: '/api/v1/photos/sync-images',
  })
);

// Passport Logout Route
app.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    // Logout ke baad frontend ke login page par redirect karein
    res.redirect(`${process.env.FRONTEND_URL}/login`);
  });
});

// NOTE: Aapke JWT-based logout (`/api/v1/users/logout`) aur Passport logout (`/logout`) dono alag-alag hain.


// 7. VERCEL SERVERLESS FUNCTION HANDLER
// Yeh hissa Vercel par deploy karne ke liye zaroori hai.
const handler = async (req, res) => {
  try {
    // Har request se pehle database se connect karein
    await connectDB();
    // Express app ko request handle karne ke liye call karein
    return app(req, res);
  } catch (error) {
    console.error('[HANDLER_ERROR] Critical error:', error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
};

module.exports = handler;
