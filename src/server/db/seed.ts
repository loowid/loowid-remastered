import { connectDB, disconnectDB } from '../db.js';
import { Room } from '../models/room.js';

async function seed() {
  await connectDB();

  const existingRooms = await Room.countDocuments();
  if (existingRooms > 0) {
    console.log(`[seed] ${existingRooms} rooms already exist, skipping seed.`);
  } else {
    console.log('[seed] No rooms found, database is clean.');
  }

  console.log('[seed] Done.');
  await disconnectDB();
}

seed().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
