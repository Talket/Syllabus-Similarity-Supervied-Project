import React, { useState } from 'react';
import { ParsedDoc, ParsedUnit } from '../../types/api';

interface EditableUnitsModalProps {
  parsedA: ParsedDoc;
  parsedB?: ParsedDoc;
  mode?: 'pair' | 'library';
  tPhrase?: number;
  isOpen: boolean;
  onClose: () => void;
  onReRunJson: (payload: {
    mode: 'pair' | 'library';
    a: { title: string; units: ParsedUnit[] };
    b?: { title: string; units: ParsedUnit[] };
    t_phrase?: number;
  }) => Promise<void>;
  isLoading?: boolean;
}

export const EditableUnitsModal: React.FC<EditableUnitsModalProps> = ({
  parsedA,
  parsedB,
  mode = 'pair',
  tPhrase = 0.75,
  isOpen,
  onClose,
  onReRunJson,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<'a' | 'b'>('a');

  // Local state for editable units
  const [titleA, setTitleA] = useState(parsedA?.title || 'Proposal Course');
  const [unitsA, setUnitsA] = useState<ParsedUnit[]>(
    parsedA?.units && parsedA.units.length > 0
      ? JSON.parse(JSON.stringify(parsedA.units))
      : [{ order: 1, title: 'Unit 1', text: '' }]
  );

  const [titleB, setTitleB] = useState(parsedB?.title || 'Comparison Course');
  const [unitsB, setUnitsB] = useState<ParsedUnit[]>(
    parsedB?.units && parsedB.units.length > 0
      ? JSON.parse(JSON.stringify(parsedB.units))
      : [{ order: 1, title: 'Unit 1', text: '' }]
  );

  const [strictness, setStrictness] = useState<number>(tPhrase);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handlers for Unit A
  const handleUpdateUnitA = (index: number, field: keyof ParsedUnit, val: any) => {
    const updated = [...unitsA];
    updated[index] = { ...updated[index], [field]: val };
    setUnitsA(updated);
  };

  const handleAddUnitA = () => {
    const nextOrder = unitsA.length + 1;
    setUnitsA([...unitsA, { order: nextOrder, title: `Unit 0${nextOrder}`, text: '' }]);
  };

  const handleDeleteUnitA = (index: number) => {
    if (unitsA.length <= 1) return;
    const updated = unitsA.filter((_, i) => i !== index).map((u, i) => ({ ...u, order: i + 1 }));
    setUnitsA(updated);
  };

  // Handlers for Unit B
  const handleUpdateUnitB = (index: number, field: keyof ParsedUnit, val: any) => {
    const updated = [...unitsB];
    updated[index] = { ...updated[index], [field]: val };
    setUnitsB(updated);
  };

  const handleAddUnitB = () => {
    const nextOrder = unitsB.length + 1;
    setUnitsB([...unitsB, { order: nextOrder, title: `Unit 0${nextOrder}`, text: '' }]);
  };

  const handleDeleteUnitB = (index: number) => {
    if (unitsB.length <= 1) return;
    const updated = unitsB.filter((_, i) => i !== index).map((u, i) => ({ ...u, order: i + 1 }));
    setUnitsB(updated);
  };

  // Submit re-run
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Basic validation
    if (unitsA.some((u) => !u.text.trim())) {
      setErrorMsg('Please ensure all Syllabus A units have non-empty curriculum text.');
      return;
    }
    if (mode === 'pair' && unitsB.some((u) => !u.text.trim())) {
      setErrorMsg('Please ensure all Syllabus B units have non-empty curriculum text.');
      return;
    }

    try {
      await onReRunJson({
        mode,
        a: { title: titleA, units: unitsA },
        b: mode === 'pair' ? { title: titleB, units: unitsB } : undefined,
        t_phrase: strictness,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to re-run comparison via /api/compare/json');
    }
  };

  const currentUnits = activeTab === 'a' ? unitsA : unitsB;
  const isPairMode = mode === 'pair' && !!parsedB;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-modal-title"
      className="editable-modal-backdrop"
    >
      <div className="editable-modal-container">
        {/* Header */}
        <div className="editable-modal-header">
          <div>
            <div className="section-tag num">
              <span className="accent">(Curriculum Editor) 6.6</span> Detected Units Refinement
            </div>
            <h3 id="editor-modal-title" className="editable-modal-title">
              Refine Parsed Curricular Units
            </h3>
            <p className="editable-modal-desc num">
              Fix any OCR or parsing misalignments in module titles and passages, then re-evaluate via <code className="text-cyan">POST /api/compare/json</code>.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="editable-modal-close num"
            aria-label="Close editor"
          >
            ✕
          </button>
        </div>

        {/* Syllabus Selection Tabs */}
        {isPairMode && (
          <div className="editable-modal-tabs num">
            <button
              type="button"
              onClick={() => setActiveTab('a')}
              className={`editable-modal-tab ${activeTab === 'a' ? 'is-active-a' : ''}`}
            >
              Syllabus A: {titleA} ({unitsA.length} Units)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('b')}
              className={`editable-modal-tab ${activeTab === 'b' ? 'is-active-b' : ''}`}
            >
              Syllabus B: {titleB} ({unitsB.length} Units)
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="editable-modal-body">
          {errorMsg && (
            <div className="p-3 rounded bg-[#ff6b6b]/15 border border-[#ff6b6b]/40 text-[#ff6b6b] num text-xs">
              <strong>Error:</strong> {errorMsg}
            </div>
          )}

          {/* Course Title input */}
          <div className="editable-title-field">
            <label className="num">
              {activeTab === 'a' ? 'Syllabus A Course Title' : 'Syllabus B Course Title'}
            </label>
            <input
              type="text"
              value={activeTab === 'a' ? titleA : titleB}
              onChange={(e) =>
                activeTab === 'a' ? setTitleA(e.target.value) : setTitleB(e.target.value)
              }
              className="editable-title-input"
            />
          </div>

          {/* Units List */}
          <div>
            <div className="editable-units-list-header num">
              <span className="editable-units-list-title">
                Detected Curricular Modules ({currentUnits.length})
              </span>
              <button
                type="button"
                onClick={activeTab === 'a' ? handleAddUnitA : handleAddUnitB}
                className="editable-add-unit-btn"
              >
                + Add Module
              </button>
            </div>

            {currentUnits.map((unit, idx) => (
              <div key={idx} className="editable-unit-row">
                <div className="editable-unit-top-bar num">
                  <span className="editable-unit-tag">
                    UNIT 0{unit.order}
                  </span>
                  <input
                    type="text"
                    value={unit.title}
                    placeholder="Unit Title (e.g. Evolutionary Algorithms)"
                    onChange={(e) =>
                      activeTab === 'a'
                        ? handleUpdateUnitA(idx, 'title', e.target.value)
                        : handleUpdateUnitB(idx, 'title', e.target.value)
                    }
                    className="editable-unit-name-input"
                  />
                  {currentUnits.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        activeTab === 'a' ? handleDeleteUnitA(idx) : handleDeleteUnitB(idx)
                      }
                      title="Delete this module"
                      className="editable-unit-delete-btn"
                    >
                      Remove [✕]
                    </button>
                  )}
                </div>

                <div>
                  <textarea
                    rows={3}
                    value={unit.text}
                    placeholder="Paste or edit the detailed unit topics, comma-separated concepts, or module text..."
                    onChange={(e) =>
                      activeTab === 'a'
                        ? handleUpdateUnitA(idx, 'text', e.target.value)
                        : handleUpdateUnitB(idx, 'text', e.target.value)
                    }
                    className="editable-unit-textarea"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Strictness parameter */}
          <div className="editable-strictness-bar num">
            <div>
              <span className="font-bold text-xs block text-[#eceff4]">
                Re-evaluation Threshold (t_phrase)
              </span>
              <span className="text-[11px] text-[#8c8b88]">
                Cosine cutoff for semantic topic linking
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.40"
                max="0.95"
                step="0.01"
                value={strictness}
                onChange={(e) => setStrictness(parseFloat(e.target.value))}
                className="w-36 accent-[#ffd93d]"
              />
              <span className="text-sm font-bold text-[#ffd93d] w-12 text-right">
                {strictness.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="editable-modal-footer num">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="editable-cancel-btn"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="editable-submit-btn"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-[#0c0c0c] border-t-transparent rounded-full animate-spin" />
                <span>Re-running Vector Embeddings...</span>
              </>
            ) : (
              <>
                <span>⟳ Re-run NLP Alignment</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
