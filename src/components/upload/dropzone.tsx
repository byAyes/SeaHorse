'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
}

export function Dropzone({
  onFileSelect,
  accept = '.pdf,.doc,.docx',
  maxSizeMB = 10,
}: DropzoneProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSet = useCallback(
    (f: File) => {
      setError(null);
      if (f.size > maxSizeMB * 1024 * 1024) {
        setError(t('upload.error.tooLarge'));
        return;
      }
      setFile(f);
      onFileSelect(f);
    },
    [maxSizeMB, onFileSelect, t],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) validateAndSet(f);
    },
    [validateAndSet],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) validateAndSet(f);
    },
    [validateAndSet],
  );

  const removeFile = useCallback(() => {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  return (
    <div className="relative">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center rounded-[--radius-card] border-2 border-dashed p-8 sm:p-14 transition-all duration-300',
          isDragging
            ? 'border-primary bg-primary/5 dark:bg-primary/10'
            : file
              ? 'border-emerald-300/70 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/5'
              : 'border-slate-300 bg-surface hover:border-slate-400 hover:bg-slate-50/50 dark:border-slate-600 dark:bg-dark-surface-secondary dark:hover:border-slate-500 dark:hover:bg-dark-surface-tertiary/50',
        )}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !file) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label={t('upload.dropzone.title')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
        />

        {/* Gradient accent line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent rounded-t-[--radius-card]" />

        {/* Drag overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-[--radius-card] bg-primary/5 dark:bg-primary/10 z-10 flex items-center justify-center"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="flex flex-col items-center gap-2"
              >
                <Upload size={36} className="text-primary" />
                <p className="text-sm font-medium text-primary">{t('upload.dropzone.drop')}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {file ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20"
              >
                <CheckCircle size={32} className="text-emerald-600 dark:text-emerald-400" />
              </motion.div>
              <div className="text-center">
                <p className="font-semibold text-emerald-700 dark:text-emerald-400 max-w-[220px] truncate">
                  {file.name}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile();
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-4 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:hover:bg-rose-500/25 transition-colors"
                aria-label={t('common.delete')}
              >
                <X size={12} />
                {t('common.delete')}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300',
                  isDragging
                    ? 'bg-primary text-white scale-110'
                    : 'bg-slate-100 text-slate-400 dark:bg-dark-surface-tertiary dark:text-slate-500',
                )}
              >
                {isDragging ? <Upload size={28} /> : <FileText size={28} />}
              </div>
              <div className="text-center space-y-1">
                <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
                  {t('upload.dropzone.title')}
                </p>
                <p className="text-sm text-slate-500">{t('upload.dropzone.subtitle')}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {t('upload.dropzone.formats')}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-4 py-2.5"
          >
            <AlertCircle size={14} className="text-rose-500 shrink-0" />
            <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
