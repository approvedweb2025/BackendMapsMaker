# Vercel Deployment Guide

## Environment Variables Required

Set these in your Vercel dashboard under Settings > Environment Variables:

```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
CALLBACK_URL=https://your-app.vercel.app/gtoken
SESSION_SECRET=your_session_secret_key
```

**IMPORTANT**: Make sure to set `MONGO_URI` with your actual MongoDB connection string!

## Deployment Steps

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set the environment variables in Vercel dashboard
4. Deploy

## Testing

After deployment, test these endpoints:
- `GET /health` - Health check
- `GET /` - Main page
- `GET /auth/google` - Google OAuth

## Common Issues Fixed

1. ✅ Added `start` script to package.json
2. ✅ Downgraded Express to 4.x for better Vercel compatibility
3. ✅ Added proper module.exports for serverless functions
4. ✅ Fixed file system operations for serverless environment
5. ✅ Added Vercel environment detection
6. ✅ Updated vercel.json configuration
7. ✅ **FIXED**: Database connection logic for production
8. ✅ **FIXED**: Module export syntax in allowedEmail.js
9. ✅ Added database connection status checks
