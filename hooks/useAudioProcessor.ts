'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { SummaryMode } from '@/lib/typhoon';

const MAX_CHUNK_SIZE_MB = 25;
const MAX_CHUNK_SIZE_BYTES = MAX_CHUNK_SIZE_MB * 1024 * 1024;
const BUCKET = 'temp-audio';

export interface ProcessingState {
  isProcessing: boolean;
  currentStep: 'idle' | 'normalize' | 'split' | 'upload' | 'transcribe' | 'summarize' | 'done';
  currentChunk: number;
  totalChunks: number;
  progress: number; // 0-100
}

export interface JobResult {
  jobId: string;
  summary: string;
  keyPoints: string[];
  fullTranscript: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Try to load ffmpeg.wasm; returns null if unavailable (no SharedArrayBuffer etc.) */
async function tryLoadFFmpeg() {
  try {
    if (typeof SharedArrayBuffer === 'undefined') {
      console.warn('[ffmpeg] SharedArrayBuffer not available — skipping ffmpeg');
      return null;
    }
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ffmpeg;
  } catch (e) {
    console.warn('[ffmpeg] Failed to load — will skip normalize/split:', e);
    return null;
  }
}

/**
 * Split a large Blob into ≤ MAX_CHUNK_SIZE_BYTES chunks (byte split — no re-encode).
 * Used only as fallback when ffmpeg is unavailable.
 */
function splitBlobBySize(blob: Blob): Blob[] {
  if (blob.size <= MAX_CHUNK_SIZE_BYTES) return [blob];
  const chunks: Blob[] = [];
  let offset = 0;
  while (offset < blob.size) {
    chunks.push(blob.slice(offset, offset + MAX_CHUNK_SIZE_BYTES, blob.type));
    offset += MAX_CHUNK_SIZE_BYTES;
  }
  return chunks;
}

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

export function useAudioProcessor() {
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    currentStep: 'idle',
    currentChunk: 0,
    totalChunks: 1,
    progress: 0,
  });
  const [result, setResult] = useState<JobResult | null>(null);
  const ffmpegRef = useRef<import('@ffmpeg/ffmpeg').FFmpeg | null>(null);
  const ffmpegLoaded = useRef(false);

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegLoaded.current && ffmpegRef.current) return ffmpegRef.current;
    const ff = await tryLoadFFmpeg();
    if (ff) {
      ffmpegRef.current = ff;
      ffmpegLoaded.current = true;
    }
    return ff;
  }, []);

  // ── Main pipeline ──────────────────────────────────────────────────────────
  const processAudio = useCallback(
    async (file: File, jobId: string, mode: SummaryMode = 'general') => {
      setState({
        isProcessing: true,
        currentStep: 'normalize',
        currentChunk: 0,
        totalChunks: 1,
        progress: 5,
      });

      try {
        // ── Step 1: Try ffmpeg normalize + split ─────────────────────────────
        let uploadBlobs: { blob: Blob; ext: string }[] = [];

        const ffmpeg = await loadFFmpeg();

        if (ffmpeg) {
          // ffmpeg available — normalize and optionally split
          const { fetchFile } = await import('@ffmpeg/util');
          const ext = file.name.slice(file.name.lastIndexOf('.')) || '.wav';
          const inputName = `input${ext}`;

          await ffmpeg.writeFile(inputName, await fetchFile(file));
          setState((s) => ({ ...s, currentStep: 'split', progress: 15 }));

          if (file.size > MAX_CHUNK_SIZE_BYTES) {
            // Normalize full → segment
            await ffmpeg.exec([
              '-i', inputName,
              '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
              '-ar', '16000', '-ac', '1',
              '-c:a', 'pcm_s16le',
              'normalized.wav',
            ]);
            await ffmpeg.exec([
              '-i', 'normalized.wav',
              '-f', 'segment',
              '-segment_time', String(15 * 60),
              '-c', 'copy',
              'chunk_%03d.wav',
            ]);
            const dir = await ffmpeg.listDir('/');
            const names = dir
              .filter((f) => !f.isDir && f.name.startsWith('chunk_') && f.name.endsWith('.wav'))
              .map((f) => f.name)
              .sort();

            for (const name of names) {
              const data = await ffmpeg.readFile(name);
              uploadBlobs.push({ blob: new Blob([data as any], { type: 'audio/wav' }), ext: '.wav' });
            }
          } else {
            // Normalize only
            await ffmpeg.exec([
              '-i', inputName,
              '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
              '-ar', '16000', '-ac', '1',
              '-c:a', 'pcm_s16le',
              'normalized.wav',
            ]);
            const data = await ffmpeg.readFile('normalized.wav');
            uploadBlobs = [{ blob: new Blob([data as any], { type: 'audio/wav' }), ext: '.wav' }];
          }
        } else {
          // ── Fallback: no ffmpeg — upload original file (byte-split if >25MB) ──
          setState((s) => ({ ...s, currentStep: 'split', progress: 15 }));
          const ext = file.name.slice(file.name.lastIndexOf('.')) || '.wav';
          const chunks = splitBlobBySize(file);
          uploadBlobs = chunks.map((b) => ({ blob: b, ext }));
        }

        const totalChunks = uploadBlobs.length;
        setState((s) => ({ ...s, totalChunks, currentStep: 'upload', progress: 30 }));

        // ── Step 2: Upload ───────────────────────────────────────────────────
        const storagePaths: string[] = [];

        for (let i = 0; i < uploadBlobs.length; i++) {
          const { blob, ext } = uploadBlobs[i];
          const storagePath = `${jobId}/part_${String(i).padStart(3, '0')}${ext}`;

          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, blob, {
              contentType: blob.type || 'audio/wav',
            });

          if (uploadError) throw new Error(`อัปโหลดล้มเหลว: ${uploadError.message}`);

          storagePaths.push(storagePath);
          setState((s) => ({
            ...s,
            currentChunk: i + 1,
            progress: 30 + Math.floor(((i + 1) / totalChunks) * 20),
          }));
        }

        // ── Step 3: Transcribe each chunk ────────────────────────────────────
        setState((s) => ({ ...s, currentStep: 'transcribe', progress: 50 }));

        for (let i = 0; i < storagePaths.length; i++) {
          setState((s) => ({
            ...s,
            currentChunk: i + 1,
            progress: 50 + Math.floor(((i + 1) / storagePaths.length) * 30),
          }));

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobId,
              storagePath: storagePaths[i],
              partNumber: i,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || 'Transcription failed');
          }
        }

        // ── Step 4: Summarize ────────────────────────────────────────────────
        setState((s) => ({ ...s, currentStep: 'summarize', progress: 85 }));

        const sumRes = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, mode }),
        });

        if (!sumRes.ok) {
          const err = await sumRes.json().catch(() => ({ error: sumRes.statusText }));
          throw new Error(err.error || 'Summarization failed');
        }

        const sumData = await sumRes.json();
        toast.success('สรุปเสร็จแล้ว', { description: 'ดูผลลัพธ์ด้านล่างได้เลย' });

        setResult({
          jobId,
          summary: sumData.summary,
          keyPoints: sumData.key_points,
          fullTranscript: sumData.full_transcript,
        });

        setState({
          isProcessing: false,
          currentStep: 'done',
          currentChunk: totalChunks,
          totalChunks,
          progress: 100,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error('เกิดข้อผิดพลาด', { description: message });
        setState((s) => ({ ...s, isProcessing: false, currentStep: 'idle' }));
        throw error;
      }
    },
    [loadFFmpeg]
  );

  // ── Create job via API (service role — bypasses RLS) ──────────────────────
  const createJob = useCallback(async (fileName: string, totalChunks = 1): Promise<string> => {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, totalChunks }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const msg = `สร้าง job ล้มเหลว: ${err.error ?? res.statusText}`;
      toast.error('เกิดข้อผิดพลาด', { description: msg });
      throw new Error(msg);
    }

    const { id } = await res.json();
    return id;
  }, []);

  // ── Re-summarize ───────────────────────────────────────────────────────────
  const reSummarize = useCallback(async (jobId: string, mode: SummaryMode = 'general') => {
    setState((s) => ({ ...s, isProcessing: true, currentStep: 'summarize', progress: 50 }));
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, mode }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Summarization failed');
      }

      const sumData = await res.json();
      toast.success('สรุปเสร็จแล้ว', { description: 'ดูผลลัพธ์ด้านล่างได้เลย' });

      setResult((prev) => ({
        ...prev!,
        summary: sumData.summary,
        keyPoints: sumData.key_points,
      }));

      setState((s) => ({ ...s, isProcessing: false, progress: 100 }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('เกิดข้อผิดพลาด', { description: message });
      setState((s) => ({ ...s, isProcessing: false }));
    }
  }, []);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      currentStep: 'idle',
      currentChunk: 0,
      totalChunks: 1,
      progress: 0,
    });
    setResult(null);
  }, []);

  return { state, result, processAudio, createJob, reSummarize, reset };
}
