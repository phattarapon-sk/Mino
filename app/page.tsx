'use client';

import { useState, useCallback } from 'react';
import { Waves, Upload, Mic } from 'lucide-react';
import UploadZone from '@/components/UploadZone';
import RecordButton from '@/components/RecordButton';
import ProgressSection from '@/components/ProgressSection';
import ResultCard from '@/components/ResultCard';
import { useAudioProcessor } from '@/hooks/useAudioProcessor';
import { SummaryMode } from '@/lib/typhoon';

type Tab = 'upload' | 'record';

const SUMMARY_MODE_OPTIONS: { id: SummaryMode; label: string; desc: string }[] = [
  { id: 'general', label: 'สรุปทั่วไป', desc: 'สรุปใจความสำคัญทั้งหมด' },
  { id: 'speaker', label: 'แยกผู้พูด', desc: 'ข้อความระหว่างผู้พูด 1 - 2' },
  { id: 'timeline', label: 'ไทม์ไลน์', desc: 'สรุปเป็นช่วงเวลา (วินาที)' },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('general');
  const { state, result, processAudio, createJob, reSummarize, reset } = useAudioProcessor();

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const jobId = await createJob(file.name);
        await processAudio(file, jobId, summaryMode);
      } catch {
        // Error is already toasted inside hook
      }
    },
    [createJob, processAudio, summaryMode]
  );

  const handleRecordingComplete = useCallback(
    async (blob: Blob) => {
      const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type });
      await handleFile(file);
    },
    [handleFile]
  );

  const handleReSummarize = useCallback((mode?: SummaryMode) => {
    if (result?.jobId) {
      const selectedMode = mode || summaryMode;
      if (mode && mode !== summaryMode) setSummaryMode(mode);
      reSummarize(result.jobId, selectedMode);
    }
  }, [result, reSummarize, summaryMode]);

  const isProcessing = state.isProcessing;

  return (
    <div className="min-h-screen bg-surface">
      {/* Topbar */}
      <header className="bg-white border-b border-border sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <Waves size={20} className="text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-text tracking-tight">Mino</span>
              <span className="hidden sm:inline text-xs text-muted ml-2 font-medium">
                Meeting Notes · Thai-first
              </span>
            </div>
          </div>

          {/* Powered by */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-surface">
            <span className="text-xs text-muted">Powered by</span>
            <span className="text-xs font-semibold text-primary">Typhoon AI</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-light border border-primary/20 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold text-primary">Thai-first ASR + AI Summary</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-text leading-tight">
            ถอดเสียงและสรุปการประชุม
          </h1>
          <p className="text-muted text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            อัปโหลดหรืออัดไฟล์เสียงการประชุม — Mino จะถอดเสียงภาษาไทยและสรุปใจความสำคัญให้อัตโนมัติ
          </p>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden animate-slide-up">
          {/* Tab switcher */}
          <div className="flex border-b border-border">
            {([
              { id: 'upload', label: 'อัปโหลดไฟล์', icon: Upload },
              { id: 'record', label: 'อัดเสียง', icon: Mic },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                id={`tab-${id}`}
                onClick={() => {
                  if (!isProcessing) {
                    setActiveTab(id);
                    reset();
                  }
                }}
                disabled={isProcessing}
                className={`
                  flex-1 flex items-center justify-center gap-2.5 py-4 text-sm font-semibold
                  transition-all duration-200 disabled:cursor-not-allowed
                  ${activeTab === id
                    ? 'text-primary border-b-2 border-primary bg-primary-light/40'
                    : 'text-muted hover:text-text hover:bg-surface'
                  }
                `}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Summary Mode Selector (Only enabled when not processing) */}
          <div className="px-6 py-4 border-b border-border bg-surface/50">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">รูปแบบการสรุป</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {SUMMARY_MODE_OPTIONS.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setSummaryMode(mode.id)}
                  disabled={isProcessing}
                  className={`
                    text-left px-3.5 py-2.5 rounded-xl border transition-all duration-200
                    ${summaryMode === mode.id
                      ? 'border-primary bg-primary-light/50 ring-1 ring-primary/30'
                      : 'border-border bg-white hover:border-primary/50'
                    }
                    ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <div className={`text-sm font-semibold mb-0.5 ${summaryMode === mode.id ? 'text-primary-dark' : 'text-text'}`}>
                    {mode.label}
                  </div>
                  <div className="text-[11px] text-muted">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'upload' ? (
              <UploadZone onFile={handleFile} disabled={isProcessing} />
            ) : (
              <RecordButton
                onRecordingComplete={handleRecordingComplete}
                disabled={isProcessing}
              />
            )}
          </div>
        </div>

        {/* Progress */}
        {(isProcessing || state.currentStep === 'done') && (
          <ProgressSection state={state} />
        )}

        {/* Result */}
        {result && (
          <ResultCard
            result={result}
            onReSummarize={handleReSummarize}
            isSummarizing={state.isProcessing && state.currentStep === 'summarize'}
            currentMode={summaryMode}
          />
        )}

        {/* Features section (shown when idle) */}
        {!isProcessing && !result && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
            {[
              {
                icon: '🎙️',
                title: 'รองรับหลายรูปแบบ',
                desc: 'WAV, MP3, M4A, OGG, OPUS และอัดตรงจากเบราว์เซอร์',
              },
              {
                icon: '🤖',
                title: 'AI สัญชาติไทย',
                desc: 'Typhoon ASR ถอดเสียงไทยแม่นยำสูง + สรุปด้วย LLM',
              },
              {
                icon: '🔒',
                title: 'ปลอดภัย',
                desc: 'ไฟล์เสียงลบทิ้งทันทีหลังถอดเสียงเสร็จ',
              },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-2xl border border-border p-5 hover:border-primary/40 hover:shadow-sm transition-all duration-200"
              >
                <div className="text-2xl mb-3">{icon}</div>
                <h3 className="font-semibold text-text text-sm mb-1.5">{title}</h3>
                <p className="text-xs text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-muted border-t border-border mt-16">
        <p>
          Mino · Built with{' '}
          <a
            href="https://opentyphoon.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            Typhoon AI
          </a>{' '}
          · Thai-first Meeting Transcription
        </p>
      </footer>
    </div>
  );
}
