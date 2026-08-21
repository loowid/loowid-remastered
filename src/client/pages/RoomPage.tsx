import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { VideoGrid } from '../components/VideoGrid';
import { ChatPanel } from '../components/ChatPanel';
import { ParticipantsPanel } from '../components/ParticipantsPanel';
import { FileTransferPanel, type TransferEntry } from '../components/FileTransfer';
import { RecordingPanel } from '../components/RecordingPanel';
import { RoomSettingsPanel } from '../components/RoomSettingsPanel';
import { Navbar } from '../components/Navbar';
import { JoinModal } from '../components/JoinModal';
import { getStoredOrRandomName } from '../utils/heroes';
import { useStreaming } from '../hooks/useStreaming';

interface Peer {
  id: string;
  stream?: MediaStream;
  name?: string;
  videoEnabled: boolean;
  audioEnabled: boolean;
  screenEnabled: boolean;
  isOwner?: boolean;
  muted?: boolean;
  videoDisabled?: boolean;
  screenDisabled?: boolean;
  lastAudioTime?: number;
  audioLevel?: number;
}

interface ChatMsg {
  id: string;
  text: string;
  name?: string;
  time: Date;
  self: boolean;
}

interface RoomSettings {
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

interface Recording {
  id: string;
  type: string;
  filename?: string;
  url?: string;
  size?: number;
  created: string;
}

const defaultSettings: RoomSettings = {
  permanent: false, allowDownloads: false, waitingRoom: false,
  disableGuestMics: false, disableGuestVideo: false, disableGuestScreen: false, disableGuestChat: false, allowGuestFileSharing: true, maxParticipants: 0,
};

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [transfers, setTransfers] = useState<TransferEntry[]>([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [checkingRoom, setCheckingRoom] = useState(true);
  const [incomingFileRequest, setIncomingFileRequest] = useState<{ requestId: string; senderId: string; senderName: string; files: Array<{ name: string; size: number }> } | null>(null);

  // Waiting room state
  const [inWaitingRoom, setInWaitingRoom] = useState(false);
  const [waitingUsers, setWaitingUsers] = useState<Array<{ id: string; name: string }>>([]);

  // Panel states
  const [participantsOpen, setParticipantsOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(false);
  const [recordingOpen, setRecordingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Streaming state
  // TODO: Re-enable streaming when WebCodecs API or AWS IVS is implemented
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamPlatform, setStreamPlatform] = useState<'youtube' | 'twitch' | null>(null);
  const streamingSessionIdRef = useRef<string | null>(null);

  // Owner state
  const [isOwner, setIsOwner] = useState(false);
  const [roomSettings, setRoomSettings] = useState<RoomSettings>(defaultSettings);
  const [recordings, setRecordings] = useState<Recording[]>([]);

  // Media state
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [localMicBlocked, setLocalMicBlocked] = useState(false);
  const [localCamBlocked, setLocalCamBlocked] = useState(false);
  const [localScreenBlocked, setLocalScreenBlocked] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const rtcConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]);
  const joinedRef = useRef(false);
  const mountedRef = useRef(true);

  // Recording refs — hidden video registry so canvas is decoupled from visible UI
  const videoRegistry = useRef<Map<string, HTMLVideoElement>>(new Map());
  const videoMetaRef = useRef<Map<string, { isScreen: boolean; speaking?: boolean; name?: string }>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioSourcesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rafRef = useRef<number>(0);
  const recordingChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingWorkerRef = useRef<Worker | null>(null);
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingLayoutRef = useRef<'presenter' | 'grid'>('presenter');

  // Helper: register a stream for recording canvas
  const registerStreamForRecording = useCallback((id: string, stream: MediaStream | null | undefined, meta?: { isScreen?: boolean; speaking?: boolean; name?: string }) => {
    if (!stream) {
      const el = videoRegistry.current.get(id);
      if (el) { el.srcObject = null; el.remove(); }
      videoRegistry.current.delete(id);
      videoMetaRef.current.delete(id);
      return;
    }
    let el = videoRegistry.current.get(id);
    if (!el) {
      el = document.createElement('video');
      el.autoplay = true;
      el.muted = true;
      el.playsInline = true;
      el.style.visibility = 'hidden';
      el.style.position = 'fixed';
      el.style.left = '0';
      el.style.top = '0';
      el.style.width = '0';
      el.style.height = '0';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      document.body.appendChild(el);
      videoRegistry.current.set(id, el);
    }
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
    if (meta) {
      videoMetaRef.current.set(id, meta);
    }
  }, []);

  const createPeerConnection = useCallback((peerId: string, stream: MediaStream, sock: Socket) => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    rtcConnections.current.set(peerId, pc);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Data channel for file transfer
    const dc = pc.createDataChannel('fileTransfer', { ordered: true });
    setupDataChannel(peerId, dc);

    pc.ondatachannel = (event) => {
      if (event.channel.label === 'fileTransfer') {
        setupDataChannel(peerId, event.channel);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sock.emit('send_ice_candidate', {
          socketId: peerId, candidate: event.candidate.toJSON(),
          label: event.candidate.sdpMLineIndex?.toString() || '0', mediatype: 'media', produced: false,
        });
      }
    };

    pc.ontrack = (event) => {
      setPeers(prev => {
        const next = new Map(prev);
        const existing = next.get(peerId) || { id: peerId, videoEnabled: true, audioEnabled: true, screenEnabled: false };
        existing.stream = event.streams[0];
        next.set(peerId, existing);
        return next;
      });
      registerStreamForRecording(peerId, event.streams[0]);
      // Add to audio mixer for recording
      if (event.streams[0] && audioCtxRef.current && audioDestRef.current) {
        try {
          const src = audioCtxRef.current.createMediaStreamSource(event.streams[0]);
          src.connect(audioDestRef.current);
          audioSourcesRef.current.set(peerId, src);
        } catch { /* ignore */ }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        rtcConnections.current.delete(peerId);
        dataChannels.current.delete(peerId);
        const src = audioSourcesRef.current.get(peerId);
        if (src) { try { src.disconnect(); } catch { /* ignore */ } audioSourcesRef.current.delete(peerId); }
      }
    };

    return pc;
  }, []);

