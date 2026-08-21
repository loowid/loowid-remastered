import { useState, useRef, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

interface ChatMessage {
  id: string;
  text: string;
  name?: string;
  time: Date;
  self: boolean;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function ChatPanel({ messages, onSend, collapsed, onToggle, disabled }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  // Collapsed state
  if (collapsed) {
    return (
      <div className="flex flex-col items-center justify-start pt-3 border-l w-10 shrink-0 transition-all duration-300 bg-gray-900 border-gray-800">
        <button
          onClick={onToggle}
          title="Show chat"
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ChevronLeftIcon size={16} />
        </button>
        {messages.length > 0 && (
          <span className="text-[10px] mt-1.5 text-gray-500">
            {messages.length}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-l w-64 shrink-0 transition-all duration-300 bg-gray-900 border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 shrink-0">
        <span className="font-medium text-xs text-gray-200">Chat</span>
        <button
          onClick={onToggle}
          title="Hide chat"
          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ChevronRightIcon size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.self ? 'items-end' : 'items-start'}`}>
            <span className="text-[10px] text-gray-500 mb-0.5">
              {msg.self ? 'You' : (msg.name || 'Anon')}
            </span>
            <div className={`px-2.5 py-1.5 rounded-lg max-w-[90%] text-xs leading-relaxed ${
              msg.self
                ? 'bg-gray-700 text-white'
                : 'bg-gray-800 text-gray-200'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-gray-800 shrink-0">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !disabled && send()}
            placeholder={disabled ? 'Chat disabled by owner' : 'Message...'}
            disabled={disabled}
            className="flex-1 px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-500"
          />
          <button
            onClick={send}
            disabled={disabled}
            className="px-3 py-1.5 rounded text-xs font-medium disabled:cursor-not-allowed bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:bg-gray-800 disabled:text-gray-500 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
