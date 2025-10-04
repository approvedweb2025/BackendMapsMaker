const axios = require('axios');
const exifr = require('exifr');
const mongoose = require('mongoose');
const Image = require('../models/Image.model');
const { uploadBufferToGridFS, openDownloadStreamById } = require('../config/gridfs');
const cloudinary = require('cloudinary').v2;

// ✅ Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// ✅ Upload buffer to Cloudinary
const uploadBufferToCloudinary = async (buffer, filename) => {
  if (!cloudinary.config().cloud_name) return null;
  return await new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      { folder: 'maps-maker', public_id: filename ? filename.split('.').slice(0, -1).join('.') : undefined, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    upload.end(buffer);
  });
};

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

// ✅ Upload a single image, save binary in GridFS and metadata in Images collection
const uploadPhoto = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;

    // Extract EXIF if available
    let latitude = null, longitude = null, timestamp = new Date();
    try {
      if (['image/jpeg', 'image/jpg', 'image/tiff'].includes(mimeType)) {
        const exifData = await exifr.parse(fileBuffer);
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
      console.warn('EXIF parse failed:', err.message);
    }

    let placeDetails = { district: '', tehsil: '', village: '', country: '' };
    if (latitude && longitude) {
      placeDetails = await getPlaceDetails(latitude, longitude);
    }

    // Upload to Cloudinary
    let cloudResult = null;
    try {
      cloudResult = await uploadBufferToCloudinary(fileBuffer, originalName);
    } catch (e) {
      console.warn('Cloudinary upload failed:', e?.message || e);
    }

    // Upload binary to GridFS (optional redundancy)
    let fileId = null;
    try {
      fileId = await uploadBufferToGridFS({
        filename: originalName,
        contentType: mimeType,
        buffer: fileBuffer,
        metadata: {
          uploadedBy: req.user?.email || 'anonymous',
        }
      });
    } catch (e) {
      console.warn('GridFS upload failed:', e?.message || e);
    }

    // Persist metadata
    const doc = await Image.create({
      fileId: fileId ? String(fileId) : undefined,
      name: originalName,
      mimeType,
      latitude,
      longitude,
      uploadedBy: req.user?.email || 'anonymous',
      timestamp,
      lastCheckedAt: new Date(),
      cloudinaryUrl: cloudResult?.secure_url || null,
      ...placeDetails
    });

    return res.status(201).json({ message: 'Uploaded', photo: doc });
  } catch (err) {
    console.error('❌ Upload error:', err);
    return res.status(500).json({ error: 'Failed to upload image', details: err.message });
  }
};

// ✅ Stream image by id from GridFS
const streamPhoto = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const { id } = req.params;
    // Accept either ObjectId string for GridFS or Image.fileId stored as string
    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(id);
    } catch (_) {
      // if not a valid ObjectId, try to resolve from Image model
      const record = await Image.findOne({ fileId: id });
      if (!record) return res.status(404).json({ error: 'Image not found' });
      try {
        objectId = new mongoose.Types.ObjectId(record.fileId);
      } catch (e2) {
        return res.status(400).json({ error: 'Stored fileId is not a valid ObjectId' });
      }
    }

    const imageDoc = await Image.findOne({ $or: [{ fileId: id }, { fileId: String(objectId) }] });
    const contentType = imageDoc?.mimeType || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    const readStream = openDownloadStreamById(objectId);
    readStream.on('error', (e) => {
      console.error('GridFS read error:', e?.message || e);
      if (!res.headersSent) res.status(500).end();
    });
    readStream.pipe(res);
  } catch (err) {
    console.error('❌ Stream error:', err);
    return res.status(500).json({ error: 'Failed to stream image' });
  }
};

// ✅ Read metadata for a single photo
const getPhotoMeta = async (req, res) => {
  try {
    const { id } = req.params;
    const photo = await Image.findOne({ $or: [{ _id: id }, { fileId: id }] });
    if (!photo) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json({ photo });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get metadata' });
  }
};

