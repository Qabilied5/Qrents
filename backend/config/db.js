const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('✗ MongoDB connection failed: MONGODB_URI is not set in environment variables.');
    return; // Don't exit, continue without DB
  }

  try {
    await mongoose.connect(uri);
    console.log('✓ MongoDB connected');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    console.log('⚠ Server will continue without database connection. API calls will fail.');
    // Don't exit, continue without DB
  }
};

module.exports = connectDB;
