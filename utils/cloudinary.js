const cloudinary = require('../config/cloudinary');
const axios = require('axios');

/**
 * Upload image buffer to Cloudinary
 * @param {Buffer} imageBuffer - Image data as buffer
 * @param {string} fileName - Original file name
 * @param {Object} options - Additional upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadImageToCloudinary = async (imageBuffer, fileName, options = {}) => {
  try {
    const uploadOptions = {
      resource_type: 'auto',
      folder: 'maps-maker', // Organize images in a folder
      public_id: fileName.replace(/\.[^/.]+$/, ""), // Remove file extension
      overwrite: false,
      ...options
    };

    const result = await cloudinary.uploader.upload(
      `data:${options.mimeType || 'image/jpeg'};base64,${imageBuffer.toString('base64')}`,
      uploadOptions
    );

    return {
      success: true,
      data: {
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      }
    };
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Upload image from URL to Cloudinary
 * @param {string} imageUrl - URL of the image to upload
 * @param {string} fileName - Desired file name
 * @param {Object} options - Additional upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadImageFromUrl = async (imageUrl, fileName, options = {}) => {
  try {
    const uploadOptions = {
      resource_type: 'auto',
      folder: 'maps-maker',
      public_id: fileName.replace(/\.[^/.]+$/, ""),
      overwrite: false,
      ...options
    };

    const result = await cloudinary.uploader.upload(imageUrl, uploadOptions);

    return {
      success: true,
      data: {
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      }
    };
  } catch (error) {
    console.error('❌ Cloudinary upload from URL error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Deletion result
 */
const deleteImageFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    
    return {
      success: result.result === 'ok',
      data: result
    };
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get image details from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Image details
 */
const getImageDetails = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('❌ Cloudinary get details error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generate Cloudinary URL with transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} transformations - Cloudinary transformations
 * @returns {string} Transformed URL
 */
const generateTransformedUrl = (publicId, transformations = {}) => {
  return cloudinary.url(publicId, transformations);
};

/**
 * Download image from Google Drive and convert to buffer
 * @param {string} fileId - Google Drive file ID
 * @param {string} accessToken - Google Drive access token
 * @returns {Promise<Buffer>} Image buffer
 */
const downloadImageFromGoogleDrive = async (fileId, accessToken) => {
  try {
    const response = await axios.get(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { 
        headers: { Authorization: `Bearer ${accessToken}` }, 
        responseType: 'arraybuffer' 
      }
    );
    return Buffer.from(response.data);
  } catch (error) {
    console.error('❌ Google Drive download error:', error);
    throw error;
  }
};

module.exports = {
  uploadImageToCloudinary,
  uploadImageFromUrl,
  deleteImageFromCloudinary,
  getImageDetails,
  generateTransformedUrl,
  downloadImageFromGoogleDrive
};
