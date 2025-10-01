const axios = require('axios');
const exifr = require('exifr');
const Image = require('../models/Image.model');
const { 
  uploadImageToCloudinary, 
  downloadImageFromGoogleDrive,
  deleteImageFromCloudinary,
  generateTransformedUrl
} = require('../utils/cloudinary');
const cloudinary = require('../config/cloudinary');

// ✅ Download file from Google Drive (serverless compatible)
const downloadFile = async (fileId, accessToken) => {
  const response = await axios.get(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` }, responseType: 'arraybuffer' }
  );
  return response.data;
};

// ✅ Reverse Geocoding via Google API
const getPlaceDetails = async (lat, lng) => {
  try {
    const res = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
      params: { latlng: `${lat},${lng}`, key: process.env.GOOGLE_GEOCODING_API_KEY }
    });

    if (res.data.status === "OK" && res.data.results.length > 0) {
      const components = res.data.results[0].address_components;
      const extract = (type) => components.find((c) => c.types.includes(type))?.long_name || "";

      return {
        district: extract("administrative_area_level_2") || extract("administrative_area_level_1") || "",
        tehsil: extract("administrative_area_level_3") || extract("sublocality_level_1") || "",
        village: extract("locality") || extract("sublocality") || extract("neighborhood") || "",
        country: extract("country") || ""
      };
    }
    return { district: "", tehsil: "", village: "", country: "" };
  } catch (err) {
    console.error("❌ Geocode error:", err.message);
    return { district: "", tehsil: "", village: "", country: "" };
  }
};

// ✅ Sync Google Drive images → Cloudinary → DB
const syncImages = async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).send('Not authenticated');
  const accessToken = req.user.accessToken;

  try {
    let files = [];
    let nextPageToken = null;

    do {
      const driveResponse = await axios.get('https://www.googleapis.com/drive/v3/files', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          q: "mimeType contains 'image/' and trashed=false",
          fields: 'nextPageToken, files(id, name, mimeType, createdTime)',
          pageToken: nextPageToken
        }
      });

      files.push(...(driveResponse.data.files || []));
      nextPageToken = driveResponse.data.nextPageToken;
    } while (nextPageToken);

    console.log(`✅ Total files fetched: ${files.length}`);

    for (const file of files) {
      try {
        const exists = await Image.findOne({ fileId: file.id });
        if (exists) continue;

        // ✅ Download file data from Google Drive
        const fileData = await downloadImageFromGoogleDrive(file.id, accessToken);

        let latitude = null, longitude = null;
        let timestamp = new Date(file.createdTime || Date.now());

        try {
          if (['image/jpeg', 'image/jpg', 'image/tiff'].includes(file.mimeType)) {
            const exifData = await exifr.parse(fileData);
            if (exifData) {
              if (exifData.latitude && exifData.longitude) {
                latitude = exifData.latitude;
                longitude = exifData.longitude;
              }
              if (exifData.DateTimeOriginal) {
                timestamp = new Date(exifData.DateTimeOriginal);
              }
            }
          }
        } catch (err) {
          console.warn(`⚠️ EXIF error for ${file.name}:`, err.message);
        }

        let placeDetails = { district: "", tehsil: "", village: "", country: "" };
        if (latitude && longitude) {
          placeDetails = await getPlaceDetails(latitude, longitude);
        }

        // ✅ Upload to Cloudinary
        const cloudinaryResult = await uploadImageToCloudinary(fileData, file.name, {
          mimeType: file.mimeType
        });

        if (!cloudinaryResult.success) {
          console.error(`❌ Cloudinary upload failed for ${file.name}:`, cloudinaryResult.error);
          continue;
        }

        await Image.create({
          fileId: file.id,
          name: file.name,
          mimeType: file.mimeType,
          latitude,
          longitude,
          timestamp,
          uploadedBy: req.user.email,
          lastCheckedAt: new Date(),
          googleDriveUrl: `https://drive.google.com/file/d/${file.id}/view`, // Keep for reference
          cloudinaryUrl: cloudinaryResult.data.url,
          cloudinaryPublicId: cloudinaryResult.data.publicId,
          cloudinarySecureUrl: cloudinaryResult.data.secureUrl,
          ...placeDetails
        });

        console.log(`✅ Successfully uploaded ${file.name} to Cloudinary`);

      } catch (fileErr) {
        console.error(`❌ Error processing file ${file.name}:`, fileErr);
      }
    }

    res.redirect(`${process.env.FRONTEND_URL}/home`);
  } catch (err) {
    console.error('❌ Sync error:', err);
    res.status(500).send('Failed to sync images');
  }
};

