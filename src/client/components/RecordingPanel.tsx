import { useState } from 'react';
import { XIcon, RecordIcon } from './Icons';

interface RecordingPanelProps {
  roomId: string;
  isOwner: boolean;
  isRecording: boolean;
  recordingTime: number;
  recordingLayout?: 'presenter' | 'grid';
  onStart: (options: { layout: 'presenter' | 'grid'; type: 'local' | 'youtube' | 'twitch'; streamKey?: string }) => void;
  onStop: () => void;
  onClose: () => void;
}

export function RecordingPanel({ roomId, isOwner, isRecording, recordingTime, recordingLayout = 'presenter', onStart, onStop, onClose }: RecordingPanelProps) {
  const [recordingType, setRecordingType] = useState<'local' | 'youtube' | 'twitch'>('local');
  const [layout, setLayout] = useState<'presenter' | 'grid'>(recordingLayout);
  const [youtubeKey, setYoutubeKey] = useState('');
  const [twitchKey, setTwitchKey] = useState('');

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    const streamKey = recordingType === 'youtube' ? youtubeKey : recordingType === 'twitch' ? twitchKey : undefined;
    
    if (recordingType !== 'local' && !streamKey) {
      alert(`Please enter your ${recordingType === 'youtube' ? 'YouTube' : 'Twitch'} stream key`);
      return;
    }
    
    onStart({ layout, type: recordingType, streamKey });
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 w-80">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <RecordIcon size={16} className="text-red-400" />
          <span className="font-semibold text-sm">Recording</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white">
          <XIcon size={16} />
        </button>
      </div>

      {!isRecording ? (
        <>
          <div className="space-y-2 mb-4">
            <RadioOption
              label="Local Recording"
              description="Captures video grid + mixed audio"
              selected={recordingType === 'local'}
              onClick={() => setRecordingType('local')}
            />
            <RadioOption
              label="Stream to YouTube"
              description="Coming soon (TODO: WebCodecs or AWS IVS)"
              selected={recordingType === 'youtube'}
              onClick={() => setRecordingType('youtube')}
              disabled={true}
            />
            <RadioOption
              label="Stream to Twitch"
              description="Coming soon (TODO: WebCodecs or AWS IVS)"
              selected={recordingType === 'twitch'}
              onClick={() => setRecordingType('twitch')}
              disabled={true}
            />
          </div>

          {recordingType === 'youtube' && (
            <input
              type="password"
              value={youtubeKey}
              onChange={(e) => setYoutubeKey(e.target.value)}
              placeholder="YouTube stream key"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs mb-3 focus:outline-none focus:border-blue-500"
            />
          )}
          {recordingType === 'twitch' && (
            <input
              type="password"
              value={twitchKey}
              onChange={(e) => setTwitchKey(e.target.value)}
              placeholder="Twitch stream key"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs mb-3 focus:outline-none focus:border-blue-500"
            />
          )}

          {/* Layout selection */}
          <div className="mb-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Recording Layout</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setLayout('presenter')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  layout === 'presenter'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Presenter
              </button>
              <button
                onClick={() => setLayout('grid')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  layout === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Grid
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">
              {layout === 'presenter' ? 'Follows live view layout (speaker focused)' : 'Equal sized tiles for all participants'}
            </p>
          </div>

          <button
            onClick={handleStart}
            className="w-full py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
          >
            <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
            {recordingType === 'local' ? 'Start Recording' : `Start Streaming to ${recordingType === 'youtube' ? 'YouTube' : 'Twitch'}`}
          </button>
        </>
      ) : (
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 font-mono text-lg">{formatTime(recordingTime)}</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Recording {recordingType === 'local' ? 'locally' : `to ${recordingType}`}
          </p>
          <p className="text-[10px] text-gray-600 mb-4">
            Layout: {layout === 'presenter' ? 'Presenter (speaker focused)' : 'Grid (equal tiles)'}
          </p>
          <button
            onClick={onStop}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium"
          >
            Stop Recording
          </button>
        </div>
      )}
    </div>
  );
}

function RadioOption({ label, description, selected, onClick, disabled }: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
        selected
          ? 'bg-blue-600/10 border-blue-500/50 text-white'
          : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:bg-gray-800'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <div className="text-xs font-medium">{label}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{description}</div>
    </button>
  );
}