  const joinRoom = useCallback(async (name: string, password?: string) => {
    if (joinedRef.current) return;
    joinedRef.current = true;

    setUserName(name);
    setShowJoinModal(false);
    setCheckingRoom(false);

    const sock = io(window.location.origin, { path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = sock;
    setSocket(sock);

    try {
      const res = await fetch('/api/rooms/config/ice');
      const data = await res.json();
      if (data.iceServers) iceServersRef.current = data.iceServers;
    } catch { /* defaults */ }

    const ownerToken = localStorage.getItem(`loowid_owner_${roomId}`) || undefined;

    const onConnect = () => {
      setUserId(sock.id || '');
      sock.emit('update_server_config');
      sock.emit('join_room', { room: roomId, pwd: password, name, ownerToken });
    };

    sock.on('connect', onConnect);
    if (sock.connected) onConnect();

    sock.on('get_updated_config', (data: { iceServers: RTCIceServer[] }) => {
      if (data.iceServers) iceServersRef.current = data.iceServers;
    });

    sock.on('get_peers', async (data: { connections: string[]; peerInfos: any[]; you: string; isOwner?: boolean; ownerToken?: string; settings?: RoomSettings }) => {
      if (!mountedRef.current) return;
      setUserId(data.you);
      setInWaitingRoom(false);
      if (data.isOwner) {
        setIsOwner(true);
        if (data.ownerToken) {
          try { localStorage.setItem(`loowid_owner_${roomId}`, data.ownerToken); } catch { /* ignore */ }
        }
      }
      if (data.settings) setRoomSettings(data.settings);

      setPeers(prev => {
        const next = new Map(prev);
        data.peerInfos.forEach(p => {
          next.set(p.id, {
            id: p.id, name: p.name, isOwner: p.isOwner,
            muted: p.muted, videoDisabled: p.videoDisabled,
            videoEnabled: true, audioEnabled: true, screenEnabled: false
          });
        });
        return next;
      });

      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (!mountedRef.current) return;
          setLocalStream(stream);
          localStreamRef.current = stream;
        } catch (err) { console.warn('No media:', err); }
      }
      if (!stream) return;
      for (const peerId of data.connections) {
        const pc = createPeerConnection(peerId, stream, sock);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sock.emit('send_offer', { socketId: peerId, sdp: pc.localDescription?.toJSON(), mediatype: 'media' });
      }
    });

    sock.on('new_peer_connected', (data: { socketId: string; name?: string; isOwner?: boolean }) => {
      if (!mountedRef.current) return;
      setPeers(prev => {
        const next = new Map(prev);
        next.set(data.socketId, { id: data.socketId, name: data.name, isOwner: data.isOwner, videoEnabled: true, audioEnabled: true, screenEnabled: false });
        return next;
      });
    });

    sock.on('receive_offer', async (data: { sdp: RTCSessionDescriptionInit; socketId: string; mediatype: string }) => {
      if (!mountedRef.current) return;
      const stream = localStreamRef.current;
      if (!stream) return;
      const pc = createPeerConnection(data.socketId, stream, sock);
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sock.emit('send_answer', { socketId: data.socketId, sdp: pc.localDescription?.toJSON(), mediatype: data.mediatype });
    });

    sock.on('receive_answer', async (data: { sdp: RTCSessionDescriptionInit; socketId: string }) => {
      if (!mountedRef.current) return;
      const pc = rtcConnections.current.get(data.socketId);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    });

    sock.on('receive_ice_candidate', async (data: { candidate: RTCIceCandidateInit; socketId: string }) => {
      if (!mountedRef.current) return;
      const pc = rtcConnections.current.get(data.socketId);
      if (pc && data.candidate) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    });

    sock.on('remove_peer_connected', (data: { socketId: string }) => {
      if (!mountedRef.current) return;
      const pc = rtcConnections.current.get(data.socketId);
      if (pc) pc.close();
      rtcConnections.current.delete(data.socketId);
      setPeers(prev => { const next = new Map(prev); next.delete(data.socketId); return next; });
    });

    // Waiting room events
    sock.on('waiting_room_entered', () => {
      if (!mountedRef.current) return;
      setInWaitingRoom(true);
    });

    sock.on('waiting_room_user', (data: { userId: string; name: string }) => {
      if (!mountedRef.current) return;
      setWaitingUsers(prev => [...prev.filter(u => u.id !== data.userId), { id: data.userId, name: data.name }]);
    });

    sock.on('admitted_to_room', () => {
      if (!mountedRef.current) return;
      setInWaitingRoom(false);
    });

    sock.on('rejected_from_room', () => {
      window.alert('You were not admitted to the room.');
      window.location.href = '/';
    });

    // Force events (Mode A - one-time off, does NOT block)
    sock.on('force_mute', () => {
      if (!mountedRef.current) return;
      const stream = localStreamRef.current;
      if (stream) { const t = stream.getAudioTracks()[0]; if (t) t.enabled = false; }
      setMicOn(false);
    });
    sock.on('force_camera_off', () => {
      if (!mountedRef.current) return;
      const stream = localStreamRef.current;
      if (stream) { const t = stream.getVideoTracks()[0]; if (t) t.enabled = false; }
      setVideoOn(false);
    });
    sock.on('force_screen_stop', () => {
      if (!mountedRef.current) return;
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        setScreenStream(null);
        screenStreamRef.current = null;
      }
    });

    // Block events (Mode B - off + block)
    sock.on('block_mic', () => {
      if (!mountedRef.current) return;
      const stream = localStreamRef.current;
      if (stream) { const t = stream.getAudioTracks()[0]; if (t) t.enabled = false; }
      setMicOn(false);
      setLocalMicBlocked(true);
    });
    sock.on('block_camera', () => {
      if (!mountedRef.current) return;
      const stream = localStreamRef.current;
      if (stream) { const t = stream.getVideoTracks()[0]; if (t) t.enabled = false; }
      setVideoOn(false);
      setLocalCamBlocked(true);
    });
    sock.on('block_screen', () => {
      if (!mountedRef.current) return;
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        setScreenStream(null);
        screenStreamRef.current = null;
      }
      setLocalScreenBlocked(true);
    });