// ✅ Get all photos
const getPhotos = async (req, res) => {
  try {
    const photos = await Image.find().sort({ createdAt: -1 });
    
    // Transform photos to include the best available URL
    const transformedPhotos = photos.map(photo => ({
      ...photo.toObject(),
      imageUrl: photo.cloudinarySecureUrl || photo.cloudinaryUrl || photo.googleDriveUrl || photo.ImageURL
    }));
    
    res.status(200).json({ photos: transformedPhotos });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// ✅ Monthly Stats (month + uploader + count)
const getImageStatsByMonth = async (req, res) => {
  try {
    const monthlyStats = await Image.aggregate([
      {
        $group: {
          _id: {
            month: { $dateToString: { format: "%Y-%m", date: "$timestamp" } },
            uploadedBy: "$uploadedBy"
          },
          count: { $sum: 1 }
        }
      },
      { $project: { month: "$_id.month", uploadedBy: "$_id.uploadedBy", count: 1, _id: 0 } },
      { $sort: { month: 1 } }
    ]);

    const uniqueUploaders = [...new Set(monthlyStats.map((s) => s.uploadedBy).filter(Boolean))];
    res.status(200).json({ stats: monthlyStats, uniqueUploaders });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get monthly stats', error: err.message });
  }
};

// ✅ Yearly Stats (year + uploader + count)
const getImageStatsByYear = async (req, res) => {
  try {
    const yearlyStats = await Image.aggregate([
      {
        $group: {
          _id: {
            year: { $dateToString: { format: "%Y", date: "$timestamp" } },
            uploadedBy: "$uploadedBy"
          },
          count: { $sum: 1 }
        }
      },
      { $project: { year: "$_id.year", uploadedBy: "$_id.uploadedBy", count: 1, _id: 0 } },
      { $sort: { year: 1 } }
    ]);
    res.status(200).json({ stats: yearlyStats });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get yearly stats', error: err.message });
  }
};

// ✅ Daily Stats (day + uploader + count)
const getImageStatsByDay = async (req, res) => {
  try {
    const dailyStats = await Image.aggregate([
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            uploadedBy: "$uploadedBy"
          },
          count: { $sum: 1 }
        }
      },
      { $project: { date: "$_id.date", uploadedBy: "$_id.uploadedBy", count: 1, _id: 0 } },
      { $sort: { date: 1 } }
    ]);
    res.status(200).json({ stats: dailyStats });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get daily stats', error: err.message });
  }
};

