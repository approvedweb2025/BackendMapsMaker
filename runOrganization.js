#!/usr/bin/env node

const dotenv = require('dotenv');
const { organizeCloudinaryImages, createCloudinaryFolders } = require('./organizeCloudinaryImages');

// Load environment variables
dotenv.config();

const main = async () => {
  try {
    console.log('🚀 Starting Cloudinary Image Organization...');
    console.log('📁 Creating folders and organizing images...');
    
    // Step 1: Create folders
    await createCloudinaryFolders();
    
    // Step 2: Organize images
    const result = await organizeCloudinaryImages();
    
    console.log('\n🎉 Organization completed successfully!');
    console.log('📊 Final Results:');
    console.log(`   ✅ Total processed: ${result.totalProcessed}`);
    console.log(`   🆕 New records: ${result.totalCreated}`);
    console.log(`   🔄 Updated records: ${result.totalUpdated}`);
    console.log(`   ❌ Errors: ${result.totalErrors}`);
    
    if (result.totalErrors > 0) {
      console.log('\n⚠️  Some errors occurred. Check the logs above for details.');
    }
    
  } catch (error) {
    console.error('❌ Organization failed:', error.message);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}
