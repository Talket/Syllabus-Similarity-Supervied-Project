import React from 'react';
import { Report } from '../../types/api';

interface SceneHUDProps {
  currentScene: number; // 0..5
  report: Report;
  onSkipAnimation?: () => void;
  onOpenUpload?: () => void;
  showSkip?: boolean;
  isHidden?: boolean;
}

export const SceneHUD: React.FC<SceneHUDProps> = ({
  currentScene,
  report,
  onSkipAnimation,
  onOpenUpload,
  showSkip = true,
  isHidden = false,
}) => {
  const sceneNames = [
    { label: '', sub: '' },
    { label: '(Read) 1.0', sub: '' },
    { label: '(Split) 2.0', sub: `2.1 Units ${report.n_units} / 2.2 Topics ${report.topics.total}` },
    { label: '(Embed) 3.0', sub: `3.1 Vectors (${report.topics.total} points)` },
    { label: '(Match) 4.0', sub: `4.1 Pairs (${report.topics.covered} matched)` },
    { label: '(Verdict) 5.0', sub: `5.1 Novelty: ${report.topics.new} of ${report.topics.total} topics new` },
  ];

  const activeMeta = sceneNames[Math.min(Math.max(0, currentScene), 5)];
  const counterText = currentScene === 0 ? '00 / 05' : `0${currentScene} / 05`;

  return (
    <div className={`hud-root ${isHidden ? 'hud-hidden' : ''}`} aria-live="polite">
      {/* Top Left: Title and Scene Parenthetical */}
      <div className="hud-top-left">
        <div className="hud-brand">
          <span className="hud-logo-icon">▲</span>
          <span className="hud-title">Syllabus Lens</span>
        </div>
        {activeMeta.label && (
          <div className="hud-scene-tag">
            <span className="section-tag">
              <span className="accent">{activeMeta.label}</span>
            </span>
            {activeMeta.sub && <span className="hud-sub-index num">{activeMeta.sub}</span>}
          </div>
        )}
      </div>

      {/* Top Right: Counter & Actions */}
      <div className="hud-top-right">
        {onOpenUpload && (
          <button
            type="button"
            className="hud-upload-btn num cursor-pointer"
            onClick={onOpenUpload}
            aria-label="Upload two course syllabi"
          >
            <span>Upload Syllabi</span>
            <span className="hud-btn-arrow">↑</span>
          </button>
        )}

        {showSkip && onSkipAnimation && (
          <button
            type="button"
            className="hud-skip-btn num cursor-pointer"
            onClick={onSkipAnimation}
            aria-label="Skip animation to dashboard"
          >
            <span>Skip to Results</span>
            <span className="hud-btn-arrow">↓</span>
          </button>
        )}
        <div className="hud-counter-pill num">
          <span className="hud-counter-val">{counterText}</span>
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="hud-bottom-bar" aria-hidden="true">
        <div
          className="hud-progress-fill"
          style={{ width: `${(Math.max(0, currentScene) / 5) * 100}%` }}
        />
      </div>
    </div>
  );
};
