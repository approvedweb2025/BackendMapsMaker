const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const Image = require('./models/Image.model');

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mapsmaker');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Email to folder mapping
const emailMappings = {
  'mhuzaifa8519@gmail.com': 'first-email',
  'mhuzaifa86797@gmail.com': 'second-email', 
  'muhammadjig8@gmail.com': 'third-email'
};

// Function to create Cloudinary folders and organize images
const organizeCloudinaryImages = async () => {
  try {
    console.log('🔄 Starting Cloudinary image organization...');
    
    if (!cloudinary.config().cloud_name) {
      throw new Error('Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
    }

    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    // Process each email/folder
    for (const [email, folderName] of Object.entries(emailMappings)) {
      console.log(`\n🔄 Processing ${email} -> ${folderName} folder...`);
      
      try {
        // 1. Get all images from Cloudinary in the specific folder
        const cloudinaryImages = await getImagesFromCloudinaryFolder(folderName);
        console.log(`📊 Found ${cloudinaryImages.length} images in Cloudinary folder: ${folderName}`);
        
        // 2. Get existing database records for this email
        const existingImages = await Image.find({ uploadedBy: email });
        console.log(`📊 Found ${existingImages.length} existing database records for ${email}`);
        
        // 3. Process each Cloudinary image
        for (const cloudImg of cloudinaryImages) {
          try {
            // Check if image already exists in database
            let existingImage = existingImages.find(dbImg => 
              dbImg.cloudinaryUrl === cloudImg.cloudinaryUrl || 
              dbImg.fileId === cloudImg.fileId
            );
            
            if (existingImage) {
              // Update existing record
              await Image.updateOne(
                { _id: existingImage._id },
                {
                  cloudinaryUrl: cloudImg.cloudinaryUrl,
                  name: cloudImg.name,
                  timestamp: cloudImg.timestamp,
                  fileId: cloudImg.fileId
                }
              );
              console.log(`✅ Updated existing image: ${cloudImg.name}`);
              totalUpdated++;
            } else {
              // Create new record
              await Image.create({
                fileId: cloudImg.fileId,
                name: cloudImg.name,
                cloudinaryUrl: cloudImg.cloudinaryUrl,
                uploadedBy: email,
                timestamp: cloudImg.timestamp,
                lastCheckedAt: new Date(),
                // Add default location data if not available
                latitude: null,
                longitude: null,
                district: 'Unknown',
                village: 'Unknown',
                tehsil: 'Unknown',
                country: 'Unknown'
              });
              console.log(`✅ Created new image record: ${cloudImg.name}`);
              totalCreated++;
            }
            
            totalProcessed++;
          } catch (imgError) {
            console.error(`❌ Error processing image ${cloudImg.name}:`, imgError.message);
            totalErrors++;
          }
        }
        
        console.log(`✅ Completed ${folderName}: ${cloudinaryImages.length} images processed`);
        
      } catch (folderError) {
        console.error(`❌ Error processing folder ${folderName}:`, folderError.message);
        totalErrors++;
      }
    }
    
    console.log('\n🎯 Organization Summary:');
    console.log(`📊 Total images processed: ${totalProcessed}`);
    console.log(`✅ New records created: ${totalCreated}`);
    console.log(`🔄 Records updated: ${totalUpdated}`);
    console.log(`❌ Errors: ${totalErrors}`);
    
    return {
      success: true,
      totalProcessed,
      totalCreated,
      totalUpdated,
      totalErrors
    };
    
  } catch (error) {
    console.error('❌ Organization failed:', error);
    throw error;
  }
};

// Function to get images from a specific Cloudinary folder
const getImagesFromCloudinaryFolder = async (folderName) => {
  try {
    const result = await cloudinary.search
      .expression(`folder:maps-maker/${folderName}`)
      .sort_by([['created_at', 'desc']])
      .max_results(500)
      .execute();
    
    return result.resources.map(resource => ({
      fileId: resource.public_id,
      cloudinaryUrl: resource.secure_url,
      name: resource.public_id.split('/').pop(),
      timestamp: new Date(resource.created_at)
    }));
  } catch (err) {
    console.error(`Error fetching images from Cloudinary folder ${folderName}:`, err);
    return [];
  }
};

// Function to create folders if they don't exist
const createCloudinaryFolders = async () => {
  try {
    console.log('🔄 Creating Cloudinary folders...');
    
    for (const [email, folderName] of Object.entries(emailMappings)) {
      // Check if folder exists by searching for images in it
      const result = await cloudinary.search
        .expression(`folder:maps-maker/${folderName}`)
        .max_results(1)
        .execute();
      
      if (result.resources.length === 0) {
        console.log(`📁 Creating folder: maps-maker/${folderName}`);
        // Upload a placeholder image to create the folder
        const placeholderResult = await cloudinary.uploader.upload(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          {
            folder: `maps-maker/${folderName}`,
            public_id: `${folderName}_placeholder`,
            resource_type: 'image'
          }
        );
        console.log(`✅ Created folder: maps-maker/${folderName}`);
      } else {
        console.log(`✅ Folder already exists: maps-maker/${folderName}`);
      }
    }
  } catch (error) {
    console.error('❌ Error creating folders:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    
    console.log('🚀 Starting Cloudinary image organization...');
    
    // Step 1: Create folders if they don't exist
    await createCloudinaryFolders();
    
    // Step 2: Organize images
    const result = await organizeCloudinaryImages();
    
    console.log('\n🎉 Organization completed successfully!');
    console.log('📊 Results:', result);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  organizeCloudinaryImages,
  createCloudinaryFolders,
  getImagesFromCloudinaryFolder
};
