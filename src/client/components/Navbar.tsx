import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon, ScreenShareIcon, ScreenShareStopIcon, UsersIcon, ChatIcon, SettingsIcon, RecordIcon, FilesIcon, ShareIcon } from './Icons';

interface NavbarProps {
  userName: string;
  roomId: string;
  isOwner: boolean;
  // Media state
  micOn: boolean;
  videoOn: boolean;
  screenSharing: boolean;
  // Disabled by owner
  micDisabled?: boolean;
  videoDisabled?: boolean;
  screenDisabled?: boolean;
  // Panel state
  participantsOpen: boolean;
  chatOpen: boolean;
  settingsOpen: boolean;
  recordingOpen: boolean;
  filesOpen: boolean;
  // Handlers
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleScreen: () => void;
  onToggleParticipants: () => void;
  onToggleChat: () => void;
  onToggleSettings: () => void;
  onToggleRecording: () => void;
  onToggleFiles: () => void;
}

export function Navbar({
  userName,
  roomId,
  isOwner,
  micOn,
  videoOn,
  screenSharing,
  micDisabled,
  videoDisabled,
  screenDisabled,
  participantsOpen,
  chatOpen,
  settingsOpen,
  recordingOpen,
  filesOpen,
  onToggleMic,
  onToggleVideo,
  onToggleScreen,
  onToggleParticipants,
  onToggleChat,
  onToggleSettings,
  onToggleRecording,
  onToggleFiles,
}: NavbarProps) {
  return (
    <header className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-800 shrink-0 h-12">
      {/* Left: brand + room ID */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-base font-bold text-gray-200 shrink-0">LooWID</span>
        <span className="text-[11px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded font-mono truncate max-w-[100px]">{roomId}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
          }}
          title="Copy room link"
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ShareIcon size={14} />
        </button>
      </div>

      {/* Center: media controls */}
      <div className="flex items-center gap-1">
        <NavButton
          active={micOn}
          onClick={onToggleMic}
          title={micDisabled ? 'Microphone disabled by owner' : (micOn ? 'Mute' : 'Unmute')}
          danger={!micOn && !micDisabled}
          disabled={micDisabled}
        >
          {micOn ? <MicIcon size={18} /> : <MicOffIcon size={18} />}
        </NavButton>

        <NavButton
          active={videoOn}
          onClick={onToggleVideo}
          title={videoDisabled ? 'Camera disabled by owner' : (videoOn ? 'Stop Video' : 'Start Video')}
          danger={!videoOn && !videoDisabled}
          disabled={videoDisabled}
        >
          {videoOn ? <VideoIcon size={18} /> : <VideoOffIcon size={18} />}
        </NavButton>

        <NavButton
          active={false}
          onClick={onToggleScreen}
          title={screenDisabled ? 'Screen share disabled by owner' : (screenSharing ? 'Stop Sharing' : 'Share Screen')}
          highlight={screenSharing}
          disabled={screenDisabled}
        >
          {screenSharing ? <ScreenShareStopIcon size={18} /> : <ScreenShareIcon size={18} />}
        </NavButton>

        <div className="w-px h-6 bg-gray-800 mx-1" />

        <NavButton
          active={filesOpen}
          onClick={onToggleFiles}
          title="File Transfers"
        >
          <FilesIcon size={18} />
        </NavButton>

        {isOwner && (
          <>
            <NavButton
              active={recordingOpen}
              onClick={onToggleRecording}
              title="Record / Stream"
              danger={recordingOpen}
            >
              <RecordIcon size={18} />
            </NavButton>

            <NavButton
              active={settingsOpen}
              onClick={onToggleSettings}
              title="Room Settings"
            >
              <SettingsIcon size={18} />
            </NavButton>
          </>
        )}
      </div>

      {/* Right: panel toggles + info */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 mr-1 hidden lg:inline max-w-[100px] truncate">
          {userName}
        </span>

        <NavButton
          active={participantsOpen}
          onClick={onToggleParticipants}
          title="Participants"
        >
          <UsersIcon size={18} />
        </NavButton>

        <NavButton
          active={chatOpen}
          onClick={onToggleChat}
          title="Chat"
        >
          <ChatIcon size={18} />
        </NavButton>
      </div>
    </header>
  );
}

function NavButton({ children, active, danger, highlight, disabled, onClick, title }: {
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  highlight?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
        disabled
          ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
          : danger
            ? 'bg-gray-700 text-red-400 hover:bg-gray-600'
            : highlight
              ? 'bg-gray-700 text-gray-100'
              : active
                ? 'bg-gray-700 text-gray-100'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      {children}
    </button>
  );
}
