'use client';

import { useCallback, useState } from 'react';
import { UploadCloud, FileAudio, Play, X } from 'lucide-react';

interface UploadZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED = '.wav,.mp3,.m4a,.ogg,.opus';
const FORMATS = ['WAV', 'MP3', 'M4A', 'OGG', 'OPUS'];

export default function UploadZone({ onFile, disabled }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Only stage the file — don't trigger processing yet
  const stageFile = useCallback((file: File) => {
    setSelectedFile(file);
  }, []);

  // Actually start processing
  const handleStart = useCallback(() => {
    if (selectedFile && !disabled) {
      onFile(selectedFile);
    }
  }, [selectedFile, onFile, disabled]);

  const clearFile = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFile(null);
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) stageFile(file);
  };
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) stageFile(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="w-full space-y-4">
      {/* Drop zone */}
      <label
        htmlFor="audio-upload"
        className={`
          relative flex flex-col items-center justify-center gap-4
          w-full min-h-[200px] rounded-2xl cursor-pointer
          border-2 transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${
            dragging
              ? 'border-primary bg-primary-light shadow-lg shadow-primary/10'
              : selectedFile
              ? 'border-primary/50 bg-primary-light/30'
              : 'border-dashed border-border hover:border-primary hover:bg-primary-light/60'
          }
        `}
        onDragOver={disabled ? undefined : onDragOver}
        onDragLeave={disabled ? undefined : onDragLeave}
        onDrop={disabled ? undefined : onDrop}
      >
        {/* Icon */}
        <div
          className={`
            w-14 h-14 rounded-2xl flex items-center justify-center
            transition-all duration-200
            ${dragging ? 'bg-primary text-white scale-110' : selectedFile ? 'bg-primary text-white' : 'bg-primary-light text-primary'}
          `}
        >
          {selectedFile ? <FileAudio size={26} /> : <UploadCloud size={26} />}
        </div>

        {/* Text */}
        <div className="text-center px-6">
          {selectedFile ? (
            <>
              <p className="font-semibold text-text">{selectedFile.name}</p>
              <p className="text-sm text-muted mt-1">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
              <p className="text-xs text-primary mt-1.5 font-medium">
                ✓ พร้อมแล้ว — กด &quot;เริ่มถอดเสียง&quot; ด้านล่าง
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-text text-base">
                ลากไฟล์มาวางที่นี่
              </p>
              <p className="text-muted text-sm mt-1">หรือคลิกเพื่อเลือกไฟล์เสียง</p>
            </>
          )}
        </div>

        {/* Format badges */}
        <div className="flex flex-wrap gap-2 justify-center px-4">
          {FORMATS.map((fmt) => (
            <span
              key={fmt}
              className="px-2.5 py-0.5 rounded-full bg-primary-light text-primary text-xs font-semibold border border-primary/20"
            >
              {fmt}
            </span>
          ))}
        </div>

        <input
          id="audio-upload"
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          disabled={disabled}
          onChange={onInputChange}
        />
      </label>

      {/* Action row — visible when a file is staged */}
      {selectedFile && !disabled && (
        <div className="flex gap-3 animate-fade-in">
          <button
            id="upload-start-btn"
            onClick={handleStart}
            className="
              flex-1 flex items-center justify-center gap-2.5
              py-3.5 rounded-xl bg-primary text-white font-semibold text-sm
              hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/25
              active:scale-[0.98] transition-all duration-200
            "
          >
            <Play size={16} className="fill-white" />
            เริ่มถอดเสียง
          </button>

          <button
            id="upload-clear-btn"
            onClick={clearFile}
            className="
              px-4 py-3.5 rounded-xl border border-border text-muted text-sm font-medium
              hover:border-red-300 hover:text-red-500 hover:bg-red-50
              active:scale-[0.98] transition-all duration-200
            "
            title="เปลี่ยนไฟล์"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