// ✅ Other helpers
const getImagesByUploadedBy = async (req, res) => {
  try {
    const { uploadedBy } = req.params;
    const photos = await Image.find({ uploadedBy });
    res.status(200).json({ photos });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getFirstEmailImage = async (req, res) => {
  try {
    const email = 'mhuzaifa8519@gmail.com';
    const images = await Image.find({ uploadedBy: email, longitude: { $ne: null }, latitude: { $ne: null } });
    res.status(200).json(images);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSecondEmailImage = async (req, res) => {
  try {
    const email = 'mhuzaifa86797@gmail.com';
    const images = await Image.find({ uploadedBy: email, longitude: { $ne: null }, latitude: { $ne: null } });
    res.status(200).json(images);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getThirdEmailImage = async (req, res) => {
  try {
    const email = 'muhammadjig8@gmail.com';
    const images = await Image.find({ uploadedBy: email, longitude: { $ne: null }, latitude: { $ne: null } });
    res.status(200).json(images);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ✅ Upload single image to Cloudinary
const uploadSingleImage = async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).send('Not authenticated');
  
  try {
    const { fileId, name, mimeType } = req.body;
    const accessToken = req.user.accessToken;

    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    // Check if image already exists
    const existingImage = await Image.findOne({ fileId });
    if (existingImage) {
      return res.status(400).json({ error: 'Image already exists' });
    }

    // Download from Google Drive
    const fileData = await downloadImageFromGoogleDrive(fileId, accessToken);

    // Extract EXIF data
    let latitude = null, longitude = null;
    let timestamp = new Date();

    try {
      if (['image/jpeg', 'image/jpg', 'image/tiff'].includes(mimeType)) {
        const exifData = await exifr.parse(fileData);
        if (exifData) {
          if (exifData.latitude && exifData.longitude) {
            latitude = exifData.latitude;
            longitude = exifData.longitude;
          }
          if (exifData.DateTimeOriginal) {
            timestamp = new Date(exifData.DateTimeOriginal);
          }
        }
      }
    } catch (err) {
      console.warn(`⚠️ EXIF error for ${name}:`, err.message);
    }

    // Get place details
    let placeDetails = { district: "", tehsil: "", village: "", country: "" };
    if (latitude && longitude) {
      placeDetails = await getPlaceDetails(latitude, longitude);
    }

    // Upload to Cloudinary
    const cloudinaryResult = await uploadImageToCloudinary(fileData, name, {
      mimeType: mimeType
    });

    if (!cloudinaryResult.success) {
      return res.status(500).json({ error: 'Failed to upload to Cloudinary', details: cloudinaryResult.error });
    }

    // Save to database
    const newImage = await Image.create({
      fileId,
      name,
      mimeType,
      latitude,
      longitude,
      timestamp,
      uploadedBy: req.user.email,
      lastCheckedAt: new Date(),
      googleDriveUrl: `https://drive.google.com/file/d/${fileId}/view`,
      cloudinaryUrl: cloudinaryResult.data.url,
      cloudinaryPublicId: cloudinaryResult.data.publicId,
      cloudinarySecureUrl: cloudinaryResult.data.secureUrl,
      ...placeDetails
    });

    res.status(201).json({ 
      message: 'Image uploaded successfully',
      image: {
        ...newImage.toObject(),
        imageUrl: newImage.cloudinarySecureUrl
      }
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

// ✅ Delete image from Cloudinary and database
const deleteImage = async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).send('Not authenticated');
  
  try {
    const { imageId } = req.params;
    
    const image = await Image.findById(imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Check if user owns the image
    if (image.uploadedBy !== req.user.email) {
      return res.status(403).json({ error: 'Not authorized to delete this image' });
    }

    // Delete from Cloudinary if public ID exists
    if (image.cloudinaryPublicId) {
      const deleteResult = await deleteImageFromCloudinary(image.cloudinaryPublicId);
      if (!deleteResult.success) {
        console.warn(`⚠️ Failed to delete from Cloudinary: ${deleteResult.error}`);
      }
    }

    // Delete from database
    await Image.findByIdAndDelete(imageId);

    res.status(200).json({ message: 'Image deleted successfully' });

  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
};

// ✅ Get transformed image URL
const getTransformedImageUrl = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { width, height, quality, format } = req.query;

    const image = await Image.findById(imageId);
    if (!image || !image.cloudinaryPublicId) {
      return res.status(404).json({ error: 'Image not found or not uploaded to Cloudinary' });
    }

    const transformations = {};
    if (width) transformations.width = parseInt(width);
    if (height) transformations.height = parseInt(height);
    if (quality) transformations.quality = quality;
    if (format) transformations.format = format;

    const transformedUrl = cloudinary.url(image.cloudinaryPublicId, transformations);

    res.status(200).json({ 
      originalUrl: image.cloudinarySecureUrl,
      transformedUrl: transformedUrl
    });

  } catch (error) {
    console.error('❌ Transform URL error:', error);
    res.status(500).json({ error: 'Failed to generate transformed URL' });
  }
};

module.exports = {
  syncImages,
  getPhotos,
  getImageStatsByMonth,
  getImageStatsByYear,
  getImageStatsByDay,
  getImagesByUploadedBy,
  getFirstEmailImage,
  getSecondEmailImage,
  getThirdEmailImage,
  uploadSingleImage,
  deleteImage,
  getTransformedImageUrl
};