// ✅ Sync Google Drive images → DB (Vercel compatible)
const syncImages = async (req, res) => {
  // In serverless (Vercel), sessions may not persist. Allow token via header/query/body.
  let accessToken = null;
  if (req.isAuthenticated && req.isAuthenticated()) {
    accessToken = req.user?.accessToken;
  }
  if (!accessToken) {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring('Bearer '.length);
    }
  }
  if (!accessToken) {
    accessToken = req.query.accessToken || req.body?.accessToken || null;
  }
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated. Provide Google accessToken via Authorization: Bearer <token> or ?accessToken=...' });
  }

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

    let syncedCount = 0;
    let skippedExisting = 0;
    let failedCount = 0;

    for (const file of files) {
      try {
        // Treat previously-synced docs that used Drive id as fileId as existing
        const exists = await Image.findOne({ $or: [{ fileId: file.id }, { driveFileId: file.id }] });
        if (exists) { skippedExisting += 1; continue; }

        // ✅ Download file data (serverless compatible - no temp files)
        const fileData = await downloadFile(file.id, accessToken);

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

        // 🟢 Upload to Cloudinary for CDN access
        let cloudResult = null;
        try {
          cloudResult = await uploadBufferToCloudinary(Buffer.from(fileData), file.name);
        } catch (e) {
          console.warn(`⚠️ Cloudinary upload failed for ${file.name}:`, e?.message || e);
        }

        // 🟢 Store bytes in GridFS so we can stream reliably (optional)
        let gridfsId = null;
        try {
          gridfsId = await uploadBufferToGridFS({
            filename: file.name,
            contentType: file.mimeType,
            buffer: Buffer.from(fileData),
            metadata: { source: 'google-drive', driveFileId: file.id }
          });
        } catch (upErr) {
          console.warn(`⚠️ GridFS upload failed for ${file.name}:`, upErr?.message || upErr);
        }

        await Image.create({
          fileId: gridfsId ? String(gridfsId) : file.id,
          driveFileId: file.id,
          name: file.name,
          mimeType: file.mimeType,
          latitude,
          longitude,
          timestamp,
          uploadedBy: (req.user && req.user.email) || 'google-drive',
          lastCheckedAt: new Date(),
          googleDriveUrl: `https://drive.google.com/file/d/${file.id}/view`,
          cloudinaryUrl: cloudResult?.secure_url || null,
          ...placeDetails
        });
        syncedCount += 1;

      } catch (fileErr) {
        console.error(`❌ Error processing file ${file.name}:`, fileErr);
        failedCount += 1;
      }
    }

    const result = { success: true, total: files.length, synced: syncedCount, skipped: skippedExisting, failed: failedCount };
    // Optional redirect via query: /photos/sync-images?redirect=1
    if (req.query.redirect === '1' && process.env.FRONTEND_URL) {
      return res.redirect(`${process.env.FRONTEND_URL}/home`);
    }
    return res.status(200).json(result);
  } catch (err) {
    const details = err?.response?.data || err?.message || String(err);
    console.error('❌ Sync error:', details);
    res.status(500).json({ error: 'Failed to sync images', details });
  }
};

// ✅ Migrate legacy Drive-only records into GridFS (requires Google access token)
const migrateDriveToGridFS = async (req, res) => {
  // Accept accessToken via header/query/body
  let accessToken = null;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring('Bearer '.length);
  }
  if (!accessToken) accessToken = req.query.accessToken || req.body?.accessToken || null;
  if (!accessToken) {
    return res.status(401).json({ error: 'Provide Google accessToken via Authorization: Bearer <token> or ?accessToken=...' });
  }

  try {
    // Find images whose fileId is not a valid ObjectId (likely Drive ids)
    const notObjectId = { $not: { $regex: /^[a-f0-9]{24}$/ } };
    const candidates = await Image.find({ fileId: notObjectId });

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const img of candidates) {
      const driveId = img.driveFileId || img.fileId;
      if (!driveId) { skipped += 1; continue; }

      try {
        const data = await downloadFile(driveId, accessToken);
        // Upload to Cloudinary as well
        let cloudResult = null;
        try {
          cloudResult = await uploadBufferToCloudinary(Buffer.from(data), img.name || `${driveId}.jpg`);
        } catch (e) {
          console.warn('Cloudinary upload during migration failed:', e?.message || e);
        }
        const gridId = await uploadBufferToGridFS({
          filename: img.name || `${driveId}.jpg`,
          contentType: img.mimeType || 'image/jpeg',
          buffer: Buffer.from(data),
          metadata: { source: 'migration', driveFileId: driveId }
        });

        img.driveFileId = driveId;
        img.fileId = String(gridId);
        if (cloudResult?.secure_url) img.cloudinaryUrl = cloudResult.secure_url;
        await img.save();
        migrated += 1;
      } catch (e) {
        failed += 1;
      }
    }

    return res.status(200).json({ success: true, migrated, skipped, failed, total: candidates.length });
  } catch (err) {
    const details = err?.message || String(err);
    return res.status(500).json({ error: 'Migration failed', details });
  }
};

// ✅ Get all photos
const getPhotos = async (req, res) => {
  try {
    const photos = await Image.find().sort({ createdAt: -1 });
    res.status(200).json({ photos });
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
  } catch (err) {
    console.error('Error fetching first email images:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSecondEmailImage = async (req, res) => {
  try {
    const email = 'mhuzaifa86797@gmail.com';
    const images = await Image.find({ uploadedBy: email, longitude: { $ne: null }, latitude: { $ne: null } });
    res.status(200).json(images);
  } catch (err) {
    console.error('Error fetching second email images:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getThirdEmailImage = async (req, res) => {
  try {
    const email = 'muhammadjig8@gmail.com';
    const images = await Image.find({ uploadedBy: email, longitude: { $ne: null }, latitude: { $ne: null } });
    res.status(200).json(images);
  } catch (err) {
    console.error('Error fetching third email images:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  uploadPhoto,
  streamPhoto,
  getPhotoMeta,
  syncImages,
  migrateDriveToGridFS,
  getPhotos,
  getImageStatsByMonth,
  getImageStatsByYear,
  getImageStatsByDay,
  getImagesByUploadedBy,
  getFirstEmailImage,
  getSecondEmailImage,
  getThirdEmailImage
};
