import React from 'react';
import { Report } from '../../types/api';

interface NoveltyGaugeProps {
  report: Report;
  onDownloadJson?: () => void;
}

export const NoveltyGauge: React.FC<NoveltyGaugeProps> = ({ report, onDownloadJson }) => {
  const noveltyPct = Math.round(report.novelty * 100);

  // A24-style thick ring gauge
  // Radius = 76, Circumference = 2 * PI * 76 = 477.52
  // We use full circle with gap at bottom or continuous circle
  const radius = 76;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  // Progress fraction represents novelty
  const strokeDashoffset = circumference * (1 - report.novelty);

  return (
    <section className="dashboard-section" aria-label="Curriculum Expansion Overview">
      <div className="section-header-row">
        <div>
          <div className="scene-numbered-title">
            <span className="accent">(Overview) 6.0</span> Curriculum Expansion Index
          </div>
          <h2 className="dashboard-heading">Semantic Comparison Summary</h2>
        </div>

        {onDownloadJson && (
          <button
            type="button"
            className="json-download-btn num cursor-pointer"
            onClick={onDownloadJson}
            title="Download full machine-readable comparison report JSON"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download Report (.json)</span>
          </button>
        )}
      </div>

      <div className="asymmetric-top-row">
        {/* Left Column: Big Novelty Ring Gauge & Primary Topic Count */}
        <div className="gauge-hero-card">
          <div className="gauge-ring-container">
            <svg className="gauge-svg-a24" viewBox="0 0 200 200" aria-hidden="true">
              {/* Background track circle */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="rgba(242, 241, 237, 0.12)"
                strokeWidth={strokeWidth}
              />
              {/* Active novelty stroke (thick cream line against dark ground) */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="#f2f1ed"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
                className="gauge-val-arc-a24"
              />
            </svg>

            <div className="gauge-hero-center-content">
              <span className="gauge-hero-num num">{report.topics.new}</span>
              <span className="gauge-hero-denom num">of {report.topics.total}</span>
              <span className="gauge-hero-tag">TOPICS NEW</span>
            </div>
          </div>

          <div className="gauge-hero-caption">
            <p className="gauge-lead-text">
              <strong className="num text-highlight">{report.topics.new}</strong> of{' '}
              <strong className="num text-highlight">{report.topics.total}</strong> proposal topics are{' '}
              <span className="marker-highlight-coral active">not found in the other syllabus</span>.
            </p>
          </div>
        </div>

        {/* Right Column: Horizontal Stack of Three Inline Facts */}
        <div className="inline-facts-stack">
          {/* Fact 1: Unit-Level Index */}
          <div className="fact-item-card">
            <div className="fact-card-header">
              <span className="fact-card-idx num">01</span>
              <span className="fact-card-badge badge-coral">UNIT INDEX</span>
            </div>
            <div className="fact-card-body">
              <div className="fact-main-stat">
                <span className="fact-number num text-coral">{noveltyPct}%</span>
                <span className="fact-unit-label">unit-level index</span>
              </div>
              <p className="fact-truth-note">
                index; tends to read about 10 points high
              </p>
              <p className="fact-sub-desc">
                Aggregates coarse unit alignment across module blocks, differing from fine-grained topic counts.
              </p>
            </div>
          </div>

          {/* Fact 2: Overlap Count */}
          <div className="fact-item-card">
            <div className="fact-card-header">
              <span className="fact-card-idx num">02</span>
              <span className="fact-card-badge badge-yellow">OVERLAP</span>
            </div>
            <div className="fact-card-body">
              <div className="fact-main-stat">
                <span className="fact-number num text-yellow">{report.topics.covered}</span>
                <span className="fact-unit-label">matched topics</span>
              </div>
              <p className="fact-truth-note">
                covered in comparison
              </p>
              <p className="fact-sub-desc">
                Concepts sharing high semantic affinity (cosine ≥ 0.75) with the baseline syllabus units.
              </p>
            </div>
          </div>

          {/* Fact 3: Module Structure */}
          <div className="fact-item-card">
            <div className="fact-card-header">
              <span className="fact-card-idx num">03</span>
              <span className="fact-card-badge badge-cyan">STRUCTURE</span>
            </div>
            <div className="fact-card-body">
              <div className="fact-main-stat">
                <span className="fact-number num text-cyan">{report.n_units}</span>
                <span className="fact-unit-label">curricular units</span>
              </div>
              <p className="fact-truth-note">
                partitioned & embedded
              </p>
              <p className="fact-sub-desc">
                Syllabus modules vectorized into meaning space for semantic distance calculation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
