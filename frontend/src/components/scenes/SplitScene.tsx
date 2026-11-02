import React from 'react';
import { Report, ParsedDoc, Viz, TopicItem, VizPoint } from '../../types/api';

interface SplitSceneProps {
  progress: number; // 0..1
  report: Report;
  parsedA?: ParsedDoc;
  parsedB?: ParsedDoc;
  viz?: Viz;
}

export const SplitScene: React.FC<SplitSceneProps> = ({
  progress,
  report,
  parsedA,
  parsedB,
  viz,
}) => {
  // Phase 1: 0.00 .. 0.45: Sheets break into horizontal unit strips and stack in 2 vertical columns
  const unitBreakProgress = Math.min(1, Math.max(0, progress / 0.45));

  // Phase 2: 0.45 .. 1.00: Unit strips expand to reveal topic chips in neat flex-wrap rows
  const topicShatterProgress = Math.min(1, Math.max(0, (progress - 0.4) / 0.6));

  const unitsA = parsedA?.units || [];
  const unitsB = parsedB?.units || [];
  const totalUnits = unitsA.length + unitsB.length || report.n_units;

  // Counter climb animations
  const visibleUnitsCount = Math.min(
    totalUnits,
    Math.max(1, Math.round(unitBreakProgress * totalUnits))
  );
  const visibleTopicsCount = Math.min(
    report.topics.total,
    Math.round(topicShatterProgress * report.topics.total)
  );

  // Group Document A topics by unit
  const topicsAByUnit = (unitOrder: number): TopicItem[] => {
    return report.topics.items.filter((t) => t.unit === unitOrder);
  };

  // Group Document B topics (from viz.points with side 'B') by unit
  const topicsBByUnit = (unitOrder: number): VizPoint[] => {
    if (!viz) return [];
    return viz.points.filter((p) => p.side === 'B' && p.unit === unitOrder);
  };

  return (
    <div className="scene-viewport scene-split" aria-label="Scene 2: Split into Units and Topic Chips">
      {/* Editorial Counters Header */}
      <div className="split-counters-header">
        <div className="section-tag">
          <span className="accent">(Split) 2.0</span>
        </div>
        <div className="split-indices num">
          <span className="split-sub-tag">
            2.1 Units <strong className="split-highlight-val">{visibleUnitsCount}</strong> / {totalUnits}
          </span>
          <span className="split-divider">/</span>
          <span className="split-sub-tag">
            2.2 Topics <strong className="split-highlight-val">{visibleTopicsCount}</strong> / {report.topics.total}
          </span>
        </div>
      </div>

      {/* Two Neat Vertical Columns: Document A on Left, Document B on Right */}
      <div className="split-two-columns">
        {/* Column Left: Document A (Proposal) - Cyan Chips */}
        <div
          className="split-col split-col-a"
          style={{
            transform: `translateY(${(1 - unitBreakProgress) * 30}px)`,
            opacity: Math.min(1, 0.4 + unitBreakProgress * 0.6),
          }}
        >
          <div className="split-col-header">
            <span className="split-col-badge split-badge-cyan num">
              DOCUMENT A · {parsedA?.code || 'PROPOSAL'}
            </span>
            <h3 className="split-col-title">{parsedA?.title || report.title}</h3>
          </div>

          <div className="split-units-stack">
            {unitsA.map((u, i) => {
              const isUnitVisible = i < Math.ceil((visibleUnitsCount / totalUnits) * unitsA.length);
              const unitTopics = topicsAByUnit(u.order);

              return (
                <div
                  key={`a-${u.order}`}
                  className={`split-unit-card split-unit-card-a ${isUnitVisible ? 'is-visible' : 'is-faded'}`}
                >
                  <div className="split-unit-strip">
                    <span className="split-unit-order num">Unit 0{u.order}</span>
                    <h4 className="split-unit-title">{u.title}</h4>
                  </div>

                  {/* Topic Chips in Neat Flex-Wrap Rows (Zero Overlap) */}
                  {topicShatterProgress > 0 && unitTopics.length > 0 && (
                    <div
                      className="split-chips-wrap"
                      style={{
                        opacity: topicShatterProgress,
                        transform: `scale(${0.96 + topicShatterProgress * 0.04})`,
                      }}
                    >
                      {unitTopics.map((t, idx) => (
                        <div
                          key={`chip-a-${u.order}-${idx}`}
                          className="split-chip split-chip-cyan"
                        >
                          <span className="chip-unit-tag num">U{t.unit}</span>
                          <span className="chip-label">{t.topic}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Column Right: Document B (Comparison) - Violet Chips */}
        <div
          className="split-col split-col-b"
          style={{
            transform: `translateY(${(1 - unitBreakProgress) * 30}px)`,
            opacity: Math.min(1, 0.4 + unitBreakProgress * 0.6),
          }}
        >
          <div className="split-col-header">
            <span className="split-col-badge split-badge-violet num">
              DOCUMENT B · {parsedB?.code || 'COMPARISON'}
            </span>
            <h3 className="split-col-title">{parsedB?.title || 'Supervised Learning'}</h3>
          </div>

          <div className="split-units-stack">
            {unitsB.map((u, i) => {
              const isUnitVisible = i < Math.ceil((visibleUnitsCount / totalUnits) * unitsB.length);
              const unitTopicsB = topicsBByUnit(u.order);

              return (
                <div
                  key={`b-${u.order}`}
                  className={`split-unit-card split-unit-card-b ${isUnitVisible ? 'is-visible' : 'is-faded'}`}
                >
                  <div className="split-unit-strip">
                    <span className="split-unit-order num">Unit 0{u.order}</span>
                    <h4 className="split-unit-title">{u.title}</h4>
                  </div>

                  {/* Topic Chips in Neat Flex-Wrap Rows (Zero Overlap) */}
                  {topicShatterProgress > 0 && unitTopicsB.length > 0 && (
                    <div
                      className="split-chips-wrap"
                      style={{
                        opacity: topicShatterProgress,
                        transform: `scale(${0.96 + topicShatterProgress * 0.04})`,
                      }}
                    >
                      {unitTopicsB.map((pt, idx) => (
                        <div
                          key={`chip-b-${u.order}-${idx}`}
                          className="split-chip split-chip-violet"
                        >
                          <span className="chip-unit-tag num">U{pt.unit}</span>
                          <span className="chip-label">{pt.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
