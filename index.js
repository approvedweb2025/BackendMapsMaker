const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const connectDB = require('./config/db');
const userRoutes = require('./routes/user.route.js');
const photoRoutes = require('./routes/photo.route.js');

// Load env variables
dotenv.config();

// Connect DB
connectDB();

const app = express();

// ✅ Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'mysecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// ✅ Routes
app.use('/api/users', userRoutes);
app.use('/api/photos', photoRoutes);

// ❌ DO NOT use app.listen() on Vercel
// ✅ Export for serverless
module.exports = app;
module.exports.handler = serverless(app);
