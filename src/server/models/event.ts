import mongoose, { Schema, type Document } from 'mongoose';

export interface IEvent extends Document {
  serverId: string;
  eventName: string;
  data: Record<string, unknown>;
  socketId: string;
  timestamp: Date;
}

const eventSchema = new Schema<IEvent>({
  serverId: { type: String, required: true },
  eventName: { type: String, required: true },
  data: Schema.Types.Mixed,
  socketId: String,
  timestamp: { type: Date, default: Date.now },
}, { capped: { size: 1048576, max: 10000 } });

export const Event = mongoose.model<IEvent>('Event', eventSchema);
