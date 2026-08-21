import { useState, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, MicIcon, MicOffIcon, VideoIcon, VideoOffIcon, ScreenShareIcon, ScreenShareStopIcon, XIcon } from './Icons';

interface RoomSettings {
  disableGuestMics: boolean;
  disableGuestVideo: boolean;
  disableGuestScreen: boolean;
}

interface Participant {
  id: string;
  name?: string;
  videoEnabled: boolean;
  audioEnabled: boolean;
  screenEnabled: boolean;
  isOwner?: boolean;
  muted?: boolean;
  videoDisabled?: boolean;
  screenDisabled?: boolean;
}

interface ParticipantsPanelProps {
  participants: Participant[];
  localId: string;
  collapsed: boolean;
  onToggle: () => void;
  isOwner: boolean;
  roomSettings: RoomSettings;
  waitingUsers?: Array<{ id: string; name: string }>;
  onAdmit?: (targetId: string) => void;
  onReject?: (targetId: string) => void;
  onForceMute?: (targetId: string) => void;
  onForceCameraOff?: (targetId: string) => void;
  onForceScreenStop?: (targetId: string) => void;
  onBlockMic?: (targetId: string) => void;
  onUnblockMic?: (targetId: string) => void;
  onBlockCamera?: (targetId: string) => void;
  onUnblockCamera?: (targetId: string) => void;
  onBlockScreen?: (targetId: string) => void;
  onUnblockScreen?: (targetId: string) => void;
  onKickUser?: (targetId: string) => void;
  onGlobalMute?: () => void;
  onFileToAll?: (files: File[]) => void;
  onFileToUser?: (targetId: string, files: File[]) => void;
}

