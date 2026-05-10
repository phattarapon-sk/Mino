'use client';

import { ProcessingState } from '@/hooks/useAudioProcessor';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface ProgressSectionProps {
  state: ProcessingState;
}

const STEP_LABELS: Record<ProcessingState['currentStep'], string> = {
  idle: '',
  normalize: 'กำลังปรับระดับเสียง (Normalize)...',
  split: 'กำลังแบ่งไฟล์เป็นส่วนย่อย...',
  upload: 'กำลังอัปโหลดไฟล์เสียงไปที่เซิร์ฟเวอร์...',
  transcribe: 'กำลังใช้ AI ถอดรหัสเสียง...',
  summarize: 'กำลังใช้ AI สรุปใจความสำคัญ...',
  done: 'ถอดเสียงและสรุปผลเสร็จสมบูรณ์!',
};

export default function ProgressSection({ state }: ProgressSectionProps) {
  const { isProcessing, currentStep, currentChunk, totalChunks, progress } = state;

  if (!isProcessing && currentStep !== 'done') return null;

  const label =
    currentStep === 'transcribe'
      ? `กำลังใช้ AI ถอดรหัสเสียง (ส่วนที่ ${currentChunk} จาก ${totalChunks})...`
      : STEP_LABELS[currentStep];

  return (
    <div className="w-full animate-slide-up bg-white rounded-2xl border border-border p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-text">สถานะการทำงาน</span>
        <span className="text-sm font-mono text-muted">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full bg-border overflow-hidden relative">
        <div
          className="absolute inset-y-0 left-0 h-full rounded-full bg-gradient-to-r from-primary-mid to-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
        {/* Animated overlay for active processing */}
        {currentStep !== 'done' && (
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] -translate-x-full animate-[shimmer_2s_infinite]" />
        )}
      </div>

      {/* Chunk indicators (Only show if there are multiple parts) */}
      {totalChunks > 1 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {Array.from({ length: totalChunks }).map((_, i) => {
            const isDone = i < currentChunk;
            const isActive = currentStep === 'transcribe' && i === currentChunk - 1;
            return (
              <div
                key={i}
                className={`
                  h-1.5 rounded-full transition-all duration-300
                  ${totalChunks > 10 ? 'w-3' : 'flex-1 min-w-[20px]'}
                  ${isDone ? 'bg-primary' : ''}
                  ${isActive ? 'bg-primary-mid animate-pulse' : ''}
                  ${!isDone && !isActive ? 'bg-border' : ''}
                `}
              />
            );
          })}
        </div>
      )}

      {/* Active Animated Status Box */}
      <div className="mt-5 flex items-center justify-center p-3.5 rounded-xl bg-primary-light/40 border border-primary/10">
        <div 
          // Use key to force re-render animation when step changes
          key={currentStep} 
          className="flex items-center gap-3 text-primary-dark font-medium text-sm transition-all duration-300 animate-fade-in"
        >
          {currentStep !== 'done' ? (
            <Loader2 size={18} className="animate-spin text-primary" />
          ) : (
            <CheckCircle2 size={18} className="text-green-500" />
          )}
          {label}
        </div>
      </div>
    </div>
  );
}