    // Allow events (Mode B - unblock only, does NOT turn on)
    sock.on('allow_unmute', () => {
      if (!mountedRef.current) return;
      setLocalMicBlocked(false);
    });
    sock.on('allow_camera_on', () => {
      if (!mountedRef.current) return;
      setLocalCamBlocked(false);
    });
    sock.on('allow_screen_share', () => {
      if (!mountedRef.current) return;
      setLocalScreenBlocked(false);
    });
    sock.on('room_settings_updated', (data: { settings: RoomSettings }) => {
      if (!mountedRef.current) return;
      setRoomSettings(data.settings);
    });
    sock.on('peer_media_state_changed', (data: { userId: string; micOn?: boolean; videoOn?: boolean; screenOn?: boolean; muted?: boolean; videoDisabled?: boolean; screenDisabled?: boolean }) => {
      if (!mountedRef.current) return;
      if (data.userId === 'all') {
        setPeers(prev => {
          const next = new Map(prev);
          for (const [id, p] of next) {
            if (p.isOwner) continue; // never apply global state to owner
            if (data.micOn !== undefined) next.set(id, { ...p, audioEnabled: data.micOn });
            if (data.videoOn !== undefined) next.set(id, { ...p, videoEnabled: data.videoOn });
            if (data.screenOn !== undefined) next.set(id, { ...p, screenEnabled: data.screenOn });
            if (data.muted !== undefined) next.set(id, { ...p, muted: data.muted });
            if (data.videoDisabled !== undefined) next.set(id, { ...p, videoDisabled: data.videoDisabled });
            if (data.screenDisabled !== undefined) next.set(id, { ...p, screenDisabled: data.screenDisabled });
          }
          return next;
        });
        return;
      }
      setPeers(prev => {
        const p = prev.get(data.userId);
        if (!p) return prev;
        const next = new Map(prev);
        next.set(data.userId, {
          ...p,
          ...(data.micOn !== undefined && { audioEnabled: data.micOn }),
          ...(data.videoOn !== undefined && { videoEnabled: data.videoOn }),
          ...(data.screenOn !== undefined && { screenEnabled: data.screenOn }),
          ...(data.muted !== undefined && { muted: data.muted }),
          ...(data.videoDisabled !== undefined && { videoDisabled: data.videoDisabled }),
          ...(data.screenDisabled !== undefined && { screenDisabled: data.screenDisabled }),
        });
        return next;
      });
    });
    sock.on('kicked_from_room', () => {
      window.alert('You have been removed from the room.');
      window.location.href = '/';
    });

    sock.on('chat_blocked', (data: { reason: string }) => {
      window.alert(data.reason);
    });

    sock.on('request_for_accept_files', (data: { requestId: string; files: Array<{ name: string; size: number }>; id: string; senderName?: string }) => {
      if (!mountedRef.current) return;
      // Find sender name from peers
      const senderName = peers.get(data.id)?.name || data.senderName || 'Unknown';
      setIncomingFileRequest({
        requestId: data.requestId,
        senderId: data.id,
        senderName,
        files: data.files,
      });
    });

    sock.on('files accepted', (data: { requestId: string; id: string }) => {
      if (!mountedRef.current) return;
      // Recipient accepted - start sending the file via data channel
      const pending = pendingFiles.current.get(data.requestId);
      if (!pending) return;
      const dc = dataChannels.current.get(data.id);
      if (!dc || dc.readyState !== 'open') return;
      const totalChunks = pending.totalChunks;
      dc.send(JSON.stringify({ type: 'file-start', id: data.requestId, name: pending.file.name, size: pending.file.size, totalChunks }));
      setTransfers(prev => prev.map(t => t.id === data.requestId ? { ...t, status: 'transferring' } : t));
      sendFileChunk(data.requestId);
    });

