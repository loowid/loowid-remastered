import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRandomHero, getSuperHero, saveUserName } from '../utils/heroes';

export function HomePage() {
  const [roomInput, setRoomInput] = useState('');
  const [userName, setUserName] = useState(() => {
    try {
      return localStorage.getItem('loowid_user_name') || getRandomHero();
    } catch {
      return getRandomHero();
    }
  });
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const handleRandomName = () => {
    const newName = getSuperHero();
    setUserName(newName);
  };

  const handleNameChange = (value: string) => {
    setUserName(value);
  };

  const createRoom = async () => {
    setCreating(true);
    try {
      const trimmedName = userName.trim() || getRandomHero();
      saveUserName(trimmedName);

      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });
      const data = await res.json();
      if (data.ownerToken && data.roomId) {
        try {
          localStorage.setItem(`loowid_owner_${data.roomId}`, data.ownerToken);
        } catch { /* ignore */ }
      }
      navigate(`/r/${data.roomId}`);
    } catch (err) {
      console.error('Failed to create room:', err);
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = () => {
    const id = roomInput.trim();
    if (id) {
      const trimmedName = userName.trim() || getRandomHero();
      saveUserName(trimmedName);
      navigate(`/r/${id}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gray-950">
      <div className="text-center mb-8">
        <h1 className="text-6xl font-black mb-3 tracking-tight text-gray-200">
          LooWID
        </h1>
        <p className="text-xl font-medium text-gray-400">Look What I'm Doing!</p>
        <p className="text-sm mt-2 max-w-md mx-auto text-gray-500">
          Free, open-source video conferencing, screen sharing, real-time chat, and P2P file transfers directly in your browser.
        </p>
      </div>

      <div className="w-full max-w-md space-y-5 p-6 rounded-2xl border bg-gray-900 border-gray-800">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-gray-400">
            Your Display Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={userName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. CaptainTiger"
              className="flex-1 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-gray-500 text-sm bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-500"
            />
            <button
              type="button"
              onClick={handleRandomName}
              title="Pick random superhero name"
              className="px-3 py-2.5 rounded-xl text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors"
            >
              Superhero
            </button>
          </div>
        </div>

        <button
          onClick={createRoom}
          disabled={creating}
          className="w-full py-3.5 px-6 rounded-xl text-base font-semibold transition-all text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 flex items-center justify-center gap-2"
        >
          {creating ? 'Creating room...' : 'Start a New Room (as Owner)'}
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-gray-900 text-gray-500">or join existing room</span>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            placeholder="Enter Room ID"
            className="flex-1 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-gray-500 text-sm bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-500"
          />
          <button
            onClick={joinRoom}
            disabled={!roomInput.trim()}
            className="py-2.5 px-5 rounded-xl font-semibold text-sm transition-colors bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Join
          </button>
        </div>
      </div>

      <footer className="mt-12 text-xs text-center text-gray-600">
        LooWID Remastered &middot; Open source WebRTC conferencing &middot; MIT License
      </footer>
    </div>
  );
}
