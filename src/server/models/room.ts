import mongoose, { Schema, type Document } from 'mongoose';

export interface IRoomUser {
  connectionId: string;
  name: string;
  avatar: string;
  owner: boolean;
  joinedAt: Date;
  disconnectedAt?: Date;
  muted: boolean;
  videoDisabled: boolean;
  screenDisabled: boolean;
}

export interface IChatMessage {
  senderId: string;
  senderName: string;
  text: string;
  created: Date;
}

export interface IRecording {
  id: string;
  type: 'local' | 'youtube' | 'twitch';
  filename?: string;
  url?: string;
  size?: number;
  created: Date;
}

export interface IRoomSettings {
  permanent: boolean;
  allowDownloads: boolean;
  waitingRoom: boolean;
  disableGuestMics: boolean;
  disableGuestVideo: boolean;
  disableGuestScreen: boolean;
  disableGuestChat: boolean;
  allowGuestFileSharing: boolean;
  maxParticipants: number;
}

export interface IRoom extends Document {
  roomId: string;
  ownerToken?: string;
  staticId?: string;
  owner: {
    connectionId: string;
    name: string;
    avatar: string;
  };
  users: IRoomUser[];
  chat: IChatMessage[];
  recordings: IRecording[];
  access: {
    shared: boolean;
    title: string;
    moderated: boolean;
    chat: boolean;
    locked: boolean;
    password?: string;
  };
  settings: IRoomSettings;
  status: string;
  created: Date;
  lastActive: Date;
}

const roomSchema = new Schema<IRoom>({
  roomId: { type: String, required: true, unique: true, index: true },
  ownerToken: { type: String, default: '' },
  staticId: { type: String, sparse: true },
  owner: {
    connectionId: String,
    name: String,
    avatar: String,
  },
  users: [{
    connectionId: String,
    name: String,
    avatar: String,
    owner: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
    disconnectedAt: Date,
    muted: { type: Boolean, default: false },
    videoDisabled: { type: Boolean, default: false },
    screenDisabled: { type: Boolean, default: false },
  }],
  chat: [{
    senderId: String,
    senderName: String,
    text: String,
    created: { type: Date, default: Date.now },
  }],
  recordings: [{
    id: String,
    type: { type: String, enum: ['local', 'youtube', 'twitch'] },
    filename: String,
    url: String,
    size: Number,
    created: { type: Date, default: Date.now },
  }],
  access: {
    shared: { type: Boolean, default: false },
    title: { type: String, default: '' },
    moderated: { type: Boolean, default: false },
    chat: { type: Boolean, default: true },
    locked: { type: Boolean, default: false },
    password: String,
  },
  settings: {
    permanent: { type: Boolean, default: false },
    allowDownloads: { type: Boolean, default: false },
    waitingRoom: { type: Boolean, default: false },
    disableGuestMics: { type: Boolean, default: false },
    disableGuestVideo: { type: Boolean, default: false },
    disableGuestScreen: { type: Boolean, default: false },
    disableGuestChat: { type: Boolean, default: false },
    allowGuestFileSharing: { type: Boolean, default: true },
    maxParticipants: { type: Number, default: 0 },
  },
  status: { type: String, default: 'ACTIVE' },
  created: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

roomSchema.index({ staticId: 1 }, { sparse: true });
roomSchema.index({ lastActive: -1 });

export const Room = mongoose.model<IRoom>('Room', roomSchema);
