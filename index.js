const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./routes/user.route.js');
const photoRoutes = require('./routes/photo.route.js');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // ✅ Use MongoStore instead of memory
const path = require('path');
const Image = require('./models/Image.model.js');
const serverless = require('serverless-http');

require('./auth/google.js');

dotenv.config();
connectDB();

const app = express();

// ✅ Allowed Origins
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
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }), // ✅ Persistent session
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

// ✅ Routes
app.use('/users', userRoutes);
app.use('/photos', photoRoutes);

// ✅ Test Route
app.get('/', (req, res) => res.send("API running 🚀"));

/**
 * ❌ Vercel does not allow `app.listen`
 * ✅ Export as serverless handler
 */
module.exports = app;
module.exports.handler = serverless(app);
