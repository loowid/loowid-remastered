import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Peer {
  id: string;
  stream?: MediaStream;
  name?: string;
  videoEnabled: boolean;
  audioEnabled: boolean;
  screenEnabled: boolean;
  lastAudioTime?: number;
  audioLevel?: number;
}

interface VideoGridProps {
  localStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  peers: Peer[];
  participantsOpen: boolean;
  chatOpen: boolean;
  maxParticipants?: number;
}

type LayoutMode = 'presenter' | 'grid';

interface VideoItem {
  id: string;
  stream?: MediaStream;
  name?: string;
  muted?: boolean;
  speaking?: boolean;
  isScreen?: boolean;
}

function VideoTile({ item, onClick, isMain, noAspect }: { 
  item: VideoItem; 
  onClick?: () => void; 
  isMain?: boolean;
  noAspect?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (item.stream) {
      el.srcObject = item.stream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }

    return () => {
      if (el) el.srcObject = null;
    };
  }, [item.stream]);

  const initials = (item.name || '?')[0].toUpperCase();
  const objectFit = item.isScreen ? 'object-contain' : 'object-cover';

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={`relative w-full h-full rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
        item.speaking ? 'ring-2 ring-green-500' : isMain ? 'ring-2 ring-gray-600' : ''
      }`}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {item.stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={item.muted}
            controls={false}
            disablePictureInPicture={true}
            className={`max-w-full max-h-full ${objectFit} bg-black`}
          />
        ) : (
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold bg-gray-700 text-gray-200">
            {initials}
          </div>
        )}
      </div>

      {/* Name and speaking indicator */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 flex items-center gap-1.5">
        {item.speaking && (
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
        )}
        <span className="text-[11px] text-white font-medium truncate">{item.name || 'Guest'}</span>
      </div>
    </div>
  );
}

