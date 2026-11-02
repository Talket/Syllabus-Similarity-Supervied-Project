import React from 'react';
import { Report, Viz } from '../../types/api';

interface VerdictSceneProps {
  progress: number; // 0..1
  report: Report;
  viz: Viz;
  onExploreDashboard?: () => void;
}

export const VerdictScene: React.FC<VerdictSceneProps> = ({
  progress,
  report,
  viz,
  onExploreDashboard,
}) => {
  // Phase 1: 0..0.45: Uncovered points turn coral and drift away
  // Phase 2: 0.35..1.0: Center cloud collapses into counting large number
  const driftProgress = Math.min(1, Math.max(0, progress / 0.5));
  const countProgress = Math.min(1, Math.max(0, (progress - 0.25) / 0.75));

  // Count up to report.topics.new
  const currentNewCount = Math.round(countProgress * report.topics.new);
  const noveltyPct = (report.novelty * 100).toFixed(1);

  // Filter uncovered side A points
  const uncoveredPoints = viz.points.filter((p) => p.side === 'A' && !p.covered);

  return (
    <div className="scene-viewport scene-verdict" aria-label="Scene 5: Final Verdict and Curriculum Novelty">
      <div className="verdict-tag-header">
        <div className="section-tag">
          <span className="accent">(Verdict) 5.0</span>
        </div>
      </div>

      <div className="verdict-stage">
        {/* Drifting Coral Points Cloud (dispersion) */}
        <div
          className="verdict-cloud-layer"
          style={{
            opacity: Math.max(0, 1 - progress * 1.2),
          }}
          aria-hidden="true"
        >
          {uncoveredPoints.slice(0, 36).map((pt, i) => {
            const angle = (i / 36) * Math.PI * 2;
            const driftDist = 80 + driftProgress * (180 + (i % 7) * 30);
            const x = Math.cos(angle) * driftDist;
            const y = Math.sin(angle) * driftDist * 0.7;

            return (
              <div
                key={`drift-${pt.id}`}
                className="drifting-coral-point"
                style={{
                  transform: `translate(${x}px, ${y}px) scale(${1 - driftProgress * 0.4})`,
                  opacity: Math.max(0.1, 1 - driftProgress * 0.7),
                }}
              >
                <span className="coral-dot" />
                <span className="coral-label">{pt.text}</span>
              </div>
            );
          })}
        </div>

        {/* Big Collapsed Verdict Display */}
        <div
          className="verdict-display-card"
          style={{
            transform: `scale(${0.9 + countProgress * 0.1})`,
            opacity: Math.min(1, countProgress * 1.5),
          }}
        >
          <div className="verdict-super-tag num">NET CURRICULUM ADDITIONS</div>
          
          <div className="verdict-hero-num-wrap">
            <span className="verdict-hero-number num tabular" data-num={currentNewCount}>
              {currentNewCount}
            </span>
          </div>

          <p className="verdict-headline-caption">
            of <strong className="num text-highlight">{report.topics.total}</strong> topics in the proposal are{' '}
            <span className="marker-highlight-coral active">not found in the other syllabus</span>
          </p>

          <div className="verdict-stats-ribbon num">
            <div className="verdict-stat-cell">
              <span className="stat-label">UNIT-LEVEL INDEX</span>
              <span className="stat-value text-coral">{noveltyPct}%</span>
            </div>
            <div className="verdict-stat-sep" />
            <div className="verdict-stat-cell">
              <span className="stat-label">COVERED IN COMPARISON</span>
              <span className="stat-value text-yellow">{report.topics.covered} topics</span>
            </div>
            <div className="verdict-stat-sep" />
            <div className="verdict-stat-cell">
              <span className="stat-label">PROPOSAL UNITS</span>
              <span className="stat-value">{report.n_units} units</span>
            </div>
          </div>

          {onExploreDashboard && (
            <div className="verdict-action-wrap">
              <button
                type="button"
                className="verdict-dashboard-btn num cursor-pointer"
                onClick={onExploreDashboard}
              >
                <span>Inspect Full Curriculum Matrix & Panes</span>
                <span className="btn-arrow">↓</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

