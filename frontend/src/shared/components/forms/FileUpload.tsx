import React, { useRef, useState, DragEvent, ChangeEvent } from 'react';

export interface FileUploadProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  error?: string;
  hint?: string;
  onFilesSelected: (files: File[]) => void;
  wrapperClassName?: string;
  disabled?: boolean;
}

export function FileUpload({
  label,
  accept,
  multiple,
  maxSizeMB,
  error,
  hint,
  onFilesSelected,
  wrapperClassName = '',
  disabled,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState('');

  const validate = (files: File[]): File[] => {
    if (!maxSizeMB) return files;
    const valid = files.filter((f) => f.size <= maxSizeMB * 1024 * 1024);
    if (valid.length < files.length) {
      setLocalError(`Some files exceed the ${maxSizeMB}MB limit and were excluded.`);
    } else {
      setLocalError('');
    }
    return valid;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const valid = validate(arr);
    if (valid.length) onFilesSelected(valid);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const displayError = localError || error;

  return (
    <div className={`flex flex-col gap-1 ${wrapperClassName}`}>
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="File upload area. Click or drag files here."
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !disabled && inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${displayError ? 'border-red-400' : ''}`}
      >
        <svg className="mx-auto w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-gray-600">
          <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
        </p>
        {accept && <p className="text-xs text-gray-400 mt-1">{accept}</p>}
        {maxSizeMB && <p className="text-xs text-gray-400">Max {maxSizeMB}MB</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled}
      />
      {hint && !displayError && <p className="text-xs text-gray-500">{hint}</p>}
      {displayError && <p role="alert" className="text-xs text-red-600">{displayError}</p>}
    </div>
  );
}

export default FileUpload;
