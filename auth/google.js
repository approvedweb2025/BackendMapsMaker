// auth/google.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();
const axios = require('axios');
const { allowedEmails } = require('../config/allowedEmail');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL, // e.g. http://localhost:3000/gtoken
      accessType: 'offline',
      prompt: 'consent',
      includeGrantedScopes: true,
      passReqToCallback: true,
    },
    async function (req, accessToken, refreshToken, profile, done) {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email || !allowedEmails.includes(email)) {
          return done(null, false, { message: 'Unauthorized email' });
        }

        // Optional: validate token
        await axios.get(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`);

        const user = {
          displayName: profile.displayName,
          email,
          accessToken,
          refreshToken,
        };

        return done(null, user);
      } catch (error) {
        console.error('❌ Error in GoogleStrategy:', error.response?.data || error.message);
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;
