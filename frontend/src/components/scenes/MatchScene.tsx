import React from 'react';
import { Viz, VizLink, VizPoint } from '../../types/api';

interface MatchSceneProps {
  progress: number; // 0..1
  viz: Viz;
  onActiveLinkChange?: (activeLinkIndex: number | null) => void;
}

export const MatchScene: React.FC<MatchSceneProps> = ({
  progress,
  viz,
  onActiveLinkChange,
}) => {
  // Sort links in descending order of score
  const sortedLinks = [...viz.links].sort((x, y) => y.score - x.score);
  const totalLinks = sortedLinks.length;

  // Find points by ID
  const pointsMap = new Map<number, VizPoint>();
  viz.points.forEach((p) => pointsMap.set(p.id, p));

  // Determine which links are activated based on progress
  // progress 0..1 distributed among links
  const activeLinkThreshold = progress * totalLinks;

  // React to active link change
  const currentActiveIdx = Math.min(
    totalLinks - 1,
    Math.max(0, Math.floor(activeLinkThreshold))
  );

  React.useEffect(() => {
    if (progress > 0.05 && progress < 0.98) {
      onActiveLinkChange?.(currentActiveIdx);
    } else {
      onActiveLinkChange?.(null);
    }
  }, [currentActiveIdx, progress, onActiveLinkChange]);

  return (
    <div className="scene-viewport scene-match" aria-label="Scene 4: Semantic Link Matching">
      {/* Header with Sub-Indices */}
      <div className="match-header">
        <div className="section-tag">
          <span className="accent">(Match) 4.0</span>
        </div>
        <div className="match-stats num">
          <span className="text-yellow">
            Matched {Math.min(totalLinks, Math.floor(activeLinkThreshold + 0.3))} of {totalLinks} Pairs
          </span>
        </div>
      </div>

      <div className="match-stage">
        {/* Visual Map with Beam Arcs */}
        <div className="match-canvas-overlay">
          <svg className="match-beams-svg" viewBox="-120 -120 240 240" aria-hidden="true">
            {/* Background meaning space ring */}
            <circle cx="0" cy="0" r="100" fill="none" stroke="rgba(242, 241, 237, 0.08)" strokeDasharray="3 3" />
            <circle cx="0" cy="0" r="60" fill="none" stroke="rgba(242, 241, 237, 0.05)" />

            {/* Render all points as subtle nodes */}
            {viz.points.map((pt) => {
              const cx = pt.x * 90;
              const cy = pt.y * 90;
              const isMatchedA = pt.side === 'A' && pt.covered;
              const isSideA = pt.side === 'A';

              return (
                <circle
                  key={`pt-${pt.id}`}
                  cx={cx}
                  cy={cy}
                  r={isMatchedA ? 3.5 : 2}
                  fill={isMatchedA ? '#ffd93d' : isSideA ? '#6ee7f9' : '#8b7cff'}
                  opacity={isMatchedA ? 0.9 : 0.4}
                />
              );
            })}

            {/* Render connecting beams for active links */}
            {sortedLinks.map((link, idx) => {
              const ptA = pointsMap.get(link.a);
              const ptB = pointsMap.get(link.b);
              if (!ptA || !ptB) return null;

              // Step progress for this specific beam
              const linkProgress = Math.min(
                1,
                Math.max(0, (progress - (idx / totalLinks) * 0.75) / (0.8 / totalLinks))
              );

              if (linkProgress <= 0) return null;

              const x1 = ptA.x * 90;
              const y1 = ptA.y * 90;
              const x2 = ptB.x * 90;
              const y2 = ptB.y * 90;

              // Interpolate end position based on beam growth
              const curX2 = x1 + (x2 - x1) * linkProgress;
              const curY2 = y1 + (y2 - y1) * linkProgress;

              // Quadratic curve control point
              const midX = (x1 + x2) / 2 + (y2 - y1) * 0.2;
              const midY = (y1 + y2) / 2 - (x2 - x1) * 0.2;

              return (
                <g key={`beam-${link.a}-${link.b}`}>
                  {/* Glow line */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={curX2}
                    y2={curY2}
                    stroke="#ffd93d"
                    strokeWidth="4"
                    strokeOpacity={0.3 * linkProgress}
                    strokeLinecap="round"
                  />
                  {/* Core sharp beam */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={curX2}
                    y2={curY2}
                    stroke="#ffd93d"
                    strokeWidth="1.6"
                    strokeOpacity={0.95 * linkProgress}
                    strokeLinecap="round"
                  />
                  {/* Pulse head */}
                  <circle cx={curX2} cy={curY2} r={linkProgress * 4} fill="#6ee7f9" />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Live Staggered Matched Cards Stream */}
        <div className="match-cards-stream">
          {sortedLinks.map((link: VizLink, idx: number) => {
            const ptA = pointsMap.get(link.a);
            const ptB = pointsMap.get(link.b);
            const isRevealed = progress >= (idx * 0.28);
            const isActive = Math.floor(activeLinkThreshold) === idx;

            if (!ptA || !ptB) return null;

            return (
              <div
                key={`card-${link.a}-${link.b}`}
                className={`match-link-card ${isRevealed ? 'is-revealed' : 'is-hidden'} ${isActive ? 'is-focused' : ''}`}
              >
                <div className="match-card-header num">
                  <span className="match-rank-tag">MATCH 0{idx + 1}</span>
                  <span className="match-score-badge">
                    SIM {link.score.toFixed(3)}
                  </span>
                </div>

                <div className="match-card-row">
                  <div className="match-phrase-side side-a">
                    <span className="match-side-label num">PROPOSAL (CSE275 · U{ptA.unit})</span>
                    <span className={`marker-highlight ${isRevealed ? 'active' : ''}`}>
                      {ptA.text}
                    </span>
                  </div>

                  <div className="match-bridge-arrow num">⇄</div>

                  <div className="match-phrase-side side-b">
                    <span className="match-side-label num">REF · U{ptB.unit}</span>
                    <span className={`marker-highlight ${isRevealed ? 'active' : ''}`}>
                      {ptB.text}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

