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

require('./auth/google.js');

dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ✅ Allowed Origins for CORS
const allowedOrigins = [
  "http://localhost:5173",
  "https://maps-maker-frontend-8ntc.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// ✅ Middlewares
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'mysecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production", // only true in prod
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
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/home`,
  }),
  (req, res) => {
    // ✅ Redirect to frontend after successful login
    res.redirect(`${process.env.FRONTEND_URL}/home`);
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

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
