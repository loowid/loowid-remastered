import { useRef, useCallback, useState } from 'react';

interface UseStreamingOptions {
  roomId: string;
  onStatusChange?: (status: 'idle' | 'connecting' | 'streaming' | 'error', error?: string) => void;
}

interface StreamSession {
  sessionId: string;
  wsUrl: string;
  ws: WebSocket | null;
  mediaRecorder: MediaRecorder | null;
  stream: MediaStream | null;
}

export function useStreaming({ roomId, onStatusChange }: UseStreamingOptions) {
  const sessionRef = useRef<StreamSession | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const startStreaming = useCallback(async (
    platform: 'youtube' | 'twitch',
    streamKey: string,
    canvasStream: MediaStream
  ): Promise<boolean> => {
    if (sessionRef.current) {
      console.warn('Already streaming');
      return false;
    }

    const sessionId = `${roomId}-${Date.now()}`;
    onStatusChange?.('connecting');

    try {
      // Call server to start streaming session
      const response = await fetch('/api/streaming/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, platform, streamKey }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start streaming');
      }

      const { wsUrl } = await response.json();

      // Connect to WebSocket
      const ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = (e) => reject(new Error('WebSocket connection failed'));
        ws.onclose = () => reject(new Error('WebSocket closed'));
      });

      // Use MediaRecorder to encode the canvas stream
      // Using VP8/VP9 for cross-browser compatibility
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm;codecs=vp8';

      const mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        onStatusChange?.('error', 'MediaRecorder error');
        stopStreaming();
      };

      // Start recording with timeslice for frequent data
      mediaRecorder.start(100);

      sessionRef.current = {
        sessionId,
        wsUrl,
        ws,
        mediaRecorder,
        stream: canvasStream,
      };

      setIsStreaming(true);
      onStatusChange?.('streaming');
      return true;
    } catch (error) {
      console.error('Failed to start streaming:', error);
      onStatusChange?.('error', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }, [roomId, onStatusChange]);

  const stopStreaming = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    // Stop MediaRecorder
    if (session.mediaRecorder && session.mediaRecorder.state !== 'inactive') {
      session.mediaRecorder.stop();
    }

    // Close WebSocket
    if (session.ws) {
      session.ws.close();
    }

    // Stop all tracks
    if (session.stream) {
      session.stream.getTracks().forEach(track => track.stop());
    }

    // Call server to stop streaming
    try {
      await fetch('/api/streaming/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
    } catch (error) {
      console.error('Failed to stop streaming on server:', error);
    }

    sessionRef.current = null;
    setIsStreaming(false);
    onStatusChange?.('idle');
  }, [onStatusChange]);

  return {
    startStreaming,
    stopStreaming,
    isStreaming,
  };
}
