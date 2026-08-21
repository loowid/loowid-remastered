import mongoose, { Schema, type Document } from 'mongoose';

export interface IStats extends Document {
  serverId: string;
  date: Date;
  roomCount: number;
  userCount: number;
  roomsByType: {
    type: string;
    count: number;
  }[];
}

const statsSchema = new Schema<IStats>({
  serverId: { type: String, required: true },
  date: { type: Date, default: Date.now },
  roomCount: { type: Number, default: 0 },
  userCount: { type: Number, default: 0 },
  roomsByType: [{
    type: String,
    count: Number,
  }],
});

statsSchema.index({ date: -1 });

export const Stats = mongoose.model<IStats>('Stats', statsSchema);
