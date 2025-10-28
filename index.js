// index.js (Final Hosting-Ready Version)

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db'); // Database connection function
const userRoutes = require('./routes/user.route.js');
const photoRoutes = require('./routes/photo.route.js');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const session = require('express-session');

// Step 1: Environment variables ko sabse pehle load karein
dotenv.config();

// Step 2: Passport ki configuration ko import karein
require('./auth/google.js');

// Step 3: Wajahat -> Database se sirf ek baar connect karein, jab server start ho.
// Yeh har request par connection banane se rokta hai aur app ko crash hone se bachata hai.
connectDB();

// Step 4: Express app ko initialize karein
const app = express();

// Step 5: Saare zaroori Middlewares ko set karein
app.use(cors({
  origin: process.env.FRONTEND_URL, // Sirf aapke frontend ko ijazat dega
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Express Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Production me cookie sirf HTTPS par kaam karegi
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 din tak session zinda rahega
  }
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Step 6: API Routes ko define karein
// Wajahat -> Vercel par conflicts se bachne ke liye '/api' prefix istemal karna ek behtareen practice hai.
// Isse frontend aur backend ke routes aapas me takrate nahi hain.
app.use('/api/users', userRoutes);
app.use('/api/photos', photoRoutes);

// Root API route (sirf testing ke liye, batata hai ke backend chal raha hai)
app.get('/api', (req, res) => {
  res.send('<h1>Backend API is running!</h1><a href="/api/auth/google">Continue With Google</a>');
});

// Step 7: Google Authentication ke Routes
// Login ke liye Google par bhejne wala route
app.get('/api/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive.readonly'],
    accessType: 'offline',
    prompt: 'consent'
  })
);

// Wajahat -> Google se wapas aane wala callback route. Aapne iska naam 'gtoken' rakha tha,
// lekin standard tareeka 'callback' hai. Logic bilkul wahi hai.
app.get('/api/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
    // Kamyabi par seedha sync wale backend route par bhej dein (prefix '/api' ke saath)
    successRedirect: '/api/photos/sync-images',
  })
);

// Logout ka route
app.get('/api/auth/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect(`${process.env.FRONTEND_URL}/login`);
  });
});

// Step 8: Wajahat -> Custom 'handler' function ko hata diya gaya hai.
// Vercel ko sirf 'app' object chahiye, woh baaqi sab khud handle kar leta hai.
// Yeh sab se ahem tabdeeli (change) hai.
module.exports = app;