export function ParticipantsPanel({
  participants,
  localId,
  collapsed,
  onToggle,
  isOwner,
  roomSettings,
  waitingUsers = [],
  onAdmit,
  onReject,
  onForceMute,
  onForceCameraOff,
  onForceScreenStop,
  onBlockMic,
  onUnblockMic,
  onBlockCamera,
  onUnblockCamera,
  onBlockScreen,
  onUnblockScreen,
  onKickUser,
  onGlobalMute,
  onFileToAll,
  onFileToUser,
}: ParticipantsPanelProps) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileTarget, setFileTarget] = useState<'all' | string>('all');

  const openFilePicker = (target: 'all' | string) => {
    setFileTarget(target);
    fileInputRef.current?.click();
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (fileTarget === 'all') onFileToAll?.(files);
    else onFileToUser?.(fileTarget, files);
    e.target.value = '';
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center justify-start pt-3 border-r w-10 shrink-0 transition-all duration-300 bg-gray-900 border-gray-800">
        <button onClick={onToggle} title="Show participants"
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
          <ChevronRightIcon size={16} />
        </button>
        <span className="text-[10px] mt-1.5 text-gray-500">
          {participants.length}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-r w-56 shrink-0 transition-all duration-300 bg-gray-900 border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 shrink-0">
        <span className="font-medium text-xs text-gray-200">
          Participants ({participants.length})
        </span>
        <div className="flex items-center gap-1">
          {isOwner && (
            <button
              onClick={onGlobalMute}
              title="Mute all guests"
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
            >
              Mute All
            </button>
          )}
          <button onClick={onToggle} title="Hide"
            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <ChevronLeftIcon size={14} />
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple onChange={handleFiles} className="hidden" />

      {/* Waiting room (owner only) */}
      {isOwner && waitingUsers.length > 0 && (
        <div className="border-b border-gray-800">
          <div className="px-3 py-1.5 border-b bg-gray-800 border-gray-800">
            <span className="text-[10px] font-medium text-gray-400">Waiting ({waitingUsers.length})</span>
          </div>
          {waitingUsers.map((u) => (
            <div key={u.id} className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-gray-700 text-gray-200">
                  {(u.name || 'U')[0].toUpperCase()}
                </div>
                <span className="text-xs truncate text-gray-300">{u.name || 'Anon'}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => onAdmit?.(u.id)}
                  className="text-[10px] px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
                  Admit
                </button>
                <button onClick={() => onReject?.(u.id)}
                  className="text-[10px] px-2 py-0.5 rounded bg-red-900/50 hover:bg-red-800/50 text-red-400 transition-colors">
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Participant list */}
      <div className="flex-1 overflow-y-auto">
        {participants.map((p) => {
          const isSelf = p.id === localId;
          const isSelected = selectedUser === p.id;

          return (
            <div key={p.id}
              className={`px-3 py-2 border-b border-gray-800 cursor-pointer transition-colors ${
                isSelected ? 'bg-gray-800' : 'hover:bg-gray-800/50'
              }`}
              onClick={() => setSelectedUser(isSelected ? null : p.id)}
            >
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  p.isOwner ? 'bg-blue-600/80 text-white' : 'bg-gray-700 text-gray-200'
                }`}>
                  {(p.name || 'U')[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs truncate text-gray-200">
                      {isSelf ? `${p.name || 'You'} (You)` : p.name || 'Anon'}
                    </span>
                    {p.isOwner && (
                      <span className="text-[9px] bg-blue-600/20 text-blue-400 px-0.5 rounded">own</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MediaIcon
                      type="mic"
                      enabled={p.audioEnabled}
                      blocked={!!p.muted}
                    />
                    <MediaIcon
                      type="video"
                      enabled={p.videoEnabled}
                      blocked={!!p.videoDisabled}
                    />
                    <MediaIcon
                      type="screen"
                      enabled={p.screenEnabled}
                      blocked={!!p.screenDisabled}
                    />
                  </div>
                </div>
              </div>

              {/* Expanded: owner controls */}
              {isSelected && isOwner && !isSelf && (
                <div className="mt-2 ml-9 flex flex-wrap gap-1">
                  {roomSettings.disableGuestMics ? (
                    <OwnerBtn
                      icon={p.muted ? <MicIcon size={12} /> : <MicOffIcon size={12} />}
                      title={p.muted ? 'Allow mic' : 'Disallow mic'}
                      active={!p.muted}
                      onClick={(e) => {
                        e.stopPropagation();
                        p.muted ? onUnblockMic?.(p.id) : onBlockMic?.(p.id);
                      }}
                    />
                  ) : (
                    p.audioEnabled && (
                      <OwnerBtn
                        icon={<MicOffIcon size={12} />}
                        title="Mute"
                        onClick={(e) => {
                          e.stopPropagation();
                          onForceMute?.(p.id);
                        }}
                      />
                    )
                  )}

                  {roomSettings.disableGuestVideo ? (
                    <OwnerBtn
                      icon={p.videoDisabled ? <VideoIcon size={12} /> : <VideoOffIcon size={12} />}
                      title={p.videoDisabled ? 'Allow camera' : 'Disallow camera'}
                      active={!p.videoDisabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        p.videoDisabled ? onUnblockCamera?.(p.id) : onBlockCamera?.(p.id);
                      }}
                    />
                  ) : (
                    p.videoEnabled && (
                      <OwnerBtn
                        icon={<VideoOffIcon size={12} />}
                        title="Disable camera"
                        onClick={(e) => {
                          e.stopPropagation();
                          onForceCameraOff?.(p.id);
                        }}
                      />
                    )
                  )}

                  {roomSettings.disableGuestScreen ? (
                    <OwnerBtn
                      icon={p.screenDisabled ? <ScreenShareIcon size={12} /> : <ScreenShareStopIcon size={12} />}
                      title={p.screenDisabled ? 'Allow screen share' : 'Disallow screen share'}
                      active={!p.screenDisabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        p.screenDisabled ? onUnblockScreen?.(p.id) : onBlockScreen?.(p.id);
                      }}
                    />
                  ) : (
                    p.screenEnabled && (
                      <OwnerBtn
                        icon={<ScreenShareStopIcon size={12} />}
                        title="Stop screen share"
                        onClick={(e) => {
                          e.stopPropagation();
                          onForceScreenStop?.(p.id);
                        }}
                      />
                    )
                  )}

                  <OwnerBtn
                    icon={<XIcon size={12} />}
                    title="Kick user"
                    danger
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Kick ${p.name || 'this user'}?`)) onKickUser?.(p.id);
                    }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); openFilePicker(p.id); }}
                    className="text-[10px] px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                  >
                    Send file
                  </button>
                </div>
              )}

              {/* Expanded: non-owner actions */}
              {isSelected && !isOwner && !isSelf && (
                <div className="mt-2 ml-9">
                  <button
                    onClick={(e) => { e.stopPropagation(); openFilePicker(p.id); }}
                    className="text-[10px] px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                  >
                    Send file
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OwnerBtn({ icon, title, active, danger, onClick }: {
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  danger?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
        danger
          ? 'bg-gray-700 text-red-400 hover:bg-red-600/30 hover:text-red-300'
          : active
            ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
            : 'bg-gray-700 text-yellow-400 hover:bg-gray-600'
      }`}
    >
      {icon}
    </button>
  );
}

function MediaIcon({ type, enabled, blocked }: { type: 'mic' | 'video' | 'screen'; enabled: boolean; blocked: boolean }) {
  if (blocked) {
    return type === 'mic' ? <MicOffIcon size={12} className="text-red-500" />
      : type === 'video' ? <VideoOffIcon size={12} className="text-red-500" />
      : <ScreenShareStopIcon size={12} className="text-red-500" />;
  }
  if (!enabled) {
    return type === 'mic' ? <MicOffIcon size={12} className="text-gray-600" />
      : type === 'video' ? <VideoOffIcon size={12} className="text-gray-600" />
      : null;
  }
  return type === 'mic' ? <MicIcon size={12} className="text-green-500" />
    : type === 'video' ? <VideoIcon size={12} className="text-green-500" />
    : <ScreenShareIcon size={12} className="text-blue-500" />;
}
