import mongoose from 'mongoose';
import { config } from './config.js';

export async function connectDB(): Promise<typeof mongoose> {
  const conn = await mongoose.connect(config.mongodbUri);
  console.log(`[db] Connected to ${config.mongodbUri}`);
  return conn;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  console.log('[db] Disconnected');
}
