// auth/google.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const axios = require('axios');
const { allowedEmails } = require('../config/allowedEmails');

// Agar credentials maujood hon tabhi Google Strategy ko initialize karein
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL,
      accessType: 'offline',
      prompt: 'consent',
      passReqToCallback: true
  },
    async function (req, accessToken, refreshToken, profile, done) {
        try {
            const email = profile.emails?.[0]?.value;

            if (!email || !allowedEmails.includes(email)) {
                return done(null, false, { message: 'Unauthorized email' });
            }

            // User object banayein jo session mein store hoga
            const user = {
                displayName: profile.displayName,
                email,
                accessToken,
                refreshToken: refreshToken || null // Refresh token har baar nahi milta
            };

            return done(null, user);

        } catch (error) {
            console.error('❌ Error in GoogleStrategy:', error.response?.data || error.message);
            return done(error, null);
        }
    }
  ));
} else {
  console.log('⚠️ Google OAuth credentials not provided, skipping Google authentication setup.');
}

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});
