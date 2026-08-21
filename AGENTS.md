# LooWID Development Guide

## Commands

```bash
npm run dev          # Run both server (3000) and client (5173) concurrently
npm run dev:server   # Server only with tsx watch
npm run dev:client   # Client only with Vite (proxy: /api, /socket.io → localhost:3000)
npm run build        # vite build + tsc -p tsconfig.server.json
npm run start        # node dist/server/index.js (production)
npm run lint         # eslint src/
npm run typecheck    # tsc --noEmit + tsc -p tsconfig.server.json --noEmit
npm run test         # vitest run
```

## Architecture

- **Client**: React 19 + Vite + Tailwind CSS v4 + Socket.IO client
- **Server**: Express + Socket.IO + mediasoup + MongoDB/Mongoose
- **WebRTC**: signaling via Socket.IO, media via mediasoup

### Directory Structure
```
src/
├── client/
│   ├── main.tsx          # Client entry
│   ├── App.tsx            # Router setup
│   ├── pages/             # HomePage, RoomPage
│   ├── components/        # UI components (Navbar, VideoGrid, ChatPanel, etc.)
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Utilities (heroes.ts)
│   └── workers/           # Web Workers (recordingWorker)
└── server/
    ├── index.ts           # Server entry
    ├── app.ts             # Express app setup
    ├── signaling.ts       # Socket.IO WebRTC signaling
    ├── streaming.ts       # RTMP streaming (mediasoup)
    ├── routes/            # API routes (rooms, admin, streaming)
    ├── models/            # Mongoose models
    └── db/                # Database connection
```

## Tailwind CSS v4

Uses `@import "tailwindcss"` (not v3 directives). Dark theme classes:
- `bg-gray-950` - main background
- `bg-gray-900` - panels, navbar
- `bg-gray-800` - cards, inputs
- `border-gray-800` / `border-gray-700` - borders
- `text-gray-200` / `text-gray-400` / `text-gray-500` - text hierarchy

**Important**: `src/client/index.css` has light body defaults (`background-color: #F8F8F8`). Components override these with inline Tailwind classes for dark theme.

## Environment

- Server port: `PORT` (default 3000)
- MongoDB: `MONGODB_URI` (default `mongodb://localhost:27017/loowid`)
- Session secret: `SESSION_SECRET`
- Recordings: `/recordings` directory - Docker `node` user needs write access

## Owner Recognition

Owner status stored in localStorage: `loowid_owner_${roomId}` contains the ownerToken.

## Key Workflows

### Creating a Room
1. POST `/api/rooms/create` → returns `{ roomId, ownerToken }`
2. Store `ownerToken` in localStorage: `loowid_owner_${roomId}`
3. Navigate to `/r/${roomId}`

### Hero Names
- Random hero: `getRandomHero()` from `src/client/utils/heroes.ts` (Batman, Superman, etc.)
- Superhero: `getSuperHero()` generates "CaptainTiger", "SuperEagle", etc.
- Stored in localStorage: `loowid_user_name` and `loowid_name_${roomId}`

### Recording
- Uses Web Worker (`recordingWorker`) for canvas compositing at 30fps
- Hidden video elements (Map of `<video>`) registered for recording
- MediaRecorder with `video/webm;codecs=vp9` for local recording
- Recordings saved via POST `/api/rooms/${roomId}/recordings`

## Testing

Tests use Vitest. Run with `npm test` or `npm run test:watch` for watch mode.

## Style Conventions

- React components use TypeScript interfaces
- Tailwind classes for styling (prefer existing patterns)
- Socket event handlers in `signaling.ts`
- API routes in `src/server/routes/*.ts`
