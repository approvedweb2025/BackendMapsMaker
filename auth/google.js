const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { allowedEmails } = require('../config/allowedEmail');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL, // Ensure this is https://backend-maps-maker.vercel.app/gtoken
    passReqToCallback: true
},
async function (req, accessToken, refreshToken, profile, done) {
    try {
        const email = profile.emails?.[0]?.value;

        if (!email || !allowedEmails.includes(email)) {
            // Agar email allowed nahi hai to yahan error return karein
            return done(null, false, { message: 'Unauthorized email' });
        }

        const user = {
            displayName: profile.displayName,
            email,
            accessToken,
            refreshToken // Offline access se refresh token milta hai
        };

        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));


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
