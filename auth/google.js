const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
require("dotenv").config();
const axios = require("axios");
const { allowedEmails } = require("../config/allowedEmail");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL,
      accessType: "offline",
      prompt: "consent",
      includeGrantedScopes: true,
      passReqToCallback: true,
    },
    async function (req, accessToken, refreshToken, profile, done) {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email || !allowedEmails.includes(email)) {
          return done(null, false, { message: "Unauthorized email" });
        }

        // Optional: validate token
        await axios.get(
          `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`
        );

        // ✅ Create JWT token here
        const token = jwt.sign(
          {
            email,
            name: profile.displayName,
          },
          process.env.JWT_SECRET,
          { expiresIn: "1h" }
        );

        const user = {
          displayName: profile.displayName,
          email,
          token,
        };

        return done(null, user);
      } catch (error) {
        console.error(
          "❌ Error in GoogleStrategy:",
          error.response?.data || error.message
        );
        return done(error);
      }
    }
  )
);

// For JWT we don’t really need session serialize/deserialize,
// but keeping them here won’t hurt:
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});
