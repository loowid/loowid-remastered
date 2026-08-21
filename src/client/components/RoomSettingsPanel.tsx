import { useState, useEffect } from 'react';
import { XIcon, PlayIcon, TrashIcon, DownloadIcon } from './Icons';

interface RoomSettings {
  permanent: boolean;
  allowDownloads: boolean;
  waitingRoom: boolean;
  disableGuestMics: boolean;
  disableGuestVideo: boolean;
  disableGuestScreen: boolean;
  disableGuestChat: boolean;
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

interface RoomSettingsPanelProps {
  roomId: string;
  settings: RoomSettings;
  recordings: Recording[];
  onClose: () => void;
  onSettingsChange: (settings: Partial<RoomSettings>) => void;
  onDeleteRecording: (recordingId: string) => void;
}

export function RoomSettingsPanel({
  roomId,
  settings: initialSettings,
  recordings,
  onClose,
  onSettingsChange,
  onDeleteRecording,
}: RoomSettingsPanelProps) {
  const [draft, setDraft] = useState<RoomSettings>(initialSettings);
  const [tab, setTab] = useState<'access' | 'recordings'>('access');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [playingRecording, setPlayingRecording] = useState<Recording | null>(null);

  useEffect(() => { setDraft(initialSettings); }, [initialSettings]);

  const update = (key: keyof RoomSettings, value: boolean | number) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(initialSettings);

  const save = () => {
    onSettingsChange(draft);
  };

  const cancel = () => {
    setDraft(initialSettings);
    onClose();
  };

  const handleDelete = (id: string) => {
    if (confirmDelete === id) {
      onDeleteRecording(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(prev => prev === id ? null : prev), 3000);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl w-80 max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <span className="font-semibold text-sm">Room Settings</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white">
          <XIcon size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 shrink-0">
        <button
          onClick={() => setTab('access')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            tab === 'access' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Access & Control
        </button>
        <button
          onClick={() => setTab('recordings')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            tab === 'recordings' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Recordings ({recordings.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'access' ? (
          <>
            <Toggle
              label="Permanent room"
              description="Room won't expire after inactivity"
              checked={draft.permanent}
              onChange={(v) => update('permanent', v)}
            />
            <Toggle
              label="Waiting room"
              description="Guests wait for owner approval before joining"
              checked={draft.waitingRoom}
              onChange={(v) => update('waitingRoom', v)}
            />
            <div className="border-t border-gray-800 pt-3">
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">Guest restrictions</p>
            </div>
            <Toggle
              label="Disable guest mics"
              description="Mute all guests' microphones"
              checked={draft.disableGuestMics}
              onChange={(v) => update('disableGuestMics', v)}
            />
            <Toggle
              label="Disable guest video"
              description="Turn off all guests' cameras"
              checked={draft.disableGuestVideo}
              onChange={(v) => update('disableGuestVideo', v)}
            />
            <Toggle
              label="Disable guest screen share"
              description="Prevent guests from sharing their screen"
              checked={draft.disableGuestScreen}
              onChange={(v) => update('disableGuestScreen', v)}
            />
            <Toggle
              label="Disable guest chat"
              description="Prevent guests from sending chat messages"
              checked={draft.disableGuestChat}
              onChange={(v) => update('disableGuestChat', v)}
            />
            <Toggle
              label="Allow guest file sharing"
              description="Guests can send files to the room"
              checked={draft.allowGuestFileSharing}
              onChange={(v) => update('allowGuestFileSharing', v)}
            />
            <div className="border-t border-gray-800 pt-3">
              <label className="text-xs text-gray-400 block mb-1.5">Max participants (0 = unlimited)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={draft.maxParticipants}
                onChange={(e) => update('maxParticipants', parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </>
        ) : (
          <>
            {recordings.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-6">No recordings yet</p>
            ) : (
              recordings.map(rec => (
                <div key={rec.id} className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs truncate flex-1 mr-2">{rec.filename || rec.id}</span>
                    <span className="text-[10px] text-gray-500 capitalize shrink-0">{rec.type}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-gray-600">
                      {new Date(rec.created).toLocaleDateString()} · {formatSize(rec.size)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {rec.url && (
                      <button
                        onClick={() => setPlayingRecording(rec)}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded transition-colors"
                      >
                        <PlayIcon size={10} />
                        Play
                      </button>
                    )}
                    {rec.url && (
                      <a
                        href={rec.url}
                        download={`${rec.filename || 'recording'}.webm`}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                      >
                        <DownloadIcon size={10} />
                        Download
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors ${
                        confirmDelete === rec.id
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-700 hover:bg-red-600/30 text-gray-400 hover:text-red-400'
                      }`}
                    >
                      <TrashIcon size={10} />
                      {confirmDelete === rec.id ? 'Confirm?' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-gray-800 shrink-0 flex items-center justify-between gap-2">
        <span className="text-[10px] text-gray-600 font-mono truncate">{roomId}</span>
        <div className="flex gap-2">
          <button
            onClick={cancel}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!hasChanges}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs font-medium text-white transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Video player modal */}
      {playingRecording && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-medium truncate">{playingRecording.filename || playingRecording.id}</span>
              <button onClick={() => setPlayingRecording(null)} className="text-gray-500 hover:text-white">
                <XIcon size={16} />
              </button>
            </div>
            <div className="p-4 flex-1 flex items-center justify-center min-h-0">
              <video
                src={playingRecording.url}
                controls
                className="w-full max-h-[60vh] rounded-lg"
                autoPlay
              />
            </div>
            <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
              <a
                href={playingRecording.url}
                download={`${playingRecording.filename || 'recording'}.webm`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium text-white transition-colors"
              >
                <DownloadIcon size={12} />
                Download .webm
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="mt-0.5">
        <div
          className={`w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-blue-600' : 'bg-gray-700'}`}
          onClick={() => onChange(!checked)}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`} />
        </div>
      </div>
      <div>
        <span className="text-xs text-gray-300 group-hover:text-white transition-colors">{label}</span>
        <p className="text-[10px] text-gray-600 mt-0.5">{description}</p>
      </div>
    </label>
  );
}
