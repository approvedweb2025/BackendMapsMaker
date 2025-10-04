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

const createFoldersAndOrganize = async () => {
  try {
    console.log('🔄 Creating Cloudinary folders and organizing images...\n');
    
    if (!cloudinary.config().cloud_name) {
      throw new Error('Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
    }

    // Step 1: Get all images from database
    console.log('📊 Getting images from database...');
    const allImages = await Image.find({});
    console.log(`   Found ${allImages.length} total images in database`);
    
    // Step 2: Process each email
    for (const [email, folderName] of Object.entries(emailMappings)) {
      console.log(`\n🔄 Processing ${email} -> ${folderName}...`);
      
      // Get images for this email from database
      const emailImages = allImages.filter(img => img.uploadedBy === email);
      console.log(`   📊 Found ${emailImages.length} images for ${email}`);
      
      if (emailImages.length === 0) {
        console.log(`   ⚠️  No images found for ${email} in database`);
        continue;
      }
      
      // Process each image
      let moved = 0;
      let errors = 0;
      
      for (const img of emailImages) {
        try {
          if (!img.cloudinaryUrl) {
            console.log(`   ⚠️  Skipping ${img.name} - no Cloudinary URL`);
            continue;
          }
          
          // Extract current public_id from URL
          const urlParts = img.cloudinaryUrl.split('/');
          const currentPublicId = urlParts[urlParts.length - 1].split('.')[0];
          
          // Create new public_id in the correct folder
          const newPublicId = `maps-maker/${folderName}/${folderName}_${Date.now()}_${currentPublicId}`;
          
          // Move the image to the new folder
          await cloudinary.uploader.rename(currentPublicId, newPublicId);
          
          // Update the database with new URL
          const newUrl = img.cloudinaryUrl.replace(currentPublicId, newPublicId);
          await Image.updateOne(
            { _id: img._id },
            { cloudinaryUrl: newUrl }
          );
          
          console.log(`   ✅ Moved: ${img.name}`);
          moved++;
          
        } catch (moveError) {
          console.error(`   ❌ Error moving ${img.name}:`, moveError.message);
          errors++;
        }
      }
      
      console.log(`   📊 Results for ${email}: ${moved} moved, ${errors} errors`);
    }
    
    // Step 3: Verify folders were created
    console.log('\n🔍 Verifying folders...');
    for (const [email, folderName] of Object.entries(emailMappings)) {
      try {
        const result = await cloudinary.search
          .expression(`folder:maps-maker/${folderName}`)
          .max_results(10)
          .execute();
        
        console.log(`   📁 maps-maker/${folderName}: ${result.resources.length} images`);
      } catch (err) {
        console.log(`   ❌ Error checking ${folderName}: ${err.message}`);
      }
    }
    
    console.log('\n🎉 Folder creation and organization completed!');
    
  } catch (error) {
    console.error('❌ Organization failed:', error);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await createFoldersAndOrganize();
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
};

if (require.main === module) {
  main();
}

module.exports = { createFoldersAndOrganize };
