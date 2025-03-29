import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(
      `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@localhost:27017/${process.env.MONGO_DB}?authSource=admin`
    );
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('Connection error:', error);
    process.exit(1);
  }
};

export default connectDB;
