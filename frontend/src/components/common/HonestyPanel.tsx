import React from 'react';

export const HonestyPanel: React.FC = () => {
  return (
    <footer className="honesty-footer">
      <div className="honesty-container">
        <div className="honesty-header">
          <div>
            <div className="section-tag">
              <span className="accent">(Methodology & Transparency)</span> 0.0
            </div>
            <h3 className="honesty-title">Model Honesty & Calibration Notes</h3>
          </div>
          <div className="honesty-badge num">
            Syllabus Lens NLP Engine · Production Build 1.0
          </div>
        </div>

        <div className="honesty-grid">
          <div className="honesty-card">
            <span className="honesty-card-num num" style={{ color: 'var(--color-yellow)' }}>01 / AI Consensus Ground Truth</span>
            <p className="honesty-card-body">
              Labels used to train and test this model came from three independent AI reviewers in strict agreement, not faculty or professors.
            </p>
          </div>

          <div className="honesty-card">
            <span className="honesty-card-num num" style={{ color: 'var(--color-cyan)' }}>02 / 60–80% Recall Precision</span>
            <p className="honesty-card-body">
              The model identifies roughly 60% to 80% of real overlaps and is almost always right whenever it predicts that two topics match.
            </p>
          </div>

          <div className="honesty-card">
            <span className="honesty-card-num num" style={{ color: 'var(--color-coral)' }}>03 / Novelty Calibration</span>
            <p className="honesty-card-body">
              Novelty percentages run approximately 10 points higher than human baseline; they are best interpreted as a comparative index for ranking proposals.
            </p>
          </div>

          <div className="honesty-card">
            <span className="honesty-card-num num" style={{ color: 'var(--color-violet)' }}>04 / Recorded Real Inference</span>
            <p className="honesty-card-body">
              The landing walkthrough reflects recorded real inference embeddings from a recorded real response.
            </p>
          </div>
        </div>

        <div className="honesty-bottom num">
          <div>SYLLABUS LENS · ALL METRICS REPRODUCIBLE</div>
          <div>OFFLINE-FIRST · BUNDLED LOCALLY</div>
        </div>
      </div>
    </footer>
  );
};