    sock.on('files declined', (data: { requestId: string; id: string }) => {
      if (!mountedRef.current) return;
      // Recipient declined - remove from pending and update transfer status
      pendingFiles.current.delete(data.requestId);
      setTransfers(prev => prev.map(t => t.id === data.requestId ? { ...t, status: 'declined' } : t));
    });

    sock.on('file canceled', (data: { requestId: string; id: string; fileid: string }) => {
      if (!mountedRef.current) return;
      // The other side cancelled - update transfer status
      const incoming = incomingFiles.current.get(data.requestId);
      if (incoming) {
        incoming.chunks = []; // Discard incomplete file
        incomingFiles.current.delete(data.requestId);
      }
      pendingFiles.current.delete(data.requestId);
      setTransfers(prev => prev.map(t => t.id === data.requestId ? { ...t, progress: 0, status: 'cancelled' } : t));
    });

    sock.on('chat_message', (data: { text: string; id: string; name?: string; time: string }) => {
      if (!mountedRef.current) return;
      setChatMessages(prev => {
        // Prevent exact duplicate
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          if (last.text === data.text && last.id === data.id && Math.abs(last.time.getTime() - new Date(data.time).getTime()) < 1000) {
            return prev;
          }
        }
        return [...prev, { id: data.id, text: data.text, name: data.name, time: new Date(data.time), self: data.id === sock.id }];
      });
    });

    sock.on('stream_closed', (data: { connectionId: string; mediatype: string }) => {
      if (!mountedRef.current) return;
      setPeers(prev => {
        const next = new Map(prev);
        const peer = next.get(data.connectionId);
        if (peer) {
          if (data.mediatype === 'video') peer.videoEnabled = false;
          if (data.mediatype === 'audio') peer.audioEnabled = false;
          if (data.mediatype === 'screen') peer.screenEnabled = false;
          next.set(data.connectionId, { ...peer });
        }
        return next;
      });
    });
  }, [roomId, createPeerConnection]);

  // Check room status on mount and auto-join if unlocked (runs ONCE)
  useEffect(() => {
    mountedRef.current = true;
    fetch(`/api/rooms/${roomId}/isJoinable`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (!mountedRef.current) return;
        if (!data.joinable) {
          setCheckingRoom(false);
        } else if (data.locked || data.waitingRoom) {
          setShowJoinModal(true);
          setCheckingRoom(false);
        } else {
          const name = getStoredOrRandomName(roomId || '');
          joinRoom(name);
        }
      })
      .catch(() => {
        if (!mountedRef.current) return;
        const name = getStoredOrRandomName(roomId || '');
        joinRoom(name);
      });

    return () => {
      mountedRef.current = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      rtcConnections.current.forEach(pc => pc.close());
      socketRef.current?.disconnect();
    };
  }, [roomId, joinRoom]);

  // Owner actions
  // Mode A: force_* (one-time off, does NOT block)
  const ownerForceMute = useCallback((targetId: string) => socket?.emit('owner_force_mute', { targetId, room: roomId }), [socket, roomId]);
  const ownerForceCameraOff = useCallback((targetId: string) => socket?.emit('owner_force_camera_off', { targetId, room: roomId }), [socket, roomId]);
  const ownerForceScreenStop = useCallback((targetId: string) => socket?.emit('owner_force_screen_stop', { targetId, room: roomId }), [socket, roomId]);

  // Mode B: block/unblock (permission control)
  const ownerBlockMic = useCallback((targetId: string) => socket?.emit('owner_block_mic', { targetId, room: roomId }), [socket, roomId]);
  const ownerUnblockMic = useCallback((targetId: string) => socket?.emit('owner_unblock_mic', { targetId, room: roomId }), [socket, roomId]);
  const ownerBlockCamera = useCallback((targetId: string) => socket?.emit('owner_block_camera', { targetId, room: roomId }), [socket, roomId]);
  const ownerUnblockCamera = useCallback((targetId: string) => socket?.emit('owner_unblock_camera', { targetId, room: roomId }), [socket, roomId]);
  const ownerBlockScreen = useCallback((targetId: string) => socket?.emit('owner_block_screen', { targetId, room: roomId }), [socket, roomId]);
  const ownerUnblockScreen = useCallback((targetId: string) => socket?.emit('owner_unblock_screen', { targetId, room: roomId }), [socket, roomId]);

  const ownerKick = useCallback((targetId: string) => socket?.emit('owner_kick_user', { targetId, room: roomId }), [socket, roomId]);
  const ownerGlobalMute = useCallback(() => socket?.emit('owner_global_mute', { room: roomId }), [socket, roomId]);
  const ownerAdmit = useCallback((targetId: string) => {
    setWaitingUsers(prev => prev.filter(u => u.id !== targetId));
    socket?.emit('owner_admit_user', { targetId, room: roomId });
  }, [socket, roomId]);
  const ownerReject = useCallback((targetId: string) => {
    setWaitingUsers(prev => prev.filter(u => u.id !== targetId));
    socket?.emit('owner_reject_user', { targetId, room: roomId });
  }, [socket, roomId]);

  const ownerUpdateSettings = useCallback(async (settings: Partial<RoomSettings>) => {
    socket?.emit('owner_update_settings', { room: roomId, settings });
    setRoomSettings(prev => ({ ...prev, ...settings }));
  }, [socket, roomId]);

  const deleteRecording = useCallback(async (recordingId: string) => {
    try {
      await fetch(`/api/rooms/${roomId}/recordings/${recordingId}`, { method: 'DELETE' });
      setRecordings(prev => prev.filter(r => r.id !== recordingId));
    } catch { /* ignore */ }
  }, [roomId]);

  const toggleMic = useCallback(() => {
    if (!isOwner && localMicBlocked) {
      window.alert('Your microphone is disabled by the room owner.');
      return;
    }
    const stream = localStreamRef.current;
    if (!stream) return;
    const t = stream.getAudioTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setMicOn(t.enabled);
      socketRef.current?.emit('user_media_state', { room: roomId, micOn: t.enabled });
    }
  }, [isOwner, localMicBlocked, roomId]);

  const toggleVideo = useCallback(() => {
    if (!isOwner && localCamBlocked) {
      window.alert('Your camera is disabled by the room owner.');
      return;
    }
    const stream = localStreamRef.current;
    if (!stream) return;
    const t = stream.getVideoTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setVideoOn(t.enabled);
      socketRef.current?.emit('user_media_state', { room: roomId, videoOn: t.enabled });
    }
  }, [isOwner, localCamBlocked, roomId]);

  const toggleScreen = useCallback(async () => {
    if (!isOwner && localScreenBlocked) {
      window.alert('Screen sharing is disabled by the room owner.');
      return;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      setScreenStream(null);
      screenStreamRef.current = null;
      socketRef.current?.emit('user_media_state', { room: roomId, screenOn: false });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        screenStreamRef.current = null;
        socketRef.current?.emit('user_media_state', { room: roomId, screenOn: false });
      };
      setScreenStream(stream);
      socketRef.current?.emit('user_media_state', { room: roomId, screenOn: true });
      const vt = stream.getVideoTracks()[0];
      rtcConnections.current.forEach(pc => { const s = pc.getSenders().find(s => s.track?.kind === 'video'); if (s) s.replaceTrack(vt); });
    } catch { /* cancelled */ }
  }, [isOwner, localScreenBlocked, roomId]);

  // --- Canvas recording (using Web Worker for FPS when tab hidden) ---
  const captureAndSendFrames = useCallback(async () => {
    if (!recordingWorkerRef.current || !canvasRef.current) return;

    const videos = Array.from(videoRegistry.current.entries()).filter(([_, v]) => v.readyState >= 2 && v.videoWidth > 0);
    
    // Capture frames from all videos with metadata
    const bitmaps = await Promise.all(
      videos.map(async ([id, v]) => {
        try {
          const bitmap = await createImageBitmap(v);
          const meta = videoMetaRef.current.get(id) || { isScreen: false };
          return { id, bitmap, ...meta };
        } catch {
          return null;
        }
      })
    );

    const activeBitmaps = bitmaps.filter(b => b !== null);
    recordingWorkerRef.current.postMessage({ 
      type: 'tick', 
      videos: activeBitmaps,
      layout: recordingLayoutRef.current 
    });
  }, []);

  const startRecording = useCallback(async (options: { layout: 'presenter' | 'grid'; type: 'local' | 'youtube' | 'twitch'; streamKey?: string }) => {
    const { layout, type, streamKey } = options;
    recordingLayoutRef.current = layout;
    // Ensure all current streams are registered
    registerStreamForRecording('local', localStreamRef.current);
    registerStreamForRecording('local-screen', screenStreamRef.current);
    for (const [id, p] of peers) {
      registerStreamForRecording(id, p.stream);
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 1280;
      canvasRef.current.height = 720;
    }

    // Create worker
    const worker = new Worker(
      new URL('../workers/recordingWorker.ts', import.meta.url),
      { type: 'module' }
    );
    recordingWorkerRef.current = worker;

    // Set up composite canvas for preview
    if (!compositeCanvasRef.current) {
      compositeCanvasRef.current = document.createElement('canvas');
      compositeCanvasRef.current.width = 1280;
      compositeCanvasRef.current.height = 720;
    }
    const previewCtx = compositeCanvasRef.current.getContext('2d');

    // Handle frames from worker
    recordingWorkerRef.current.onmessage = (e) => {
      if (e.data.type === 'frame' && previewCtx) {
        previewCtx.drawImage(e.data.bitmap, 0, 0);
      }
    };

    // Set up audio
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
      audioDestRef.current = audioCtxRef.current.createMediaStreamDestination();
      if (localStreamRef.current) {
        try {
          const src = audioCtxRef.current.createMediaStreamSource(localStreamRef.current);
          src.connect(audioDestRef.current);
          audioSourcesRef.current.set('local', src);
        } catch { /* ignore */ }
      }
    }

    // Initialize worker first
    recordingWorkerRef.current.postMessage({ type: 'init' });

    // Start capture loop (every 33ms = 30fps)
    captureIntervalRef.current = setInterval(captureAndSendFrames, 33);
    recordingWorkerRef.current.postMessage({ type: 'start' });

    // Create stream from composite canvas
    const canvasStream = compositeCanvasRef.current.captureStream(30);
    const tracks = [...canvasStream.getVideoTracks()];
    if (audioDestRef.current) {
      tracks.push(...audioDestRef.current.stream.getAudioTracks());
    }
    const combined = new MediaStream(tracks);

    // Determine if streaming or local recording
    // TODO: Re-enable streaming when WebCodecs API or AWS IVS is implemented
    // For now, only local recording is supported
    if (type !== 'local') {
      alert('Streaming to YouTube/Twitch is not yet implemented. TODO: Use WebCodecs API or AWS IVS.');
      return;
    }

    // Local recording
    const recorder = new MediaRecorder(combined, { mimeType: 'video/webm;codecs=vp9,opus' });
    recordingChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordingChunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
      try {
        const form = new FormData();
        form.append('recording', blob, `recording-${Date.now()}.webm`);
        const res = await fetch(`/api/rooms/${roomId}/recordings`, { method: 'POST', body: form });
        const data = await res.json();
        if (data.recording) {
          setRecordings(prev => [...prev, data.recording]);
        }
      } catch (err) {
        console.warn('Upload failed:', err);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `loowid-recording-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      }
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingWorkerRef.current?.postMessage({ type: 'stop' });
      recordingWorkerRef.current?.terminate();
      recordingWorkerRef.current = null;
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    setIsRecording(true);
    setIsStreaming(false);
    setStreamPlatform(null);
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
  }, [captureAndSendFrames, roomId, peers, registerStreamForRecording]);

  const stopRecording = useCallback(async () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    
    // TODO: Re-enable streaming stop when WebCodecs API or AWS IVS is implemented
    // For now, only local recording is supported

    setIsRecording(false);
    setIsStreaming(false);
    setStreamPlatform(null);
    streamingSessionIdRef.current = null;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    if (recordingWorkerRef.current) {
      recordingWorkerRef.current.postMessage({ type: 'stop' });
      recordingWorkerRef.current.terminate();
      recordingWorkerRef.current = null;
    }
  }, []);

  // --- Data channel file transfer ---
  const pendingFiles = useRef<Map<string, { file: File; reader: FileReader; chunkSize: number; currentChunk: number; totalChunks: number; targetId: string }>>(new Map());
  const incomingFiles = useRef<Map<string, { chunks: Uint8Array[]; received: number; total: number; name: string; size: number; senderId: string }>>(new Map());

  const setupDataChannel = useCallback((peerId: string, dc: RTCDataChannel) => {
    dataChannels.current.set(peerId, dc);
    dc.binaryType = 'arraybuffer';
    dc.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file-start') {
          // Only add if not already in transfers (avoid duplicate from toast acceptance)
          setTransfers(prev => {
            const existing = prev.find(t => t.id === msg.id);
            if (existing) {
              // Update existing entry to transferring
              return prev.map(t => t.id === msg.id ? { ...t, status: 'transferring' as const } : t);
            }
            // Add new entry
            return [...prev, { id: msg.id, fileName: msg.name, fileSize: msg.size, progress: 0, direction: 'receiving' as const, senderId: peerId, senderName: peers.get(peerId)?.name || 'Unknown', status: 'transferring' as const }];
          });
          incomingFiles.current.set(msg.id, { chunks: [], received: 0, total: msg.totalChunks, name: msg.name, size: msg.size, senderId: peerId });
        } else if (msg.type === 'file-done') {
          const incoming = incomingFiles.current.get(msg.id);
          if (!incoming) return;
          const blob = new Blob(incoming.chunks as BlobPart[]);
          const url = URL.createObjectURL(blob);
          setTransfers(prev => prev.map(t => t.id === msg.id ? { ...t, progress: 100, status: 'done', downloadUrl: url } : t));
          incomingFiles.current.delete(msg.id);
        } else if (msg.type === 'file-cancelled') {
          const incoming = incomingFiles.current.get(msg.id);
          if (incoming) {
            incoming.chunks = []; // Discard incomplete file
          }
          incomingFiles.current.delete(msg.id);
          setTransfers(prev => prev.map(t => t.id === msg.id ? { ...t, progress: 0, status: 'cancelled' } : t));
        }
      } else {
        // Binary chunk
        const buf = new Uint8Array(event.data);
        // First 36 bytes is the file id (UUID)
        const id = new TextDecoder().decode(buf.slice(0, 36));
        const chunk = buf.slice(36);
        const incoming = incomingFiles.current.get(id);
        if (incoming) {
          incoming.chunks.push(chunk);
          incoming.received++;
          const pct = Math.round((incoming.received / incoming.total) * 100);
          setTransfers(prev => prev.map(t => t.id === id ? { ...t, progress: pct } : t));
        }
      }
    };
  }, [peers]);

  const sendChat = useCallback((text: string) => {
    if (!socket || !roomId) return;
    if (!isOwner && roomSettings.disableGuestChat) return;
    socket.emit('chat_message', { text, room: roomId });
    // Optimistic add only for self, server will NOT echo back (excluded in broadcast)
    setChatMessages(prev => [...prev, { id: 'self', text, name: userName, time: new Date(), self: true }]);
  }, [socket, roomId, userName, isOwner, roomSettings.disableGuestChat]);

  const sendFileChunk = useCallback((id: string) => {
    const pending = pendingFiles.current.get(id);
    if (!pending) return;
    const dc = dataChannels.current.get(pending.targetId);
    if (!dc || dc.readyState !== 'open') return;

    const start = pending.currentChunk * pending.chunkSize;
    const end = Math.min(start + pending.chunkSize, pending.file.size);
    const slice = pending.file.slice(start, end);

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result as ArrayBuffer;
      if (!data) return;
      // Prepend file id (36 bytes) to chunk
      const idBuf = new TextEncoder().encode(id);
      const combined = new Uint8Array(idBuf.length + data.byteLength);
      combined.set(idBuf, 0);
      combined.set(new Uint8Array(data), idBuf.length);
      dc.send(combined.buffer);

      pending.currentChunk++;
      const pct = Math.round((pending.currentChunk / pending.totalChunks) * 100);
      setTransfers(prev => prev.map(t => t.id === id ? { ...t, progress: pct } : t));

      if (pending.currentChunk < pending.totalChunks) {
        sendFileChunk(id);
      } else {
        dc.send(JSON.stringify({ type: 'file-done', id }));
        pendingFiles.current.delete(id);
        setTransfers(prev => prev.map(t => t.id === id ? { ...t, progress: 100, status: 'done' } : t));
      }
    };
    reader.readAsArrayBuffer(slice);
  }, []);

  const initiateFileSend = useCallback((targetId: 'all' | string, files: File[]) => {
    if (!socket || !roomId) return;
    const chunkSize = 16384; // 16KB
    const targets = targetId === 'all' ? Array.from(peers.keys()) : [targetId];

    for (const file of files) {
      const id = crypto.randomUUID();
      const totalChunks = Math.ceil(file.size / chunkSize);
      const targetName = targetId === 'all' ? 'Everyone' : peers.get(targetId)?.name || targetId.slice(0, 8);
      setTransfers(prev => [...prev, { id, fileName: file.name, fileSize: file.size, progress: 0, direction: 'sending', targetName, targetId, status: 'pending', senderName: userName }]);

      // Send via server-mediated request (asks recipient to accept)
      for (const peerId of targets) {
        socket.emit('ask_for_accept_files', {
          connectionId: peerId,
          filesinfo: [{ name: file.name, size: file.size }],
          requestId: id,
          room: roomId,
          senderName: userName,
        });
        // Store the file info for when acceptance comes back
        pendingFiles.current.set(id, { file, reader: new FileReader(), chunkSize, currentChunk: 0, totalChunks, targetId: peerId });
      }
    }
  }, [socket, roomId, peers, userName]);

  const acceptIncomingFile = useCallback((requestId: string, senderId: string, fileName: string, fileSize: number) => {
    if (!socket) return;
    socket.emit('accept_files_request', { connectionId: senderId, requestId, token: 'accepted', room: roomId });
    setTransfers(prev => [...prev, {
      id: requestId,
      fileName,
      fileSize,
      progress: 0,
      direction: 'receiving',
      senderId,
      senderName: incomingFileRequest?.senderName || 'Unknown',
      status: 'transferring',
    }]);
    setIncomingFileRequest(null);
    setFilesOpen(true); // Auto-open files panel
  }, [socket, roomId, incomingFileRequest]);

  const declineIncomingFile = useCallback((requestId: string, senderId: string) => {
    if (!socket) return;
    socket.emit('decline_files_request', { connectionId: senderId, requestId, room: roomId });
    setIncomingFileRequest(null);
  }, [socket, roomId]);

  const cancelTransfer = useCallback((transferId: string) => {
    const transfer = transfers.find(t => t.id === transferId);
    if (!transfer) return;

    // Notify the other side via server
    if (socket) {
      if (transfer.direction === 'sending') {
        // Broadcast cancel to all recipients
        for (const peerId of Array.from(peers.keys())) {
          socket.emit('file_canceled', {
            connectionId: peerId,
            requestId: transferId,
            fileid: transferId,
            token: 'cancelled',
            direction: transfer.direction,
            room: roomId,
          });
        }
      } else {
        // For receiving, notify the sender
        socket.emit('file_canceled', {
          connectionId: transfer.senderId,
          requestId: transferId,
          fileid: transferId,
          token: 'cancelled',
          direction: transfer.direction,
          room: roomId,
        });
      }
    }

    // Update local state
    setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'cancelled' } : t));

    // Clean up pending file if exists
    pendingFiles.current.delete(transferId);
    incomingFiles.current.delete(transferId);
  }, [socket, roomId, peers, transfers]);

  const deleteTransfer = useCallback((transferId: string) => {
    setTransfers(prev => prev.filter(t => t.id !== transferId));
    pendingFiles.current.delete(transferId);
    incomingFiles.current.delete(transferId);
  }, []);

  // Register local streams for recording canvas
  useEffect(() => {
    registerStreamForRecording('local', localStream, { isScreen: false, speaking: true });
  }, [localStream, registerStreamForRecording]);

  useEffect(() => {
    registerStreamForRecording('local-screen', screenStream, { isScreen: true });
  }, [screenStream, registerStreamForRecording]);

  useEffect(() => {
    for (const [id, p] of peers) {
      registerStreamForRecording(id, p.stream, { isScreen: p.screenEnabled, speaking: p.audioLevel && p.audioLevel > 0.1, name: p.name });
    }
  }, [peers, registerStreamForRecording]);

  // Cleanup hidden videos on unmount
  useEffect(() => {
    return () => {
      for (const el of videoRegistry.current.values()) {
        el.srcObject = null;
        el.remove();
      }
      videoRegistry.current.clear();
    };
  }, []);

  if (checkingRoom) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-gray-400 text-sm animate-pulse">Connecting to room...</div>
      </div>
    );
  }

  if (showJoinModal) {
    return <JoinModal roomId={roomId || ''} onJoin={joinRoom} />;
  }

  if (inWaitingRoom) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-center">
          <div className="text-xl text-gray-300 mb-2">Waiting Room</div>
          <p className="text-sm text-gray-500">The room owner needs to admit you.</p>
        </div>
      </div>
    );
  }

  const participantList = [
    { id: userId || 'local', name: userName || 'You', videoEnabled: !!localStream?.getVideoTracks()[0]?.enabled, audioEnabled: !!localStream?.getAudioTracks()[0]?.enabled, screenEnabled: !!screenStreamRef.current, isOwner: isOwner, muted: localMicBlocked, videoDisabled: localCamBlocked, screenDisabled: localScreenBlocked },
    ...Array.from(peers.values()).map(p => ({ id: p.id, name: p.name, videoEnabled: p.videoEnabled, audioEnabled: p.audioEnabled, screenEnabled: p.screenEnabled, isOwner: p.isOwner, muted: p.muted, videoDisabled: p.videoDisabled, screenDisabled: p.screenDisabled })),
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <Navbar
        userName={userName} roomId={roomId || ''}
        isOwner={isOwner}
        micOn={micOn} videoOn={videoOn} screenSharing={!!screenStream}
        micDisabled={!isOwner && localMicBlocked}
        videoDisabled={!isOwner && localCamBlocked}
        screenDisabled={!isOwner && localScreenBlocked}
        participantsOpen={participantsOpen} chatOpen={chatOpen}
        settingsOpen={settingsOpen} recordingOpen={recordingOpen} filesOpen={filesOpen}
        onToggleMic={toggleMic} onToggleVideo={toggleVideo} onToggleScreen={toggleScreen}
        onToggleParticipants={() => setParticipantsOpen(!participantsOpen)}
        onToggleChat={() => setChatOpen(!chatOpen)}
        onToggleSettings={() => setSettingsOpen(!settingsOpen)}
        onToggleRecording={() => setRecordingOpen(!recordingOpen)}
        onToggleFiles={() => setFilesOpen(!filesOpen)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <ParticipantsPanel
          participants={participantList} localId={userId || 'local'}
          collapsed={!participantsOpen} onToggle={() => setParticipantsOpen(!participantsOpen)}
          isOwner={isOwner}
          roomSettings={roomSettings}
          waitingUsers={waitingUsers}
          onAdmit={ownerAdmit} onReject={ownerReject}
          onForceMute={ownerForceMute}
          onForceCameraOff={ownerForceCameraOff}
          onForceScreenStop={ownerForceScreenStop}
          onBlockMic={ownerBlockMic} onUnblockMic={ownerUnblockMic}
          onBlockCamera={ownerBlockCamera} onUnblockCamera={ownerUnblockCamera}
          onBlockScreen={ownerBlockScreen} onUnblockScreen={ownerUnblockScreen}
          onKickUser={ownerKick}
          onGlobalMute={ownerGlobalMute}
          onFileToAll={(f) => initiateFileSend('all', f)} onFileToUser={(id, f) => initiateFileSend(id, f)}
        />

        <div className="flex-1 relative overflow-hidden">
          <VideoGrid localStream={localStream} localScreenStream={screenStream} peers={Array.from(peers.values())} participantsOpen={participantsOpen} chatOpen={chatOpen} />
        </div>

        <ChatPanel messages={chatMessages} onSend={sendChat} collapsed={!chatOpen} onToggle={() => setChatOpen(!chatOpen)} disabled={!isOwner && roomSettings.disableGuestChat} />

        {/* Overlays */}
        {recordingOpen && (
          <div className="absolute top-2 right-14 z-50">
            <RecordingPanel
              roomId={roomId || ''}
              isOwner={isOwner}
              isRecording={isRecording}
              recordingTime={recordingTime}
              onStart={(options) => startRecording(options)}
              onStop={stopRecording}
              onClose={() => setRecordingOpen(false)}
            />
          </div>
        )}
        {settingsOpen && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50">
            <RoomSettingsPanel
              roomId={roomId || ''} settings={roomSettings} recordings={recordings}
              onClose={() => setSettingsOpen(false)}
              onSettingsChange={ownerUpdateSettings} onDeleteRecording={deleteRecording}
            />
          </div>
        )}
        {filesOpen && (
          <div className="absolute top-2 right-4 z-50">
            <FileTransferPanel
              transfers={transfers}
              onCancel={cancelTransfer}
              onDelete={deleteTransfer}
              onSelectFile={() => document.getElementById('file-input')?.click()}
              onClose={() => setFilesOpen(false)}
            />
          </div>
        )}

        {/* Hidden file input for selecting files */}
        <input
          type="file"
          id="file-input"
          className="hidden"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
              initiateFileSend('all', files);
            }
            e.target.value = '';
          }}
        />

        {/* Incoming file request toast */}
        {incomingFileRequest && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl w-80">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-600/30 rounded-full flex items-center justify-center shrink-0">
                <span className="text-lg">📁</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">
                  {incomingFileRequest.senderName} is sharing
                </p>
                <div className="mt-2 space-y-1">
                  {incomingFileRequest.files.map((f, i) => (
                    <p key={i} className="text-xs text-gray-400">
                      {f.name} <span className="text-gray-600">({formatSize(f.size)})</span>
                    </p>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      const firstFile = incomingFileRequest.files[0];
                      acceptIncomingFile(incomingFileRequest.requestId, incomingFileRequest.senderId, firstFile?.name || 'file', firstFile?.size || 0);
                    }}
                    className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium text-white transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => declineIncomingFile(incomingFileRequest.requestId, incomingFileRequest.senderId)}
                    className="flex-1 py-1.5 px-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium text-gray-300 transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
              <button
                onClick={() => setIncomingFileRequest(null)}
                className="text-gray-500 hover:text-white shrink-0"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
