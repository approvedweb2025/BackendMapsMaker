# Cloudinary Setup Guide

This project has been converted to use Cloudinary for image storage and management. Here's how to set it up:

## Environment Variables

Add these environment variables to your `.env` file:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

## Getting Cloudinary Credentials

1. Sign up for a free account at [cloudinary.com](https://cloudinary.com)
2. Go to your Dashboard
3. Copy the following values:
   - Cloud Name
   - API Key
   - API Secret

## Features Added

### 1. Image Upload to Cloudinary
- Images are now uploaded to Cloudinary instead of being stored locally
- Automatic EXIF data extraction for GPS coordinates
- Automatic geocoding for location details

### 2. New API Endpoints

#### Upload Single Image
```
POST /api/photos/upload-single
Body: {
  "fileId": "google-drive-file-id",
  "name": "image-name.jpg",
  "mimeType": "image/jpeg"
}
```

#### Delete Image
```
DELETE /api/photos/delete/:imageId
```

#### Get Transformed Image URL
```
GET /api/photos/transform/:imageId?width=300&height=200&quality=80&format=webp
```

### 3. Image URL Priority
The system now prioritizes image URLs in this order:
1. Cloudinary Secure URL
2. Cloudinary URL
3. Google Drive URL (legacy)
4. Local path (legacy)

### 4. Database Schema Updates
The Image model now includes:
- `cloudinaryUrl`: Standard Cloudinary URL
- `cloudinaryPublicId`: Cloudinary public ID for management
- `cloudinarySecureUrl`: Secure HTTPS URL

## Migration from Google Drive

The existing sync functionality will:
1. Download images from Google Drive
2. Upload them to Cloudinary
3. Store both Google Drive and Cloudinary URLs in the database
4. Prioritize Cloudinary URLs for serving

## Benefits

- **Better Performance**: Cloudinary's CDN provides faster image delivery
- **Image Transformations**: Resize, crop, optimize images on-the-fly
- **Automatic Optimization**: WebP conversion, quality optimization
- **Scalability**: No local storage limitations
- **Reliability**: Professional image hosting service

## Usage Examples

### Get all photos with Cloudinary URLs
```javascript
GET /api/photos/get-photos
```

### Get transformed image
```javascript
GET /api/photos/transform/IMAGE_ID?width=500&height=300&quality=80
```

### Upload new image
```javascript
POST /api/photos/upload-single
{
  "fileId": "1ABC123DEF456",
  "name": "vacation-photo.jpg",
  "mimeType": "image/jpeg"
}
```
