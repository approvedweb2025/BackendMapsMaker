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
const serverless = require('serverless-http'); // ✅ added

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

app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'mysecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());

// ✅ Static folder for uploads
app.use('/uploads', express.static(uploadsDir));

// ✅ Routes
app.use('/users', userRoutes);
app.use('/photos', photoRoutes);

app.get('/', (req, res) => {
  res.send('<a href="/auth/google">Continue With Google</a>');
});

// ❌ REMOVE app.listen()
// app.listen(PORT, () => console.log(`Server running on ${PORT}`));

// ✅ EXPORT for Vercel
module.exports = app;
module.exports.handler = serverless(app);
