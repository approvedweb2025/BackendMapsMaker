const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();
const axios = require('axios');
const { allowedEmails } = require('../config/allowedEmail');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production' 
      ? `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.BACKEND_URL}/gtoken`
      : 'https://backend-maps-maker.vercel.app/gtoken',
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/drive.readonly'
    ],
    accessType: 'offline',
    prompt: 'consent',
    includeGrantedScopes: true,
    passReqToCallback: true
},
    async function (req, accessToken, refreshToken, profile, done) {
        try {
            // ✅ Get email safely
            const email = profile.emails?.[0]?.value;

            // ❌ You forgot to define `email` in your code before using it
            if (!email || !allowedEmails.includes(email)) {
                return done(null, false, { message: 'Unauthorized email' });
            }

            // ✅ Optional: Fetch token info (you can keep or skip this)
            const tokenInfo = await axios.get(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`);
       

            const user = {
                displayName: profile.displayName,
                email,
                accessToken,
                refreshToken
            };

            return done(null, user);

        } catch (error) {
            console.error('❌ Error in GoogleStrategy:', error.response?.data || error.message);
            return done(error);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, {
        email: user.email,
        accessToken: user.accessToken,
        refreshToken: user.refreshToken,
        displayName: user.displayName
    });
});

passport.deserializeUser((user, done) => {
    done(null, user);
});
