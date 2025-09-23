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
const Image = require('./models/Image.model.js');
const serverless = require('serverless-http');

require('./auth/google.js');

dotenv.config();
connectDB();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://maps-maker-frontend-8ntc.vercel.app"
];

app.use(cors({ origin: allowedOrigins, credentials: true }));
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

// Routes
app.use('/users', userRoutes);
app.use('/photos', photoRoutes);

app.get('/', (req, res) => res.send("API running"));

module.exports = app;
module.exports.handler = serverless(app); // ✅ export for Vercel
