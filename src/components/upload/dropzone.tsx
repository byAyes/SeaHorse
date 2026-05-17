"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, X, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
}

export function Dropzone({
  onFileSelect,
  accept = ".pdf,.doc,.docx",
  maxSizeMB = 10,
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSet = useCallback(
    (f: File) => {
      setError(null);
      if (f.size > maxSizeMB * 1024 * 1024) {
        setError(`El archivo excede el límite de ${maxSizeMB}MB`);
        return;
      }
      setFile(f);
      onFileSelect(f);
    },
    [maxSizeMB, onFileSelect]
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
    [validateAndSet]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) validateAndSet(f);
    },
    [validateAndSet]
  );

  const removeFile = useCallback(() => {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !file && inputRef.current?.click()}
      className={cn(
        "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all duration-200",
        isDragging
          ? "border-primary bg-primary-50 dark:bg-primary-50/5"
          : file
          ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-500/5"
          : "border-slate-300 bg-slate-50/50 hover:border-slate-400 hover:bg-slate-100/50 dark:border-slate-600 dark:bg-dark-surface/50 dark:hover:border-slate-500 dark:hover:bg-dark-surface"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {file ? (
          <motion.div
            key="file"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
              <CheckCircle size={28} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                {file.name}
              </p>
              <p className="text-sm text-slate-500">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFile();
              }}
              className="flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-400 transition-colors"
            >
              <X size={12} />
              Eliminar
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full transition-colors",
                isDragging
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-400 dark:bg-dark-surface-tertiary"
              )}
            >
              {isDragging ? (
                <Upload size={24} />
              ) : (
                <FileText size={24} />
              )}
            </div>
            <div className="text-center">
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {isDragging
                  ? "Suelta tu archivo aquí"
                  : "Arrastra y suelta tu CV aquí"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                o haz clic para seleccionar un archivo
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                PDF, DOC, DOCX — Máx {maxSizeMB}MB
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-4 text-sm text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
