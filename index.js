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
const Image = require('./models/Image.model.js');

require('./auth/google.js');

dotenv.config();

// Connect to DB (Vercel will handle connection pooling)
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Ensure uploads folder exists (only in non-serverless environments)
const uploadsDir = path.join(__dirname, 'public/uploads');
if (process.env.VERCEL !== '1' && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ✅ Allowed Origins for CORS
const allowedOrigins = [
  "http://localhost:5173",
  "https://maps-maker-frontend-8ntc.vercel.app",
  process.env.FRONTEND_URL
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// ✅ Middlewares
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'mysecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

// ✅ Static folders
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// ✅ Routes
app.use('/users', userRoutes);
app.use('/photos', photoRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API health check route
app.get('/api/health', async (req, res) => {
  try {
    const Image = require('./models/Image.model.js');
    const cloudinary = require('cloudinary').v2;
    
    // Test database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Test email endpoints
    const firstEmailCount = await Image.countDocuments({ uploadedBy: 'mhuzaifa8519@gmail.com' });
    const secondEmailCount = await Image.countDocuments({ uploadedBy: 'mhuzaifa86797@gmail.com' });
    const thirdEmailCount = await Image.countDocuments({ uploadedBy: 'muhammadjig8@gmail.com' });
    
    // Test Cloudinary folder structure
    let cloudinaryFolders = {};
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const folders = ['first-email', 'second-email', 'third-email'];
        for (const folder of folders) {
          const result = await cloudinary.search
            .expression(`folder:maps-maker/${folder}`)
            .max_results(1)
            .execute();
          cloudinaryFolders[folder] = result.total_count || 0;
        }
      } catch (err) {
        cloudinaryFolders = { error: 'Failed to fetch folder info' };
      }
    }
    
    res.json({
      status: 'OK',
      database: dbStatus,
      emailCounts: {
        firstEmail: firstEmailCount,
        secondEmail: secondEmailCount,
        thirdEmail: thirdEmailCount
      },
      cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'not configured',
      cloudinaryFolders,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'ERROR',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
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

// ✅ Fix: Instead of forcing redirect, send JSON to frontend
app.get('/gtoken',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Auto-run Google Drive sync with token and then optionally bounce to FE
    const accessToken = req.user?.accessToken || '';
    if (accessToken) {
      const syncUrl = new URL(`${req.protocol}://${req.get('host')}/photos/sync-images`);
      syncUrl.searchParams.set('accessToken', accessToken);
      if (process.env.FRONTEND_URL) syncUrl.searchParams.set('redirect', '1');
      return res.redirect(syncUrl.toString());
    }

    // Fallback: return JSON if no token
    res.json({ success: true, user: req.user });
  }
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
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const images = await Image.find({ latitude: { $ne: null }, longitude: { $ne: null } });
    res.json(images);
  } catch (err) {
    console.error('Failed to fetch images:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