// Presenter layout - main view + sidebar thumbnails
function PresenterLayout({
  presenter,
  videos,
  page,
  perPage,
  onPageChange,
  onSelectVideo
}: {
  presenter: VideoItem;
  videos: VideoItem[];
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onSelectVideo: (id: string) => void;
}) {
  const isScreen = presenter.isScreen;
  
  const start = page * perPage;
  const visible = videos.slice(start, start + perPage);
  const totalPages = Math.ceil(videos.length / perPage);

  // Determine thumbnail layout: 1 column if <= 4, 2 columns if > 4
  const thumbCols = videos.length <= 4 ? 1 : 2;
  const thumbRows = Math.ceil(visible.length / thumbCols) || 1;

  return (
    <div className="flex w-full h-full overflow-hidden">
      {/* Main presenter view - fills available height, video maintains aspect */}
      <div className="flex-1 min-w-0 h-full flex items-center justify-center p-1">
        <VideoTile item={presenter} isMain noAspect />
      </div>

      {/* Thumbnail sidebar - 15% width */}
      {visible.length > 0 && (
        <div className="w-[15%] flex-shrink-0 flex flex-col overflow-hidden">
          <div
            className="flex-1 grid gap-1 p-1"
            style={{
              gridTemplateColumns: `repeat(${thumbCols}, 1fr)`,
              gridTemplateRows: `repeat(${thumbRows}, 1fr)`
            }}
          >
            {visible.map((v) => (
              <div key={v.id} className="m-0.5 flex items-center justify-center">
                <VideoTile
                  item={v}
                  onClick={() => onSelectVideo(v.id)}
                />
              </div>
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-1.5 bg-gray-900/50 rounded flex-shrink-0">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page === 0}
                className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded text-[10px] text-gray-400"
              >
                ←
              </button>
              <span className="text-[10px] text-gray-500">{page + 1}/{totalPages}</span>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages - 1}
                className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded text-[10px] text-gray-400"
              >
                →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Calculate grid layout based on participant count
function calculateGridLayout(count) {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count <= 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  if (count <= 12) return { cols: 4, rows: 3 };
  if (count <= 16) return { cols: 4, rows: 4 };
  return { cols: 4, rows: 4, paginated: true };
}

// Grid layout - follows specific pattern
function GridLayout({ 
  videos, 
  page, 
  perPage,
  onPageChange,
  onSelectVideo 
}: { 
  videos: VideoItem[];
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onSelectVideo: (id: string) => void;
}) {
  const layout = calculateGridLayout(videos.length);
  const actualPerPage = layout.paginated ? layout.cols * layout.rows : videos.length;
  
  const start = page * actualPerPage;
  const visible = videos.slice(start, start + actualPerPage);
  const totalPages = Math.ceil(videos.length / actualPerPage);
  
  const count = visible.length;
  const { cols, rows } = layout;

  // Calculate centering offset for last row
  const itemsInLastRow = count % cols;
  const offset = itemsInLastRow === 0 ? 0 : Math.floor((cols - itemsInLastRow) / 2);

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      <div 
        className="flex-1 grid gap-1 p-1"
        style={{ 
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`
        }}
      >
        {visible.map((v, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const isInLastRow = row === rows - 1;
          
          if (isInLastRow && itemsInLastRow > 0 && col < offset) {
            return <div key={v.id} className="hidden" />;
          }
          
          return (
            <div key={v.id} className="m-1 flex items-center justify-center">
              <VideoTile
                item={v}
                onClick={() => onSelectVideo(v.id)}
              />
            </div>
          );
        })}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-1.5 mt-1 border-t border-gray-800 flex-shrink-0">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded text-[10px] text-gray-400"
          >
            ← Prev
          </button>
          <span className="text-[10px] text-gray-500">{page + 1} / {totalPages}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded text-[10px] text-gray-400"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export function VideoGrid({ localStream, localScreenStream, peers, participantsOpen, chatOpen }: VideoGridProps) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('presenter');
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const perPage = 8;

  // Build video list with proper ordering
  const allVideos = React.useMemo(() => {
    const videos: VideoItem[] = [];

    if (localScreenStream) {
      videos.push({ id: 'local-screen', stream: localScreenStream, name: 'Your Screen', muted: true, speaking: false, isScreen: true });
    }

    if (localStream) {
      videos.push({ id: 'local', stream: localStream, name: 'You', muted: true, speaking: true, isScreen: false });
    }

    for (const p of peers) {
      if (p.stream) {
        if (p.screenEnabled) {
          videos.push({ id: `${p.id}-screen`, stream: p.stream, name: `${p.name || 'User'}'s Screen`, muted: true, speaking: false, isScreen: true });
        } else {
          const isSpeaking = p.audioLevel && p.audioLevel > 0.1 && Date.now() - (p.lastAudioTime || 0) < 500;
          videos.push({ id: p.id, stream: p.stream, name: p.name || 'Guest', muted: p.muted, speaking: isSpeaking, isScreen: false });
        }
      }
    }

    return videos;
  }, [localStream, localScreenStream, peers]);

  // Get presenter based on featured or auto-detection
  const presenter = React.useMemo(() => {
    if (featuredId) {
      const featured = allVideos.find(v => v.id === featuredId);
      if (featured) return featured;
    }

    const screenShares = allVideos.filter(v => v.isScreen);
    if (screenShares.length > 0) return screenShares[0];

    const speakers = allVideos.filter(v => v.speaking && !v.isScreen && v.id !== 'local');
    if (speakers.length > 0) return speakers[0];

    const local = allVideos.find(v => v.id === 'local');
    if (local) return local;

    return allVideos[0];
  }, [allVideos, featuredId]);

  // Get presenter camera (the presenter's camera if screen sharing)
  const presenterCamera = React.useMemo(() => {
    if (!presenter?.isScreen) return undefined;

    if (presenter.id === 'local-screen') {
      return allVideos.find(v => v.id === 'local');
    }

    const peerId = presenter.id.replace('-screen', '');
    return allVideos.find(v => v.id === peerId);
  }, [presenter, allVideos]);

  // Filter thumbnails - only exclude presenter
  const thumbnails = React.useMemo(() => {
    return allVideos.filter(v => {
      if (v.id === presenter?.id) return false;
      return true;
    });
  }, [allVideos, presenter]);

  // Reset page when presenter changes
  useEffect(() => {
    setPage(0);
  }, [presenter?.id]);

  const handleSelectVideo = useCallback((id: string) => {
    setFeaturedId(id);
    setLayoutMode('presenter');
  }, []);

  if (allVideos.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-gray-950">
        <div className="text-center">
          <div className="text-5xl mb-3 opacity-30">📹</div>
          <div className="text-xl mb-1 text-gray-400">No participants</div>
          <p className="text-sm text-gray-500">Share the room link to invite others</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-gray-950">
      {/* Header controls */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800 shrink-0 bg-gray-900">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLayoutMode('presenter')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              layoutMode === 'presenter' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Presenter
          </button>
          <button
            onClick={() => setLayoutMode('grid')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              layoutMode === 'grid' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Grid
          </button>
        </div>

        {featuredId && (
          <button
            onClick={() => setFeaturedId(null)}
            className="px-2 py-1 rounded text-[10px] bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            ← Auto
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {presenter && (
          layoutMode === 'presenter' ? (
            <PresenterLayout
              presenter={presenter}
              videos={thumbnails}
              page={page}
              perPage={perPage}
              onPageChange={setPage}
              onSelectVideo={handleSelectVideo}
            />
          ) : (
            <GridLayout
              videos={allVideos}
              page={page}
              perPage={perPage}
              onPageChange={setPage}
              onSelectVideo={handleSelectVideo}
            />
          )
        )}
      </div>
    </div>
  );
}
