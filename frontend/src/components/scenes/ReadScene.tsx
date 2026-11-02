import React from 'react';
import { ParsedDoc } from '../../types/api';

interface ReadSceneProps {
  progress: number; // 0..1
  parsedA?: ParsedDoc;
  parsedB?: ParsedDoc;
}

export const ReadScene: React.FC<ReadSceneProps> = ({ progress, parsedA, parsedB }) => {
  // Phase 1: 0.00 .. 0.35: Scan line passes, sheet straightens from its tilt
  const scanProgress = Math.min(1, Math.max(0, progress / 0.35));
  const straightenProgress = scanProgress;

  // Phase 2: 0.35 .. 0.80: Second sheet slides out from underneath like a fanned card
  // Continuous transform: Sheet A to -54% left, Sheet B to +54% right
  const fanProgress = Math.min(1, Math.max(0, (progress - 0.35) / 0.45));

  // Phase 3: 0.80 .. 1.00: Shimmer effect across real unit titles
  const shimmerProgress = Math.min(1, Math.max(0, (progress - 0.8) / 0.2));

  // Dynamic transforms
  // Tilt straightens from -2.5deg to 0deg during Phase 1
  const initialTilt = (1 - straightenProgress) * -2.5;
  const initialTiltX = (1 - straightenProgress) * 6;

  // Fanning: A slides to -54%, B slides to +54%
  const aTranslateX = -fanProgress * 54;
  const bTranslateX = fanProgress * 54;
  const bOpacity = Math.min(1, fanProgress * 2.2);

  const unitsA = parsedA?.units?.slice(0, 5) || [];
  const unitsB = parsedB?.units?.slice(0, 5) || [];

  return (
    <div className="scene-viewport scene-read" aria-label="Scene 1: Read Syllabi">
      {/* Pinned Scene Tag */}
      <div className="scene-bg-label num">(Read) 1.0</div>

      {/* Center Stage for Sheets */}
      <div className="read-stage">
        {/* Document A Sheet (Proposal) */}
        <div
          className="paper-sheet paper-sheet-a"
          style={{
            transform: `translateX(${aTranslateX}%) rotateZ(${initialTilt + (1 - fanProgress) * -1}deg) rotateX(${initialTiltX}deg)`,
            zIndex: 10,
          }}
        >
          {/* Scan Beam passing vertically down the sheet (0.00 .. 0.35) */}
          {scanProgress > 0 && scanProgress < 1 && (
            <div
              className="scan-beam"
              style={{
                top: `${scanProgress * 100}%`,
              }}
              aria-hidden="true"
            />
          )}

          <div className="sheet-header">
            <span className="sheet-badge num">SYLLABUS A · PROPOSAL</span>
            <div className="sheet-code num">{parsedA?.code || 'NPTEL_INT395'}</div>
          </div>

          <h2 className="sheet-title">{parsedA?.title || 'Introduction to Machine Learning'}</h2>
          <div className="sheet-divider" />

          {/* Real Unit Text with Shimmer Effect */}
          <div className="sheet-units-preview">
            {unitsA.map((u) => (
              <div
                key={u.order}
                className={`sheet-unit-item ${shimmerProgress > 0 ? 'has-shimmer' : ''}`}
                style={{
                  backgroundPosition: `${shimmerProgress * 200 - 50}% 0`,
                }}
              >
                <div className="sheet-unit-order num">Unit 0{u.order}</div>
                <div className="sheet-unit-heading">{u.title}</div>
                <p className="sheet-unit-excerpt">{u.text.slice(0, 105)}...</p>
              </div>
            ))}
          </div>

          <div className="sheet-footer num">
            <span>{parsedA?.units?.length || 7} UNITS DETECTED</span>
            <span>FORMAT: {parsedA?.format?.toUpperCase() || 'UNIT'}</span>
          </div>
        </div>

        {/* Document B Sheet (Comparison / Existing Course) */}
        <div
          className="paper-sheet paper-sheet-b"
          style={{
            transform: `translateX(${bTranslateX}%) rotateZ(${(1 - fanProgress) * 2}deg)`,
            opacity: bOpacity,
            zIndex: fanProgress > 0.1 ? 5 : 1,
            pointerEvents: bOpacity > 0.5 ? 'auto' : 'none',
          }}
        >
          <div className="sheet-header">
            <span className="sheet-badge sheet-badge-b num">SYLLABUS B · COMPARISON</span>
            <div className="sheet-code num">{parsedB?.code || ''}</div>
          </div>

          <h2 className="sheet-title">{parsedB?.title || 'Supervised Learning'}</h2>
          <div className="sheet-divider" />

          {/* Real Unit Text with Shimmer Effect */}
          <div className="sheet-units-preview">
            {unitsB.map((u) => (
              <div
                key={u.order}
                className={`sheet-unit-item ${shimmerProgress > 0 ? 'has-shimmer' : ''}`}
                style={{
                  backgroundPosition: `${shimmerProgress * 200 - 50}% 0`,
                }}
              >
                <div className="sheet-unit-order num">Unit 0{u.order}</div>
                <div className="sheet-unit-heading">{u.title}</div>
                <p className="sheet-unit-excerpt">{u.text.slice(0, 105)}...</p>
              </div>
            ))}
          </div>

          <div className="sheet-footer num">
            <span>{parsedB?.units?.length || 6} UNITS DETECTED</span>
            <span>FORMAT: {parsedB?.format?.toUpperCase() || 'UNIT'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
