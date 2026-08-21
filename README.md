# LooWID - WebRTC Video Conferencing

An evolution of [LooWID](https://github.com/loowid/loowid) - A free, open-source video conferencing application built with WebRTC. LooWID enables real-time video calls, screen sharing, chat, and P2P file transfers directly in your browser.

## Features

- **Video Conferencing** - Real-time peer-to-peer video/audio calls using WebRTC
- **Screen Sharing** - Share your screen or specific windows with room participants
- **Real-time Chat** - Text chat alongside video calls
- **P2P File Transfers** - Send files directly to other participants using WebRTC DataChannels
- **Recording** - Record meetings locally as WebM video files
- **Room Management** - Create rooms, set passwords, control participant permissions
- **Waiting Room** - Queue participants before admitting them to the room
- **Owner Controls** - Mute participants, disable cameras, remove users

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4
- **Backend**: Express, Socket.IO, MongoDB/Mongoose
- **WebRTC**: Socket.IO for signaling, native WebRTC for media
- **Media Recording**: Web Workers + Canvas API

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB (local or cloud instance)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd loowid-remastered

# Install dependencies
npm install

# Start MongoDB (if using local)
mongod
```

### Development

```bash
# Run both server and client in development mode
npm run dev

# Or run separately:
npm run dev:server   # Server on port 3000
npm run dev:client   # Client on port 5173
```

The app will be available at `http://localhost:5173`

### Production Build

```bash
npm run build
npm start
```

## Configuration

Environment variables (defaults shown):

```bash
PORT=3000                    # Server port
MONGODB_URI=mongodb://localhost:27017/loowid
SESSION_SECRET=change-me     # Change in production
```

Optional:
```bash
SSL_KEY_PATH=                # Path to SSL key for HTTPS
SSL_CERT_PATH=              # Path to SSL certificate
COTURN_SERVER=              # TURN server for NAT traversal
COTURN_AUTH_USERNAME=
COTURN_AUTH_SECRET=
```

## Architecture

```
src/
├── client/                  # React frontend
│   ├── components/         # UI components
│   │   ├── VideoGrid      # Video layout (presenter/grid modes)
│   │   ├── ChatPanel      # Real-time chat
│   │   ├── ParticipantsPanel # User management
│   │   ├── RecordingPanel  # Local recording controls
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   ├── pages/              # Route pages (Home, Room)
│   └── utils/              # Helpers (hero names, etc.)
└── server/                 # Express backend
    ├── signaling.ts         # Socket.IO WebRTC signaling
    ├── routes/             # REST API endpoints
    ├── models/             # MongoDB/Mongoose models
    └── db/                 # Database connection
```

### How it Works

1. **Room Creation**: Owner creates a room via REST API, receives room ID and owner token
2. **Signaling**: Socket.IO handles WebRTC signaling (offer/answer/ICE candidates)
3. **Media**: Native WebRTC peer connections for video/audio
4. **Data Channels**: P2P file transfers and chat via WebRTC DataChannels
5. **Recording**: Client-side recording using Canvas API + MediaRecorder

## API Endpoints

### Rooms
- `POST /api/rooms/create` - Create a new room
- `GET /api/rooms/:id` - Get room info
- `POST /api/rooms/:id/join` - Join a room
- `POST /api/rooms/:id/recordings` - Upload recording

### Admin
- `POST /api/admin/login` - Admin login

## Permissions

Room owners can:
- Mute all guests
- Disable guest cameras
- Disable guest screen sharing
- Kick users
- Manage waiting room
- Configure room settings

## Creators

- **Juanjo Meroño**
- **Alex Balleste**
- **Edu Rey**

## File Structure

```
public/
├── img/                    # Static images
recordings/                 # Uploaded recordings (gitignored)
dist/                      # Production build output
```

## License

MIT License

## Contributing

Contributions welcome! Please submit issues and pull requests.
