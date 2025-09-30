// Environment variable validation for Vercel deployment
const requiredEnvVars = [
  'MONGO_URI',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'CALLBACK_URL',
  'GOOGLE_GEOCODING_API_KEY',
  'FRONTEND_URL',
  'SESSION_SECRET'
];

const optionalEnvVars = [
  'JWT_SECRET',
  'NODE_ENV',
  'VERCEL'
];

function validateEnvironmentVariables() {
  const missing = [];
  const warnings = [];

  // Check required variables
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  // Check optional variables and provide warnings
  optionalEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  });

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease set these variables in your Vercel dashboard under Settings > Environment Variables');
    
    if (process.env.VERCEL === '1') {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Optional environment variables not set:');
    warnings.forEach(varName => {
      console.warn(`   - ${varName}`);
    });
  }

  // Validate specific formats
  if (process.env.MONGO_URI && !process.env.MONGO_URI.startsWith('mongodb')) {
    console.error('❌ MONGO_URI should start with "mongodb://" or "mongodb+srv://"');
  }

  if (process.env.CALLBACK_URL && !process.env.CALLBACK_URL.startsWith('http')) {
    console.error('❌ CALLBACK_URL should be a valid URL starting with "http://" or "https://"');
  }

  if (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.startsWith('http')) {
    console.error('❌ FRONTEND_URL should be a valid URL starting with "http://" or "https://"');
  }

  console.log('✅ Environment validation completed');
  return { missing, warnings };
}

function getEnvironmentInfo() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    isVercel: process.env.VERCEL === '1',
    hasMongoUri: !!process.env.MONGO_URI,
    hasGoogleConfig: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    hasGeocodingKey: !!process.env.GOOGLE_GEOCODING_API_KEY,
    hasFrontendUrl: !!process.env.FRONTEND_URL,
    hasSessionSecret: !!process.env.SESSION_SECRET
  };
}

module.exports = {
  validateEnvironmentVariables,
  getEnvironmentInfo,
  requiredEnvVars,
  optionalEnvVars
};
