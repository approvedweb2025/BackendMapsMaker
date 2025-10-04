const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const Image = require('./models/Image.model');

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
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

const createFoldersAndOrganize = async () => {
  try {
    console.log('🔄 Creating Cloudinary folders dynamically by email...\n');

    if (!cloudinary.config().cloud_name) {
      throw new Error('Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
    }

    // Step 1: Fetch all images in general folder
    console.log('📊 Fetching images from Cloudinary general folder...');
    const generalImages = await cloudinary.search
      .expression('folder:maps-maker/general')
      .sort_by('created_at', 'desc')
      .max_results(500)
      .execute();

    if (!generalImages.resources.length) {
      console.log('⚠️ No images found in maps-maker/general folder.');
      return;
    }

    console.log(`   Found ${generalImages.resources.length} images in general folder`);

    // Step 2: Fetch all images from DB
    const allDbImages = await Image.find({});
    console.log(`📊 Found ${allDbImages.length} images in database`);

    if (!allDbImages.length) {
      console.log('⚠️ No database images found.');
      return;
    }

    // Step 3: Group images by email
    const groupedByEmail = {};
    for (const img of allDbImages) {
      if (!img.uploadedBy) continue;
      if (!groupedByEmail[img.uploadedBy]) groupedByEmail[img.uploadedBy] = [];
      groupedByEmail[img.uploadedBy].push(img);
    }

    const emails = Object.keys(groupedByEmail);
    console.log(`📧 Found ${emails.length} unique email(s):`, emails);

    // Step 4: Process each email
    for (const email of emails) {
      const folderName = email.replace(/[@.]/g, '_'); // sanitize folder name
      const emailImages = groupedByEmail[email];

      console.log(`\n🔄 Processing ${email} -> maps-maker/${folderName}`);
      console.log(`   📊 Found ${emailImages.length} images for ${email}`);

      let moved = 0;
      let errors = 0;

      for (const dbImg of emailImages) {
        if (!dbImg.cloudinaryUrl) continue;

        const cloudinaryImg = generalImages.resources.find(
          (res) =>
            res.secure_url === dbImg.cloudinaryUrl ||
            res.public_id.includes(dbImg.name) ||
            dbImg.name.includes(res.public_id.split('/').pop())
        );

        if (!cloudinaryImg) continue;

        try {
          const currentPublicId = cloudinaryImg.public_id;
          const newPublicId = `maps-maker/${folderName}/${folderName}_${Date.now()}_${cloudinaryImg.public_id.split('/').pop()}`;

          // Move image to new folder
          await cloudinary.uploader.rename(currentPublicId, newPublicId);

          // Update Cloudinary URL in DB
          const newUrl = cloudinaryImg.secure_url.replace(currentPublicId, newPublicId);
          await Image.updateOne({ _id: dbImg._id }, { cloudinaryUrl: newUrl });

          console.log(`   ✅ Moved: ${dbImg.name}`);
          moved++;
        } catch (err) {
          console.error(`   ❌ Error moving ${dbImg.name}:`, err.message);
          errors++;
        }
      }

      console.log(`   📦 ${moved} images moved, ${errors} errors for ${email}`);
    }

    // Step 5: Verify new folders
    console.log('\n🔍 Verifying new folders...');
    for (const email of emails) {
      const folderName = email.replace(/[@.]/g, '_');
      try {
        const res = await cloudinary.search.expression(`folder:maps-maker/${folderName}`).max_results(5).execute();
        console.log(`   📁 maps-maker/${folderName}: ${res.resources.length} images`);
      } catch (err) {
        console.log(`   ❌ Error verifying folder ${folderName}: ${err.message}`);
      }
    }

    console.log('\n🎉 Dynamic folder creation & organization completed successfully!');
  } catch (error) {
    console.error('❌ Organization failed:', error);
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
