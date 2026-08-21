import { useState, useEffect } from 'react';

interface JoinModalProps {
  roomId: string;
  onJoin: (name: string, password?: string) => void;
}

export function JoinModal({ roomId, onJoin }: JoinModalProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/rooms/${roomId}/isJoinable`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (!data.joinable) {
          setError('Room not found or expired');
        } else if (data.locked) {
          setNeedsPassword(true);
        }
        setChecking(false);
      })
      .catch(() => {
        setError('Could not check room status');
        setChecking(false);
      });
  }, [roomId]);

  const handleJoin = () => {
    if (!name.trim()) return;
    onJoin(name.trim(), password || undefined);
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Checking room...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-1">Join Room</h2>
        <p className="text-sm text-gray-500 mb-6">
          Room: <span className="text-gray-400 font-mono">{roomId}</span>
        </p>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-2 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="Enter your display name"
              autoFocus
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {needsPassword && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Room Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="Enter room password"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={!name.trim() || !!error}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-medium text-white transition-colors"
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
}
