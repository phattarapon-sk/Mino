'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

const MAX_RECORD_SECONDS = 15 * 60; // 15 minutes

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Separate ref so auto-stop can call stop without stale closure
  const stopRef = useRef<(() => Promise<Blob>) | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;

      // Guard: if no recorder or already stopped
      if (!recorder || recorder.state === 'inactive') {
        // Still resolve with whatever chunks we have
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        resolve(blob.size > 0 ? blob : new Blob([], { type: 'audio/webm;codecs=opus' }));
        clearTimer();
        stopTracks();
        setIsRecording(false);
        return;
      }

      // Attach onstop BEFORE calling stop()
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        if (blob.size === 0) {
          reject(new Error('การบันทึกว่างเปล่า กรุณาลองใหม่'));
          return;
        }
        resolve(blob);
      };

      recorder.onerror = (e) => {
        reject(new Error(`MediaRecorder error: ${e}`));
      };

      clearTimer();
      recorder.stop();   // This triggers ondataavailable one last time, then onstop
      stopTracks();
      setIsRecording(false);
      mediaRecorderRef.current = null;
    });
  }, []);

  // Keep stopRef in sync
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick best supported mimeType
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(5000); // 5s timeslice
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setSeconds(0);

      // Auto-stop at 15 min
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_RECORD_SECONDS) {
            toast.info('หยุดอัดเสียงอัตโนมัติ', { description: 'ถึงขีดจำกัด 15 นาที' });
            // Use ref to avoid stale closure
            stopRef.current?.();
            clearTimer();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('ไม่สามารถเข้าถึงไมค์ได้', { description: msg });
    }
  }, []);

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    clearTimer();
    stopTracks();
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setSeconds(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      stopTracks();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return {
    isRecording,
    seconds,
    formattedTime: formatTime(seconds),
    start,
    stop,
    cancel,
  };
}
