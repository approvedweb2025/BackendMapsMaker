const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const userRoutes = require("./routes/user.route.js");
const photoRoutes = require("./routes/photo.route.js");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const session = require("express-session");
const serverless = require("serverless-http");

require("./auth/google.js");
dotenv.config();

// ✅ Connect to MongoDB Atlas
connectDB();

const app = express();

// ✅ Middleware
app.use(cors({
  origin: [process.env.FRONTEND_URL, process.env.BACKEND_URL],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ✅ Session (use JWT in production ideally)
app.use(session({
  secret: process.env.SESSION_SECRET || "mysecret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
  }
}));

// ✅ Passport
app.use(passport.initialize());
app.use(passport.session());

// ✅ Routes
app.use("/api/users", userRoutes);
app.use("/api/photos", photoRoutes);

// ✅ Google OAuth redirect handler
app.get("/gtoken", (req, res) => {
  res.send("Google OAuth callback hit successfully!");
});

// ✅ Export for Vercel
module.exports = serverless(app);
