import { Server as SocketIOServer, type Socket } from 'socket.io';
import { type Server as HttpServer } from 'http';
import { createHmac } from 'crypto';
import { Room } from './models/room.js';
import { config } from './config.js';

interface RoomState {
  peers: Map<string, string>; // socketId -> roomId
  status: Record<string, Record<string, unknown>>;
}

const rooms = new Map<string, RoomState>();
const socketToRoom = new Map<string, string>();

function getRoom(roomId: string): RoomState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { peers: new Map(), status: {} });
  }
  return rooms.get(roomId)!;
}

function broadcastToRoom(io: SocketIOServer, roomId: string, event: string, data: unknown, excludeSocketId?: string) {
  const roomState = rooms.get(roomId);
  if (!roomState) return;
  for (const socketId of roomState.peers.keys()) {
    if (socketId !== excludeSocketId) {
      io.to(socketId).emit(event, data);
    }
  }
}

export function setupSocketIO(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 25000,
    pingTimeout: 6000,
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[ws] Client connected: ${socket.id}`);

    // --- ICE Server Configuration ---
    socket.on('update_server_config', () => {
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
          iceServers.length = 0;
          iceServers.push(turnServer);
        } else {
          iceServers.push(turnServer);
        }
      }

      socket.emit('get_updated_config', {
        iceServers,
        chromeDesktopExtensionId: config.chromeExtensionId,
      });
    });

    // --- Room Management ---
    socket.on('join_room', async (data: { room: string; pwd?: string; name?: string; ownerToken?: string }) => {
      const { room: roomId, pwd, name, ownerToken } = data;

      const dbRoom = await Room.findOne({ roomId });
      if (!dbRoom) {
        socket.emit('room_error', { error: 'Room not found' });
        return;
      }

      // Check lock/password
      if (dbRoom.access.locked) {
        if (dbRoom.access.password && dbRoom.access.password !== pwd) {
          socket.emit('password_failed', { room: roomId });
          return;
        }
      }

      const roomState = getRoom(roomId);

      // Determine if this user should be the owner:
      const isTokenOwner = !!(ownerToken && dbRoom.ownerToken && ownerToken === dbRoom.ownerToken);
      const currentOwnerId = dbRoom.owner.connectionId;
      const isOwnerActive = currentOwnerId && roomState.peers.has(currentOwnerId);
      const isOwner = isTokenOwner || !isOwnerActive;

      if (isOwner) {
        dbRoom.owner.connectionId = socket.id;
        dbRoom.owner.name = name || 'Host';
        if (!dbRoom.ownerToken && ownerToken) {
          dbRoom.ownerToken = ownerToken;
        }
      }

      // --- maxParticipants enforcement ---
      const activeCount = Array.from(roomState.peers.keys()).length;
      if (dbRoom.settings.maxParticipants > 0 && activeCount >= dbRoom.settings.maxParticipants && !isOwner) {
        socket.emit('room_error', { error: 'Room is full' });
        return;
      }

      // Track user in DB (always track, even for waiting room)
      dbRoom.users = dbRoom.users.filter(u => u.connectionId !== socket.id);
      dbRoom.users.push({
        connectionId: socket.id,
        name: name || `User-${socket.id.slice(0, 4)}`,
        avatar: '',
        owner: isOwner,
        joinedAt: new Date(),
        muted: false,
        videoDisabled: false,
        screenDisabled: false,
      });
      dbRoom.lastActive = new Date();
      await dbRoom.save();

      // --- waitingRoom enforcement: check BEFORE adding to active peers ---
      if (dbRoom.settings.waitingRoom && !isOwner) {
        socketToRoom.set(socket.id, roomId);
        socket.emit('waiting_room_entered', { room: roomId });
        // Notify owner about waiting user
        if (dbRoom.owner.connectionId) {
          io.to(dbRoom.owner.connectionId).emit('waiting_room_user', {
            userId: socket.id,
            name: name || `User-${socket.id.slice(0, 4)}`,
          });
        }
        console.log(`[ws] ${socket.id} (${name}) entered waiting room for ${roomId}`);
        return;
      }

      // --- Normal join ---
      roomState.peers.set(socket.id, roomId);
      socketToRoom.set(socket.id, roomId);

      const peerInfos = dbRoom.users
        .filter(u => !u.disconnectedAt && u.connectionId !== socket.id)
        .map(u => ({
          id: u.connectionId,
          name: u.name,
          isOwner: u.owner,
          muted: u.muted,
          videoDisabled: u.videoDisabled,
          screenDisabled: u.screenDisabled,
        }));

      const connections = Array.from(roomState.peers.keys()).filter(id => id !== socket.id);
      socket.emit('get_peers', {
        connections,
        peerInfos,
        you: socket.id,
        isOwner: isOwner,
        ownerToken: isOwner ? dbRoom.ownerToken : undefined,
        settings: dbRoom.settings,
      });

      for (const peerId of connections) {
        io.to(peerId).emit('new_peer_connected', {
          socketId: socket.id,
          name: name || `User-${socket.id.slice(0, 4)}`,
          isOwner: isOwner
        });
      }

      // --- Enforce guest restrictions on join ---
      if (!isOwner) {
        if (dbRoom.settings.disableGuestMics) {
          socket.emit('block_mic', { by: 'system' });
        }
        if (dbRoom.settings.disableGuestVideo) {
          socket.emit('block_camera', { by: 'system' });
        }
        if (dbRoom.settings.disableGuestScreen) {
          socket.emit('block_screen', { by: 'system' });
        }
      }

      console.log(`[ws] ${socket.id} (${name}) joined room ${roomId} as ${isOwner ? 'OWNER' : 'GUEST'} (${roomState.peers.size} peers)`);
    });

    // --- User media state broadcast ---
    socket.on('user_media_state', (data: { room: string; micOn?: boolean; videoOn?: boolean; screenOn?: boolean }) => {
      broadcastToRoom(io, data.room, 'peer_media_state_changed', {
        userId: socket.id,
        micOn: data.micOn,
        videoOn: data.videoOn,
        screenOn: data.screenOn,
      }, socket.id);
    });

    // --- WebRTC Signaling ---
    socket.on('send_offer', (data: { socketId: string; sdp: unknown; mediatype: string; requestId?: string; token?: string }) => {
      io.to(data.socketId).emit('receive_offer', {
        sdp: data.sdp,
        socketId: socket.id,
        mediatype: data.mediatype,
        requestId: data.requestId,
        token: data.token,
      });
    });

    socket.on('send_answer', (data: { socketId: string; sdp: unknown; mediatype: string }) => {
      io.to(data.socketId).emit('receive_answer', {
        sdp: data.sdp,
        socketId: socket.id,
        mediatype: data.mediatype,
      });
    });

    socket.on('send_ice_candidate', (data: { socketId: string; candidate: unknown; label: string; mediatype: string; produced: boolean }) => {
      io.to(data.socketId).emit('receive_ice_candidate', {
        candidate: data.candidate,
        label: data.label,
        socketId: socket.id,
        mediatype: data.mediatype,
        produced: data.produced,
      });
    });

    // --- Media Stream Control ---
    socket.on('stream_closed', (data: { mediatype: string }) => {
      const roomId = socketToRoom.get(socket.id);
      if (roomId) {
        broadcastToRoom(io, roomId, 'stream_closed', {
          connectionId: socket.id,
          mediatype: data.mediatype,
        }, socket.id);
      }
    });

    socket.on('ask_for_sharing', (data: { connectionId: string; source: string; room: string }) => {
      io.to(data.connectionId).emit('share_request', {
        source: data.source,
        id: socket.id,
      });
    });

    socket.on('ask_for_stop_sharing', (data: { connectionId: string; source: string; room: string }) => {
      io.to(data.connectionId).emit('stop_request', {
        connectionId: socket.id,
        source: data.source,
      });
    });

    // --- Chat ---
    socket.on('chat_message', async (data: { text: string; room: string }) => {
      const dbRoom = await Room.findOne({ roomId: data.room });
      if (!dbRoom || !dbRoom.access.chat) return;

      const user = dbRoom.users.find(u => u.connectionId === socket.id);
      if (!user) return;

      // Guest chat disabled?
      if (!user.owner && dbRoom.settings.disableGuestChat) {
        socket.emit('chat_blocked', { reason: 'Chat is disabled for guests' });
        return;
      }

      const message = {
        senderId: socket.id,
        senderName: user.name || 'Anonymous',
        text: data.text,
        created: new Date(),
      };
      dbRoom.chat.push(message);
      if (dbRoom.chat.length > 500) dbRoom.chat = dbRoom.chat.slice(-500);
      await dbRoom.save();

      broadcastToRoom(io, data.room, 'chat_message', {
        text: data.text,
        id: socket.id,
        name: message.senderName,
        time: message.created,
      }, socket.id);
    });

    socket.on('chat_typing', (data: { room: string }) => {
      broadcastToRoom(io, data.room, 'chat_typing', {
        id: socket.id,
        time: new Date(),
      }, socket.id);
    });

    // --- File Transfer Signaling ---
    socket.on('ask_for_accept_files', (data: { connectionId: string; filesinfo: unknown; requestId: string; room: string; senderName?: string }) => {
      io.to(data.connectionId).emit('request_for_accept_files', {
        requestId: data.requestId,
        files: data.filesinfo,
        id: socket.id,
        senderName: data.senderName,
      });
    });

    socket.on('accept_files_request', (data: { connectionId: string; requestId: string; token: string; room: string }) => {
      io.to(data.connectionId).emit('files accepted', {
        requestId: data.requestId,
        token: data.token,
        id: socket.id,
      });
    });

    socket.on('decline_files_request', (data: { connectionId: string; requestId: string; room: string }) => {
      io.to(data.connectionId).emit('files declined', {
        requestId: data.requestId,
        id: socket.id,
      });
    });

    socket.on('file_download_completed', (data: { connectionId: string; requestId: string; fileid: string; token: string; room: string }) => {
      io.to(data.connectionId).emit('file downloaded', {
        requestId: data.requestId,
        fileid: data.fileid,
        token: data.token,
        id: socket.id,
      });
    });

    socket.on('files_request_completed', (data: { connectionId: string; requestId: string; token: string; room: string }) => {
      io.to(data.connectionId).emit('files request completed', {
        requestId: data.requestId,
        token: data.token,
        id: socket.id,
      });
    });

    socket.on('files_request_error', (data: { connectionId: string; requestId: string; token: string; error: string; room: string }) => {
      io.to(data.connectionId).emit('files request error', {
        requestId: data.requestId,
        token: data.token,
        id: socket.id,
        error: data.error,
      });
    });

    socket.on('file_canceled', (data: { connectionId: string; requestId: string; fileid: string; token: string; direction: string; room: string }) => {
      io.to(data.connectionId).emit('file canceled', {
        requestId: data.requestId,
        fileid: data.fileid,
        token: data.token,
        id: socket.id,
        direction: data.direction,
      });
    });

    // --- Owner Data ---
    socket.on('update_owner_data', (data: { ownerName: string; ownerAvatar: string; status: string; room: string; access: unknown }) => {
      broadcastToRoom(io, data.room, 'owner_data_updated', {
        ownerName: data.ownerName,
        ownerAvatar: data.ownerAvatar,
        status: data.status,
        ownerCid: socket.id,
        access: data.access,
      }, socket.id);
    });

    // --- Owner: Force mute a guest (Mode A - one-time, does NOT block) ---
    socket.on('owner_force_mute', (data: { targetId: string; room: string }) => {
      io.to(data.targetId).emit('force_mute', { by: socket.id });
      broadcastToRoom(io, data.room, 'peer_media_state_changed', { userId: data.targetId, micOn: false });
    });

    // --- Owner: Force camera off a guest (Mode A - one-time, does NOT block) ---
    socket.on('owner_force_camera_off', (data: { targetId: string; room: string }) => {
      io.to(data.targetId).emit('force_camera_off', { by: socket.id });
      broadcastToRoom(io, data.room, 'peer_media_state_changed', { userId: data.targetId, videoOn: false });
    });

    // --- Owner: Force screen stop a guest (Mode A - one-time, does NOT block) ---
    socket.on('owner_force_screen_stop', (data: { targetId: string; room: string }) => {
      io.to(data.targetId).emit('force_screen_stop', { by: socket.id });
      broadcastToRoom(io, data.room, 'peer_media_state_changed', { userId: data.targetId, screenOn: false });
    });

    // --- Owner: Block a guest's mic (Mode B - off + block) ---
    socket.on('owner_block_mic', async (data: { targetId: string; room: string }) => {
      const dbRoom = await Room.findOne({ roomId: data.room });
      if (!dbRoom || dbRoom.owner.connectionId !== socket.id) return;
      const user = dbRoom.users.find(u => u.connectionId === data.targetId);
      if (user) { user.muted = true; await dbRoom.save(); }
      io.to(data.targetId).emit('block_mic', { by: socket.id });
      broadcastToRoom(io, data.room, 'peer_media_state_changed', { userId: data.targetId, micOn: false, muted: true });
    });

    // --- Owner: Unblock a guest's mic (Mode B - unblock only, does NOT turn on) ---
    socket.on('owner_unblock_mic', async (data: { targetId: string; room: string }) => {
      const dbRoom = await Room.findOne({ roomId: data.room });
      if (!dbRoom || dbRoom.owner.connectionId !== socket.id) return;
      const user = dbRoom.users.find(u => u.connectionId === data.targetId);
      if (user) { user.muted = false; await dbRoom.save(); }
      io.to(data.targetId).emit('allow_unmute', { by: socket.id });
      broadcastToRoom(io, data.room, 'peer_media_state_changed', { userId: data.targetId, muted: false });
    });

    // --- Owner: Block a guest's camera (Mode B - off + block) ---
    socket.on('owner_block_camera', async (data: { targetId: string; room: string }) => {
      const dbRoom = await Room.findOne({ roomId: data.room });
      if (!dbRoom || dbRoom.owner.connectionId !== socket.id) return;
      const user = dbRoom.users.find(u => u.connectionId === data.targetId);
      if (user) { user.videoDisabled = true; await dbRoom.save(); }
      io.to(data.targetId).emit('block_camera', { by: socket.id });
      broadcastToRoom(io, data.room, 'peer_media_state_changed', { userId: data.targetId, videoOn: false, videoDisabled: true });
    });

    // --- Owner: Unblock a guest's camera (Mode B - unblock only, does NOT turn on) ---
    socket.on('owner_unblock_camera', async (data: { targetId: string; room: string }) => {
      const dbRoom = await Room.findOne({ roomId: data.room });
      if (!dbRoom || dbRoom.owner.connectionId !== socket.id) return;
      const user = dbRoom.users.find(u => u.connectionId === data.targetId);
      if (user) { user.videoDisabled = false; await dbRoom.save(); }
      io.to(data.targetId).emit('allow_camera_on', { by: socket.id });
      broadcastToRoom(io, data.room, 'peer_media_state_changed', { userId: data.targetId, videoDisabled: false });
    });

    // --- Owner: Block a guest's screen (Mode B - stop + block) ---
    socket.on('owner_block_screen', async (data: { targetId: string; room: string }) => {
      const dbRoom = await Room.findOne({ roomId: data.room });
      if (!dbRoom || dbRoom.owner.connectionId !== socket.id) return;
      const user = dbRoom.users.find(u => u.connectionId === data.targetId);
      if (user) { user.screenDisabled = true; await dbRoom.save(); }
      io.to(data.targetId).emit('block_screen', { by: socket.id });
      broadcastToRoom(io, data.room, 'peer_media_state_changed', { userId: data.targetId, screenOn: false, screenDisabled: true });
    });

    // --- Owner: Unblock a guest's screen (Mode B - unblock only, does NOT start sharing) ---
    socket.on('owner_unblock_screen', async (data: { targetId: string; room: string }) => {
      const dbRoom = await Room.findOne({ roomId: data.room });
      if (!dbRoom || dbRoom.owner.connectionId !== socket.id) return;
      const user = dbRoom.users.find(u => u.connectionId === data.targetId);
      if (user) { user.screenDisabled = false; await dbRoom.save(); }
      io.to(data.targetId).emit('allow_screen_share', { by: socket.id });
      broadcastToRoom(io, data.room, 'peer_media_state_changed', { userId: data.targetId, screenDisabled: false });
    });

    // --- Owner: Mute all currently connected guests (Mode A - one-time, does NOT block) ---
    socket.on('owner_global_mute', async (data: { room: string }) => {
      const dbRoom = await Room.findOne({ roomId: data.room });
      if (!dbRoom || dbRoom.owner.connectionId !== socket.id) return;
      const roomState = rooms.get(data.room);
      if (!roomState) return;
      for (const peerId of roomState.peers.keys()) {
        if (peerId === dbRoom.owner.connectionId) continue;
        io.to(peerId).emit('force_mute', { by: socket.id });
      }
      broadcastToRoom(io, data.room, 'peer_media_state_changed', { userId: 'all', micOn: false });
    });

    // --- Owner: Admit from waiting room ---
    socket.on('owner_admit_user', async (data: { targetId: string; room: string }) => {
      const dbRoom = await Room.findOne({ roomId: data.room });
      if (!dbRoom || dbRoom.owner.connectionId !== socket.id) return;

      const roomState = rooms.get(data.room);
      if (!roomState) return;

      const user = dbRoom.users.find(u => u.connectionId === data.targetId);
      if (!user) return;

      // Add to active peers
      roomState.peers.set(data.targetId, data.room);

      io.to(data.targetId).emit('admitted_to_room', { room: data.room });

      // Send full room info to admitted user
      const peerInfos = dbRoom.users
        .filter(u => !u.disconnectedAt && u.connectionId !== data.targetId)
        .map(u => ({
          id: u.connectionId,
          name: u.name,
          isOwner: u.owner,
          muted: u.muted,
          videoDisabled: u.videoDisabled,
          screenDisabled: u.screenDisabled,
        }));
      const connections = Array.from(roomState.peers.keys()).filter(id => id !== data.targetId);
      io.to(data.targetId).emit('get_peers', {
        connections,
        peerInfos,
        you: data.targetId,
        isOwner: false,
        settings: dbRoom.settings,
      });

      // Notify existing peers
      for (const peerId of connections) {
        io.to(peerId).emit('new_peer_connected', {
          socketId: data.targetId,
          name: user.name,
          isOwner: false
        });
      }

      // Enforce guest restrictions on admitted user
      if (dbRoom.settings.disableGuestMics) {
        io.to(data.targetId).emit('block_mic', { by: 'system' });
      }
      if (dbRoom.settings.disableGuestVideo) {
        io.to(data.targetId).emit('block_camera', { by: 'system' });
      }
      if (dbRoom.settings.disableGuestScreen) {
        io.to(data.targetId).emit('block_screen', { by: 'system' });
      }
    });

    // --- Owner: Reject from waiting room ---
    socket.on('owner_reject_user', async (data: { targetId: string; room: string }) => {
      const dbRoom = await Room.findOne({ roomId: data.room });
      if (!dbRoom || dbRoom.owner.connectionId !== socket.id) return;

      // Mark as disconnected in DB
      const user = dbRoom.users.find(u => u.connectionId === data.targetId);
      if (user) { user.disconnectedAt = new Date(); await dbRoom.save(); }

      io.to(data.targetId).emit('rejected_from_room', { room: data.room });

      // Broadcast remove to clean up any stale video elements
      broadcastToRoom(io, data.room, 'remove_peer_connected', { socketId: data.targetId });
    });

    // --- Owner: Update room settings ---
    socket.on('owner_update_settings', async (data: { room: string; settings: Record<string, unknown> }) => {
      const dbRoom = await Room.findOne({ roomId: data.room });
      if (!dbRoom || dbRoom.owner.connectionId !== socket.id) return;
      Object.assign(dbRoom.settings, data.settings);

      const roomState = rooms.get(data.room);
      if (roomState) {
        for (const peerId of roomState.peers.keys()) {
          if (peerId === dbRoom.owner.connectionId) continue;
          const user = dbRoom.users.find(u => u.connectionId === peerId);
          if (data.settings.disableGuestMics === true) {
            if (user) user.muted = true;
            io.to(peerId).emit('block_mic', { by: 'system' });
          } else if (data.settings.disableGuestMics === false) {
            if (user) user.muted = false;
            io.to(peerId).emit('allow_unmute', { by: 'system' });
          }
          if (data.settings.disableGuestVideo === true) {
            if (user) user.videoDisabled = true;
            io.to(peerId).emit('block_camera', { by: 'system' });
          } else if (data.settings.disableGuestVideo === false) {
            if (user) user.videoDisabled = false;
            io.to(peerId).emit('allow_camera_on', { by: 'system' });
          }
          if (data.settings.disableGuestScreen === true) {
            if (user) user.screenDisabled = true;
            io.to(peerId).emit('block_screen', { by: 'system' });
          } else if (data.settings.disableGuestScreen === false) {
            if (user) user.screenDisabled = false;
            io.to(peerId).emit('allow_screen_share', { by: 'system' });
          }
        }
      }

      await dbRoom.save();
      broadcastToRoom(io, data.room, 'room_settings_updated', { settings: dbRoom.settings });

      if (roomState) {
        if (data.settings.disableGuestMics !== undefined) {
          const blocked = data.settings.disableGuestMics === true;
          broadcastToRoom(io, data.room, 'peer_media_state_changed', { userId: 'all', micOn: blocked ? false : undefined, muted: blocked });
        }
        if (data.settings.disableGuestVideo !== undefined) {
          const blocked = data.settings.disableGuestVideo === true;
          broadcastToRoom(io, data.room, 'peer_media_state_changed', { userId: 'all', videoOn: blocked ? false : undefined, videoDisabled: blocked });
        }
        if (data.settings.disableGuestScreen !== undefined) {
          const blocked = data.settings.disableGuestScreen === true;
          broadcastToRoom(io, data.room, 'peer_media_state_changed', { userId: 'all', screenOn: blocked ? false : undefined, screenDisabled: blocked });
        }
      }
    });

    // --- Owner: Kick user ---
    socket.on('owner_kick_user', async (data: { targetId: string; room: string }) => {
      const dbRoom = await Room.findOne({ roomId: data.room });
      if (!dbRoom || dbRoom.owner.connectionId !== socket.id) return;
      io.to(data.targetId).emit('kicked_from_room', { room: data.room });
      const roomState = rooms.get(data.room);
      if (roomState) roomState.peers.delete(data.targetId);
      const user = dbRoom.users.find(u => u.connectionId === data.targetId);
      if (user) { user.disconnectedAt = new Date(); }
      await dbRoom.save();
      broadcastToRoom(io, data.room, 'remove_peer_connected', { socketId: data.targetId });
    });

    // --- Disconnect ---
    socket.on('disconnect', async () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;

      const roomState = rooms.get(roomId);
      if (roomState) {
        roomState.peers.delete(socket.id);
        // Notify remaining peers
        for (const peerId of roomState.peers.keys()) {
          io.to(peerId).emit('remove_peer_connected', { socketId: socket.id });
        }
        // Clean empty rooms from memory
        if (roomState.peers.size === 0) {
          rooms.delete(roomId);
        }
      }

      // Update DB
      const dbRoom = await Room.findOne({ roomId });
      if (dbRoom) {
        const user = dbRoom.users.find(u => u.connectionId === socket.id);
        if (user) {
          user.disconnectedAt = new Date();
        }
        // If owner disconnected, notify
        if (dbRoom.owner.connectionId === socket.id) {
          broadcastToRoom(io, roomId, 'owner_data_updated', {
            ownerName: dbRoom.owner.name,
            ownerAvatar: dbRoom.owner.avatar,
            status: 'DISCONNECTED',
            ownerCid: socket.id,
            access: dbRoom.access,
          });
        }
        dbRoom.lastActive = new Date();
        await dbRoom.save();
      }

      socketToRoom.delete(socket.id);
      console.log(`[ws] Client disconnected: ${socket.id} from room ${roomId}`);
    });
  });

  return io;
}
