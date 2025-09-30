# Vercel Deployment Guide

## Environment Variables Required

Set these in your Vercel dashboard under Settings > Environment Variables:

### Required Variables
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
CALLBACK_URL=https://your-app.vercel.app/gtoken
GOOGLE_GEOCODING_API_KEY=your_geocoding_api_key
FRONTEND_URL=https://your-frontend-url
SESSION_SECRET=your_session_secret_key
```

### Optional Variables
```
JWT_SECRET=your_jwt_secret_key
NODE_ENV=production
```

**IMPORTANT**: 
- Set `MONGO_URI` with your actual MongoDB connection string
- Set `CALLBACK_URL` to your Vercel app URL + `/gtoken`
- Get `GOOGLE_GEOCODING_API_KEY` from Google Cloud Console
- Use a strong, random `SESSION_SECRET` for production

## Deployment Steps

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set the environment variables in Vercel dashboard
4. Deploy

## Testing

After deployment, test these endpoints:
- `GET /health` - Health check with environment info
- `GET /` - Main page
- `GET /auth/google` - Google OAuth
- `GET /api/images` - API endpoint

## Vercel-Specific Optimizations

### ✅ Serverless Compatibility
- Removed file system operations (temp files)
- Updated EXIF processing to work with buffers
- Optimized for serverless function limits
- Added proper module exports

### ✅ Environment Configuration
- Dynamic CORS configuration based on environment
- Session configuration optimized for serverless
- Environment variable validation
- Health check endpoint with configuration status

### ✅ Performance Optimizations
- Increased Lambda size limit to 50MB
- Set max duration to 30 seconds
- Optimized for IAD1 region
- Buffer-based file processing

## Common Issues Fixed

1. ✅ **FIXED**: Package.json with proper Node.js version and build scripts
2. ✅ **FIXED**: Express app export for Vercel serverless functions
3. ✅ **FIXED**: File system operations replaced with buffer operations
4. ✅ **FIXED**: EXIF processing without temporary files
5. ✅ **FIXED**: CORS configuration for production URLs
6. ✅ **FIXED**: Session configuration for serverless environment
7. ✅ **FIXED**: Environment variable validation and error handling
8. ✅ **FIXED**: Health check endpoint with configuration status
9. ✅ **FIXED**: Database connection logic for production
10. ✅ **FIXED**: Google OAuth scope configuration
11. ✅ **FIXED**: Error handling for authentication failures
12. ✅ **FIXED**: Vercel.json configuration for optimal deployment

## Monitoring

Use the `/health` endpoint to monitor:
- Application status
- Environment configuration
- Database connectivity
- Google API configuration
- Session configuration

## Troubleshooting

If deployment fails:
1. Check environment variables in Vercel dashboard
2. Verify MongoDB connection string
3. Check Google OAuth configuration
4. Review Vercel function logs
5. Test `/health` endpoint for configuration status
