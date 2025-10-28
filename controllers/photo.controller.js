const axios = require('axios');
const exifr = require('exifr');
const Image = require('../models/Image.model');
const SyncQueue = require('../models/SyncQueue.model'); // Queue model zaroori hai

/**
 * Helper function: Google Drive se file download karke buffer mein store karta hai.
 */
const downloadFileToBuffer = async (fileId, accessToken) => {
  const response = await axios.get(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer'
    }
  );
  return Buffer.from(response.data, 'binary');
};

/**
 * Helper function: GPS coordinates se location details (district, tehsil, etc.) nikalta hai.
 */
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
    return {};
  } catch (err) {
    console.error("❌ Geocode error:", err.message);
    return {};
  }
};


// ====================================================================
// SECTION: SYNC & BACKGROUND PROCESSING (VERCEL OPTIMIZED)
// ====================================================================

/**
 * STEP 1: Sync Trigger - User ki request par call hota hai.
 * Google Drive se file list fetch karke background processing ke liye queue banata hai.
 */
const syncImages = async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).send('Not authenticated');
  const { accessToken, email } = req.user;

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

    console.log(`✅ Fetched ${files.length} file IDs to be queued for user ${email}.`);

    for (const file of files) {
      const imageExists = await Image.findOne({ fileId: file.id });
      if (imageExists) continue;

      await SyncQueue.updateOne(
        { fileId: file.id },
        {
          $set: {
            name: file.name,
            mimeType: file.mimeType,
            createdTime: file.createdTime,
            uploadedBy: email,
            accessToken: accessToken,
            status: 'pending'
          }
        },
        { upsert: true }
      );
    }

    res.redirect(`${process.env.FRONTEND_URL}?sync=started`);
  } catch (err) {
    console.error('❌ Error starting sync:', err.message);
    res.status(500).redirect(`${process.env.FRONTEND_URL}?sync=failed`);
  }
};

/**
 * STEP 2: Queue Processor - Vercel Cron Job se har minute call hota hai.
 * Queue se chote batch mein images process karta hai.
 */
const processSyncQueue = async (req, res) => {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).send('Unauthorized');
  }

  const BATCH_LIMIT = 5; // Ek baar mein 5 images process karega to avoid timeout

  try {
    const itemsToProcess = await SyncQueue.find({ status: 'pending' }).limit(BATCH_LIMIT);
    if (itemsToProcess.length === 0) {
      return res.status(200).json({ message: 'Queue is empty.' });
    }

    console.log(`Processing ${itemsToProcess.length} items from the queue...`);

    for (const item of itemsToProcess) {
      try {
        const imageBuffer = await downloadFileToBuffer(item.fileId, item.accessToken);
        let latitude = null, longitude = null, timestamp = new Date(item.createdTime);

        try {
          const exifData = await exifr.parse(imageBuffer);
          if (exifData) {
            latitude = exifData.latitude || null;
            longitude = exifData.longitude || null;
            if (exifData.DateTimeOriginal) timestamp = new Date(exifData.DateTimeOriginal);
          }
        } catch (exifErr) { console.warn(`⚠️ EXIF error for ${item.name}:`, exifErr.message); }

        const placeDetails = (latitude && longitude) ? await getPlaceDetails(latitude, longitude) : {};

        await Image.create({
          fileId: item.fileId,
          name: item.name,
          mimeType: item.mimeType,
          imageData: imageBuffer,
          latitude,
          longitude,
          timestamp,
          uploadedBy: item.uploadedBy,
          lastCheckedAt: new Date(),
          ...placeDetails
        });

        await SyncQueue.deleteOne({ _id: item._id });
      } catch (fileErr) {
        console.error(`❌ Error processing file ${item.name}:`, fileErr.message);
        await SyncQueue.updateOne({ _id: item._id }, { $set: { status: 'failed' } });
      }
    }
    res.status(200).json({ message: `Successfully processed ${itemsToProcess.length} items.` });
  } catch (err) {
    console.error('❌ Error in queue processor:', err);
    res.status(500).json({ error: 'Queue processing failed' });
  }
};


// ====================================================================
// SECTION: DATA SERVING & STATS
// ====================================================================

/**
 * Saari photos ka metadata (image data ke bina) fetch karta hai.
 */
const getPhotos = async (req, res) => {
  try {
    const photos = await Image.find().select('-imageData').sort({ createdAt: -1 });
    res.status(200).json({ photos });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
};

/**
 * Database ID se ek single image ka binary data (file) serve karta hai.
 */
const getImageDataById = async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image || !image.imageData) {
      return res.status(404).send('Image not found');
    }
    res.set('Content-Type', image.mimeType);
    res.send(image.imageData);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Ek specific user ki saari images fetch karta hai.
 */
const getImagesByUploadedBy = async (req, res) => {
  try {
    const { uploadedBy } = req.params;
    const photos = await Image.find({ uploadedBy }).select('-imageData');
    res.status(200).json({ photos });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ... (Functions for specific emails remain the same)
const getFirstEmailImage = async (req, res) => { /* ... no change ... */ };
const getSecondEmailImage = async (req, res) => { /* ... no change ... */ };
const getThirdEmailImage = async (req, res) => { /* ... no change ... */ };

// ... (Functions for stats remain the same)
const getImageStatsByMonth = async (req, res) => { /* ... no change ... */ };
const getImageStatsByYear = async (req, res) => { /* ... no change ... */ };
const getImageStatsByDay = async (req, res) => { /* ... no change ... */ };

// ====================================================================
// SECTION: EXPORTS
// ====================================================================

module.exports = {
  // Sync and Processing
  syncImages,
  processSyncQueue,

  // Data Serving
  getPhotos,
  getImageDataById,
  getImagesByUploadedBy,

  // Specific Email Endpoints
  getFirstEmailImage,
  getSecondEmailImage,
  getThirdEmailImage,

  // Stats
  getImageStatsByMonth,
  getImageStatsByYear,
  getImageStatsByDay,
};
