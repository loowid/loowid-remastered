import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Room } from '../models/room.js';
import { config } from '../config.js';
import { createHmac } from 'crypto';

const router = Router();

// Ensure recordings directory exists
const recordingsDir = path.resolve(process.cwd(), 'recordings');
if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

const upload = multer({ dest: recordingsDir });

// Validation schemas
const createRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  password: z.string().max(50).optional(),
});

const joinRoomSchema = z.object({
  name: z.string().min(1).max(100),
  password: z.string().optional(),
});

const editNameSchema = z.object({
  name: z.string().min(1).max(100),
});

// Create a new room
router.post('/create', async (req, res) => {
  const parsed = createRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const roomId = nanoid(12);
  const ownerToken = nanoid(24);
  const room = await Room.create({
    roomId,
    ownerToken,
    owner: { connectionId: '', name: parsed.data.name || 'Host', avatar: '' },
    access: {
      locked: !!parsed.data.password,
      password: parsed.data.password,
    },
  });

  res.json({ roomId, ownerToken, room });
});

// Get room info
router.get('/:roomId', async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json({
    roomId: room.roomId,
    access: room.access,
    users: room.users.filter(u => !u.disconnectedAt).length,
    status: room.status,
  });
});

// Join a room
router.post('/:roomId/join', async (req, res) => {
  const parsed = joinRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  if (room.access.locked && room.access.password) {
    if (!parsed.data.password || parsed.data.password !== room.access.password) {
      res.status(403).json({ error: 'room_locked' });
      return;
    }
  }

  if (room.status !== 'ACTIVE') {
    res.status(400).json({ error: 'Room is no longer active' });
    return;
  }

  // Check room timeout
  const timeoutMs = config.roomTimeoutDays * 24 * 60 * 60 * 1000;
  if (Date.now() - room.lastActive.getTime() > timeoutMs) {
    room.status = 'EXPIRED';
    await room.save();
    res.status(400).json({ error: 'Room has expired' });
    return;
  }

  room.lastActive = new Date();
  await room.save();

  res.json({
    roomId: room.roomId,
    access: room.access,
    owner: room.owner,
    users: room.users.filter(u => !u.disconnectedAt),
  });
});

// Edit owner name
router.post('/:roomId/editName', async (req, res) => {
  const parsed = editNameSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  room.owner.name = parsed.data.name;
  await room.save();
  res.json({ name: room.owner.name });
});

// Edit room access settings
router.post('/:roomId/editShared', async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const { shared, title, moderated, chat } = req.body;
  if (shared !== undefined) room.access.shared = shared;
  if (title !== undefined) room.access.title = title;
  if (moderated !== undefined) room.access.moderated = moderated;
  if (chat !== undefined) room.access.chat = chat;
  await room.save();
  res.json({ access: room.access });
});

// Lock/unlock room
router.post('/:roomId/changeRoomStatus', async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const { locked, password } = req.body;
  if (locked !== undefined) room.access.locked = locked;
  if (password !== undefined) room.access.password = password;
  await room.save();
  res.json({ access: room.access });
});

// Get chat messages
router.get('/:roomId/chat', async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json({ chat: room.chat.slice(-100) });
});

// Get full room info (for owner)
router.get('/:roomId/info', async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json({
    roomId: room.roomId,
    access: room.access,
    settings: room.settings,
    recordings: room.recordings,
    owner: { name: room.owner.name },
    users: room.users.filter(u => !u.disconnectedAt).map(u => ({
      connectionId: u.connectionId,
      name: u.name,
      owner: u.owner,
      muted: u.muted,
      videoDisabled: u.videoDisabled,
      joinedAt: u.joinedAt,
    })),
    status: room.status,
    created: room.created,
  });
});

// Get room settings
router.get('/:roomId/settings', async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json({ settings: room.settings });
});

// Update room settings (owner only, verified via socket in signaling)
router.put('/:roomId/settings', async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const allowed = [
    'permanent', 'allowDownloads', 'waitingRoom',
    'disableGuestMics', 'disableGuestVideo', 'disableGuestScreen', 'disableGuestChat', 'allowGuestFileSharing', 'maxParticipants',
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      (room.settings as unknown as Record<string, unknown>)[key] = req.body[key];
    }
  }
  await room.save();
  res.json({ settings: room.settings });
});

// Delete a recording
router.delete('/:roomId/recordings/:recordingId', async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  room.recordings = room.recordings.filter(r => r.id !== req.params.recordingId);
  await room.save();
  res.json({ recordings: room.recordings });
});

// Upload a recording
router.post('/:roomId/recordings', upload.single('recording'), async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = req.file.filename;
  const url = `/recordings/${filename}`;

  const recording = {
    id,
    type: 'local' as const,
    filename: req.file.originalname || `${id}.webm`,
    url,
    size: req.file.size,
    created: new Date(),
  };

  room.recordings.push(recording);
  await room.save();

  res.json({ recording });
});

// Check if room is joinable
router.post('/:roomId/isJoinable', async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) {
    res.json({ joinable: false, error: 'Room not found' });
    return;
  }
  res.json({
    joinable: room.status === 'ACTIVE',
    locked: room.access.locked,
    waitingRoom: room.settings.waitingRoom,
  });
});

// Get TURN credentials
router.get('/config/ice', (_req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  if (config.coturn.server && config.coturn.authSecret && config.coturn.authUsername) {
    const hours = config.coturn.authHours;
    const unixTimeStamp = Math.floor(Date.now() / 1000) + hours * 3600;
    const username = `${unixTimeStamp}:${config.coturn.authUsername}`;
    const hmac = createHmac('sha1', config.coturn.authSecret);
    hmac.update(username);
    const password = hmac.digest('base64');

    const turnServer = {
      urls: `turn:${config.coturn.server}`,
      username,
      credential: password,
    };

    if (config.coturn.exclusive) {
      res.json({ iceServers: [turnServer], chromeDesktopExtensionId: config.chromeExtensionId });
    } else {
      iceServers.push(turnServer);
      res.json({ iceServers, chromeDesktopExtensionId: config.chromeExtensionId });
    }
  } else {
    res.json({ iceServers, chromeDesktopExtensionId: config.chromeExtensionId });
  }
});

export { router as roomsRouter };
