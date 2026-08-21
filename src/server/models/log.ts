import mongoose, { Schema, type Document } from 'mongoose';

export interface ILog extends Document {
  serverId: string;
  timestamp: Date;
  sessionId: string;
  ip: string;
  method: string;
  url: string;
  status: number;
  contentLength: string;
  responseTime: string;
}

const logSchema = new Schema<ILog>({
  serverId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  sessionId: String,
  ip: String,
  method: String,
  url: String,
  status: Number,
  contentLength: String,
  responseTime: String,
}, {
  timestamps: false,
});

logSchema.index({ timestamp: -1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const Log = mongoose.model<ILog>('Log', logSchema);
