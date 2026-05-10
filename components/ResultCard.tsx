'use client';

import { useState } from 'react';
import { Copy, Download, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { JobResult } from '@/hooks/useAudioProcessor';
import { SummaryMode } from '@/lib/typhoon';

interface ResultCardProps {
  result: JobResult;
  onReSummarize: (mode?: SummaryMode) => void;
  isSummarizing?: boolean;
  currentMode?: SummaryMode;
}

type Tab = 'summary' | 'transcript';

export default function ResultCard({ result, onReSummarize, isSummarizing, currentMode = 'general' }: ResultCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [localMode, setLocalMode] = useState<SummaryMode>(currentMode);

  const handleCopy = async () => {
    let summaryText = result.summary;
    try {
      const parsed = JSON.parse(result.summary);
      if (Array.isArray(parsed)) {
        summaryText = parsed
          .map((item) => {
            if (item.time) return `[${item.time}] ${item.speaker}: ${item.text}`;
            if (item.speaker) return `${item.speaker}: ${item.text}`;
            return item.text;
          })
          .join('\n\n');
      }
    } catch {}

    const text =
      activeTab === 'summary'
        ? `สรุป:\n${summaryText}\n\nประเด็นสำคัญ:\n${result.keyPoints.map((p) => `• ${p}`).join('\n')}`
        : result.fullTranscript;
    await navigator.clipboard.writeText(text);
    toast('คัดลอกแล้ว', { icon: '✓' });
  };

  const handleDownload = () => {
    let summaryText = result.summary;
    try {
      const parsed = JSON.parse(result.summary);
      if (Array.isArray(parsed)) {
        summaryText = parsed
          .map((item) => {
            if (item.time) return `[${item.time}] ${item.speaker}: ${item.text}`;
            if (item.speaker) return `${item.speaker}: ${item.text}`;
            return item.text;
          })
          .join('\n\n');
      }
    } catch {}

    const text =
      activeTab === 'summary'
        ? `=== สรุปการประชุม ===\n\n${summaryText}\n\nประเด็นสำคัญ:\n${result.keyPoints.map((p) => `• ${p}`).join('\n')}`
        : `=== ข้อความเต็ม ===\n\n${result.fullTranscript}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab === 'summary' ? 'mino-summary.txt' : 'mino-transcript.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full animate-slide-up bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Success banner */}
      <div className="bg-gradient-to-r from-primary to-primary-mid px-6 py-4">
        <div className="flex items-center gap-2">
          <CheckCircle size={18} className="text-white" />
          <span className="text-white font-semibold text-sm">ประมวลผลเสร็จสิ้น</span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-border">
        {(['summary', 'transcript'] as const).map((tab) => (
          <button
            key={tab}
            id={`result-tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`
              flex-1 py-3.5 text-sm font-semibold transition-all duration-200
              ${activeTab === tab
                ? 'text-primary border-b-2 border-primary bg-primary-light/50'
                : 'text-muted hover:text-text hover:bg-surface'
              }
            `}
          >
            {tab === 'summary' ? 'สรุปใจความ' : 'ข้อความเต็ม'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'summary' ? (
          <div className="space-y-5">
            {/* Summary rendering */}
            {result.summary && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-4">
                  สรุป
                </h3>
                {(() => {
                  try {
                    const parsed = JSON.parse(result.summary);
                    if (Array.isArray(parsed)) {
                      return (
                        <div className="space-y-4">
                          {parsed.map((item, i) => {
                            // Timeline mode
                            if (item.time) {
                              return (
                                <div key={i} className="flex gap-4 p-3 rounded-xl bg-surface border border-border/50 hover:border-primary/30 transition-colors">
                                  <div className="w-14 flex-shrink-0 text-primary font-mono text-sm mt-0.5">{item.time}</div>
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className="w-5 h-5 rounded-full bg-primary-dark text-white flex items-center justify-center text-[10px] font-bold">
                                        {item.speaker?.charAt(item.speaker.length - 1) || '?'}
                                      </div>
                                      <span className="text-xs font-bold text-text">{item.speaker}</span>
                                    </div>
                                    <div className="text-sm text-text leading-relaxed">{item.text}</div>
                                  </div>
                                </div>
                              );
                            }
                            // Speaker mode
                            if (item.speaker) {
                              const isUser = item.speaker.includes('1') || item.speaker.toLowerCase().includes('you');
                              return (
                                <div key={i} className="flex gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs ${isUser ? 'bg-primary' : 'bg-muted'}`}>
                                    {item.speaker.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted mb-1 font-medium">{item.speaker}</div>
                                    <div className={`p-3 rounded-2xl text-sm leading-relaxed ${isUser ? 'bg-primary-light text-primary-dark rounded-tl-sm' : 'bg-surface text-text rounded-tr-sm border border-border/50'}`}>
                                      {item.text}
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return <p key={i} className="text-sm leading-7 text-text mb-2">{item.text || JSON.stringify(item)}</p>;
                          })}
                        </div>
                      );
                    }
                  } catch {}
                  
                  // General text mode
                  return <p className="text-sm leading-7 text-text whitespace-pre-wrap">{result.summary}</p>;
                })()}
              </div>
            )}

            {/* Key points */}
            {result.keyPoints.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">
                  ประเด็นสำคัญ
                </h3>
                <ul className="space-y-2.5">
                  {result.keyPoints.map((point, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      <span className="text-sm leading-7 text-text">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">
              ข้อความเต็ม
            </h3>
            <div
              className="
                text-sm leading-7 text-text whitespace-pre-wrap
                font-mono bg-surface rounded-xl p-4 border border-border
                max-h-96 overflow-y-auto select-all
              "
            >
              {result.fullTranscript || '(ไม่มีข้อความ)'}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap gap-2 px-6 pb-6">
        <button
          id="result-copy-btn"
          onClick={handleCopy}
          className="
            flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
            border border-border text-muted
            hover:border-primary hover:text-primary hover:bg-primary-light
            active:scale-95 transition-all duration-200
          "
        >
          <Copy size={15} />
          คัดลอก
        </button>

        <button
          id="result-download-btn"
          onClick={handleDownload}
          className="
            flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
            border border-border text-muted
            hover:border-primary hover:text-primary hover:bg-primary-light
            active:scale-95 transition-all duration-200
          "
        >
          <Download size={15} />
          ดาวน์โหลด
        </button>

        <div className="ml-auto flex items-center gap-3">
          {/* Custom segmented control for mode selection */}
          <div className="flex items-center p-1 bg-surface rounded-xl border border-border">
            {(
              [
                { id: 'general', label: 'สรุปทั่วไป' },
                { id: 'speaker', label: 'แยกผู้พูด' },
                { id: 'timeline', label: 'ไทม์ไลน์' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                onClick={() => setLocalMode(mode.id)}
                disabled={isSummarizing}
                className={`
                  px-3 py-1.5 text-xs font-medium rounded-lg transition-all
                  ${localMode === mode.id
                    ? 'bg-white text-primary shadow-sm ring-1 ring-black/5'
                    : 'text-muted hover:text-text hover:bg-black/5'
                  }
                  ${isSummarizing ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <button
            id="result-resummarize-btn"
            onClick={() => onReSummarize(localMode)}
            disabled={isSummarizing}
            className="
              flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
              bg-primary text-white
              hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/25
              active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed
              transition-all duration-200
            "
          >
            <RefreshCw size={15} className={isSummarizing ? 'animate-spin' : ''} />
            สรุปใหม่
          </button>
        </div>
      </div>
    </div>
  );
}
