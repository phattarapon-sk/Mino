'use client';

import { Mic, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import { useRecorder } from '@/hooks/useRecorder';

interface RecordButtonProps {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
}

// Animated waveform bars
function WaveformBars() {
  const barCount = 12;
  return (
    <div className="flex items-center gap-[3px] h-8">
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full bg-primary animate-waveform"
          style={{
            animationDelay: `${(i * 80) % 800}ms`,
            animationDuration: `${600 + (i % 4) * 150}ms`,
            minHeight: '8px',
          }}
        />
      ))}
    </div>
  );
}

export default function RecordButton({ onRecordingComplete, disabled }: RecordButtonProps) {
  const { isRecording, formattedTime, start, stop, cancel } = useRecorder();

  const handleStop = async () => {
    try {
      const blob = await stop();
      if (!blob || blob.size === 0) {
        toast.error('ไม่มีข้อมูลเสียง', { description: 'กรุณาตรวจสอบไมค์แล้วลองใหม่' });
        return;
      }
      onRecordingComplete(blob);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('หยุดบันทึกล้มเหลว', { description: msg });
    }
  };

  if (!isRecording) {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-center">
          <p className="text-muted text-sm">กดปุ่มด้านล่างเพื่อเริ่มอัดเสียง</p>
          <p className="text-muted/70 text-xs mt-1">สูงสุด 15 นาที</p>
        </div>

        <button
          id="record-start-btn"
          onClick={start}
          disabled={disabled}
          className="
            group relative w-20 h-20 rounded-full
            bg-gradient-to-br from-red-500 to-rose-600
            shadow-lg shadow-red-500/30
            hover:shadow-xl hover:shadow-red-500/40 hover:scale-105
            active:scale-95 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center
          "
        >
          <Mic size={32} className="text-white" />
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
        </button>

        <p className="text-xs text-muted">รองรับ Chrome และ Firefox</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-6 animate-fade-in">
      {/* Recording indicator + timer */}
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse-dot" />
        <span className="font-mono text-2xl font-bold text-text tracking-widest">
          {formattedTime}
        </span>
        <span className="text-xs text-muted bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">
          REC
        </span>
      </div>

      {/* Animated waveform */}
      <WaveformBars />

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          id="record-stop-btn"
          onClick={handleStop}
          className="
            flex items-center gap-2 px-6 py-3 rounded-xl
            bg-primary text-white font-semibold
            hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/25
            active:scale-95 transition-all duration-200
          "
        >
          <Square size={16} className="fill-white" />
          หยุดและถอดเสียง
        </button>

        <button
          id="record-cancel-btn"
          onClick={cancel}
          className="
            flex items-center gap-2 px-5 py-3 rounded-xl
            border border-border text-muted
            hover:border-red-300 hover:text-red-500 hover:bg-red-50
            active:scale-95 transition-all duration-200
          "
        >
          <X size={16} />
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
