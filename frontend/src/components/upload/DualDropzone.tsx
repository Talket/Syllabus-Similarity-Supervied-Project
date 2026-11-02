import React, { useState, useRef } from 'react';
import { IconBolt, IconClose, IconDocument } from '../common/Icons';

interface DualDropzoneProps {
  onComparePair: (fileA: File, fileB: File) => void;
  onCompareLibrary: (file: File) => void;
  onCancel?: () => void;
  isProcessing?: boolean;
}

export const DualDropzone: React.FC<DualDropzoneProps> = ({
  onComparePair,
  onCompareLibrary,
  onCancel,
  isProcessing = false,
}) => {
  const [mode, setMode] = useState<'pair' | 'library'>('pair');
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);
  const [isDragOverA, setIsDragOverA] = useState(false);
  const [isDragOverB, setIsDragOverB] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);

  const inputRefA = useRef<HTMLInputElement>(null);
  const inputRefB = useRef<HTMLInputElement>(null);

  // Auto-load sample pair if ?sample=1 is provided in URL
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('sample') === '1') {
        loadSampleFiles();
      }
      if (params.get('mode') === 'library') {
        setMode('library');
      }
    }
  }, []);

  const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(ext || '')) {
      return 'Only PDF, DOCX or TXT files are accepted';
    }
    if (file.size > MAX_SIZE) {
      return 'File exceeds maximum limit of 15 MB';
    }
    return null;
  };

  const handleDropA = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverA(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const err = validateFile(file);
      if (err) setErrorA(err);
      else {
        setErrorA(null);
        setFileA(file);
      }
    }
  };

  const handleDropB = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverB(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const err = validateFile(file);
      if (err) setErrorB(err);
      else {
        setErrorB(null);
        setFileB(file);
      }
    }
  };

  const handleSelectA = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const err = validateFile(file);
      if (err) setErrorA(err);
      else {
        setErrorA(null);
        setFileA(file);
      }
    }
  };

  const handleSelectB = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const err = validateFile(file);
      if (err) setErrorB(err);
      else {
        setErrorB(null);
        setFileB(file);
      }
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const loadSampleFiles = async () => {
    try {
      setLoadingSamples(true);
      const resA = await fetch('/samples/Syllabus.pdf');
      const blobA = await resA.blob();
      const sampleA = new File([blobA], 'Syllabus.pdf', { type: 'application/pdf' });

      const resB = await fetch('/samples/Syllabus_1.pdf');
      const blobB = await resB.blob();
      const sampleB = new File([blobB], 'Syllabus_1.pdf', { type: 'application/pdf' });

      setFileA(sampleA);
      setFileB(sampleB);
      setErrorA(null);
      setErrorB(null);
    } catch (err) {
      console.error('Failed to load sample files', err);
    } finally {
      setLoadingSamples(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'pair' && fileA && fileB) {
      onComparePair(fileA, fileB);
    } else if (fileA) {
      onCompareLibrary(fileA);
    }
  };

  const isSinglePdf = Boolean(fileA && !fileB) || mode === 'library';
  const canSubmit = Boolean(fileA);

  return (
    <div className="dropzone-modal-backdrop" role="dialog" aria-modal="true" aria-label="Upload Syllabi">
      <div className="dropzone-container">
        {/* Header */}
        <div className="dropzone-header">
          <div>
            <h2 className="dropzone-title">Upload Course Documents</h2>
            <p className="dropzone-desc">
              Submit syllabus documents to trigger deep embedding analysis, topic segmentation,
              and novelty reporting.
            </p>
          </div>

          {onCancel && (
            <button
              type="button"
              className="dropzone-close-btn cursor-pointer"
              onClick={onCancel}
              aria-label="Close upload dialog"
            >
              <IconClose size={14} />
            </button>
          )}
        </div>

        {/* Mode Selector Tabs */}
        <div className="dropzone-mode-tabs num">
          <button
            type="button"
            className={`dropzone-tab-btn ${mode === 'pair' ? 'is-active' : ''}`}
            onClick={() => setMode('pair')}
          >
            01 / Pair Comparison (Two Syllabi)
          </button>
          <button
            type="button"
            className={`dropzone-tab-btn ${mode === 'library' ? 'is-active' : ''}`}
            onClick={() => setMode('library')}
          >
            02 / Library Search (One vs 90 Courses)
          </button>
        </div>

        {/* Upload Cards Grid */}
        <form onSubmit={handleSubmit} className="dropzone-form">
          <div className={`dropzone-grid ${mode === 'library' ? 'is-single' : ''}`}>
            {/* Card A: Proposal Syllabus */}
            <div
              className={`dropzone-card ${isDragOverA ? 'drag-over' : ''} ${fileA ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOverA(true); }}
              onDragLeave={() => setIsDragOverA(false)}
              onDrop={handleDropA}
              onClick={() => !fileA && inputRefA.current?.click()}
            >
              <input
                ref={inputRefA}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden-file-input"
                onChange={handleSelectA}
                aria-label="Select Proposal Syllabus"
              />

              <div className="dropzone-card-top">
                <span className="dropzone-badge num">SYLLABUS A · PROPOSAL</span>
                <span className="dropzone-limit num">MAX 15 MB</span>
              </div>

              {!fileA ? (
                <div className="dropzone-prompt">
                  <div className="dropzone-icon">
                    <IconDocument size={28} color="#ffd93d" />
                  </div>
                  <div className="dropzone-prompt-text">
                    <strong>Drop syllabus proposal here</strong>
                    <span>or click to browse files (PDF, DOCX)</span>
                  </div>
                </div>
              ) : (
                <div className="file-chip-wrap">
                  <div className="file-chip">
                    <span className="file-chip-icon">
                      <IconDocument size={18} color="#ffd93d" />
                    </span>
                    <div className="file-chip-info">
                      <span className="file-chip-name" title={fileA.name}>{fileA.name}</span>
                      <span className="file-chip-size num">{formatSize(fileA.size)}</span>
                    </div>
                    <button
                      type="button"
                      className="file-chip-remove cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFileA(null);
                      }}
                      aria-label="Remove Syllabus A"
                    >
                      <IconClose size={12} />
                    </button>
                  </div>
                </div>
              )}

              {errorA && <div className="dropzone-error-msg num">{errorA}</div>}
            </div>

            {/* Card B: Comparison Syllabus (Only for Pair Mode) */}
            {mode === 'pair' && (
              <div
                className={`dropzone-card ${isDragOverB ? 'drag-over' : ''} ${fileB ? 'has-file' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragOverB(true); }}
                onDragLeave={() => setIsDragOverB(false)}
                onDrop={handleDropB}
                onClick={() => !fileB && inputRefB.current?.click()}
              >
                <input
                  ref={inputRefB}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden-file-input"
                  onChange={handleSelectB}
                  aria-label="Select Counterpart Syllabus"
                />

                <div className="dropzone-card-top">
                  <span className="dropzone-badge sheet-badge-b num">SYLLABUS B · COUNTERPART</span>
                  <span className="dropzone-limit num">MAX 15 MB</span>
                </div>

                {!fileB ? (
                  <div className="dropzone-prompt">
                    <div className="dropzone-icon">
                      <IconDocument size={28} color="#8b7cff" />
                    </div>
                    <div className="dropzone-prompt-text">
                      <strong>Drop comparison syllabus here</strong>
                      <span>or click to browse files (PDF, DOCX)</span>
                    </div>
                  </div>
                ) : (
                  <div className="file-chip-wrap">
                    <div className="file-chip">
                      <span className="file-chip-icon">
                        <IconDocument size={18} color="#8b7cff" />
                      </span>
                      <div className="file-chip-info">
                        <span className="file-chip-name" title={fileB.name}>{fileB.name}</span>
                        <span className="file-chip-size num">{formatSize(fileB.size)}</span>
                      </div>
                      <button
                        type="button"
                        className="file-chip-remove cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFileB(null);
                        }}
                        aria-label="Remove Syllabus B"
                      >
                        <IconClose size={12} />
                      </button>
                    </div>
                  </div>
                )}

                {errorB && <div className="dropzone-error-msg num">{errorB}</div>}
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="dropzone-actions">
            <button
              type="button"
              className="dropzone-sample-btn num cursor-pointer"
              onClick={loadSampleFiles}
              disabled={loadingSamples || isProcessing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <IconBolt size={14} color="#ffd93d" />
              <span>{loadingSamples ? 'Loading...' : 'Load Sample Pair'}</span>
            </button>

            <div className="dropzone-main-actions">
              {onCancel && (
                <button
                  type="button"
                  className="dropzone-cancel-btn num cursor-pointer"
                  onClick={onCancel}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                className="dropzone-submit-btn num cursor-pointer"
                disabled={!canSubmit || isProcessing}
              >
                <span>
                  {isProcessing
                    ? 'Initializing Model...'
                    : isSinglePdf
                    ? 'Analyze Single Syllabus (vs Benchmark Topics)'
                    : 'Launch Semantic Pair Comparison'}
                </span>
                <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
