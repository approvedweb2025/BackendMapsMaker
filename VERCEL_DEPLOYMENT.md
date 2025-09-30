# Backend API - Vercel Deployment Guide

This Node.js backend is configured for deployment on Vercel.

## Environment Variables Required

Set these environment variables in your Vercel dashboard:

### Required Variables:
- `MONGO_URI` - Your MongoDB connection string
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `SESSION_SECRET` - Secret key for session encryption
- `FRONTEND_URL` - Your frontend application URL
- `BACKEND_URL` - Your backend URL (will be your Vercel app URL)

### Optional Variables:
- `CALLBACK_URL` - Google OAuth callback URL (auto-generated in production)

## Deployment Steps

1. **Connect to Vercel:**
   - Install Vercel CLI: `npm i -g vercel`
   - Run `vercel` in your project directory
   - Follow the prompts to link your project

2. **Set Environment Variables:**
   - Go to your Vercel dashboard
   - Navigate to your project settings
   - Add all required environment variables

3. **Deploy:**
   - Run `vercel --prod` to deploy to production
   - Or push to your connected Git repository

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - Development: `http://localhost:3000/gtoken`
   - Production: `https://your-app.vercel.app/gtoken`

## Static Files

Static files in `/public/uploads` will be served by Vercel automatically. Make sure to upload files to a cloud storage service (like Cloudinary) for production use.

## Database Connection

The app uses MongoDB with Mongoose. Make sure your MongoDB instance is accessible from Vercel's servers. Consider using MongoDB Atlas for cloud hosting.

## CORS Configuration

CORS is configured to allow requests from:
- Development: `http://localhost:5173`
- Production: Your frontend URL and Vercel URL

## Session Management

Sessions are configured for serverless environments with proper cookie settings for production.
