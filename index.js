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
const path = require('path');
const fs = require('fs');
const MongoStore = require('connect-mongo'); // ✅ Step 1: Import MongoStore

require('./auth/google.js');

dotenv.config();

// Connect to DB
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Allowed Origins for CORS
const allowedOrigins = [
  "http://localhost:5173",
  "https://maps-maker-frontend-8ntc.vercel.app",
  process.env.FRONTEND_URL // Make sure this is set in Vercel
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// ✅ Step 2: Trust proxy for Vercel's environment
// This is crucial for secure cookies to work correctly behind a reverse proxy.
app.set('trust proxy', 1);

// ✅ Middlewares
app.use(cookieParser());

// ✅ Step 3: Update Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'mysecret',
  resave: false,
  saveUninitialized: false,
  // Store sessions in MongoDB instead of memory
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    ttl: 14 * 24 * 60 * 60, // Session Time-to-Live: 14 days
    autoRemove: 'native'
  }),
  cookie: {
    // secure: true in production (HTTPS), false otherwise
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    // Required for cross-domain cookies (frontend on one domain, backend on another)
    sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());


// ✅ Routes (The rest of your file remains the same)
app.use('/users', userRoutes);
app.use('/photos', photoRoutes);

// ... (Your other routes like health checks, Google Auth, etc., remain unchanged)
// ... (I am omitting the rest of your file for brevity, but you should keep it)

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Google Auth routes
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
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login-failed` }), // Redirect to frontend on failure
  (req, res) => {
    // After successful authentication, the session is established.
    // Redirect the user back to your frontend.
    res.redirect(process.env.FRONTEND_URL); // e.g., https://maps-maker-frontend-8ntc.vercel.app
  }
);

app.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect(process.env.FRONTEND_URL || '/');
  });
});

// ... (keep all your other API and test routes)

// ✅ Catch-all
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Export the app for Vercel
module.exports = app;

// Only start server if not in Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
  });
}
