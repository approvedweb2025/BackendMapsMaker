const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const userRoutes = require("./routes/user.route");
const photoRoutes = require("./routes/photo.route");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const session = require("express-session");
const serverless = require("serverless-http");

require("./auth/google");
dotenv.config();

connectDB();

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "mysecret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use("/api/users", userRoutes);
app.use("/api/photos", photoRoutes);

// ❌ REMOVE: app.listen(PORT)
// ✅ EXPORT:
module.exports = app;
module.exports.handler = serverless(app);
