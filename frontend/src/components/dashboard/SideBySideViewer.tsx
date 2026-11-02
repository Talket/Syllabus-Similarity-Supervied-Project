import React, { useState } from 'react';
import { CourseMatch, Match } from '../../types/api';

interface SideBySideViewerProps {
  courseMatch: CourseMatch;
  initialUnitOrder?: number;
}

export const SideBySideViewer: React.FC<SideBySideViewerProps> = ({
  courseMatch,
  initialUnitOrder = 1,
}) => {
  const matches = courseMatch.matches || [];
  
  // Find match index for initialUnitOrder, or fallback to 0
  const initialMatchIdx = Math.max(
    0,
    matches.findIndex((m) => m.new_order === initialUnitOrder)
  );
  const [selectedMatchIdx, setSelectedMatchIdx] = useState<number>(initialMatchIdx);
  const [showShared, setShowShared] = useState<boolean>(true);
  const [showCoveredElsewhere, setShowCoveredElsewhere] = useState<boolean>(true);
  const [showNovel, setShowNovel] = useState<boolean>(false);
  const [showExistingOnly, setShowExistingOnly] = useState<boolean>(false);

  const activeMatch: Match | undefined = matches[selectedMatchIdx] || matches[0];

  if (!activeMatch) {
    return (
      <section className="dashboard-section">
        <div className="section-tag">
          <span className="accent">(Verification) 6.3</span> Side-by-Side Text Comparison
        </div>
        <div className="p-8 text-center text-muted num">No match text data available</div>
      </section>
    );
  }

  // Multi-line safe highlighting renderer
  const renderHighlightedText = (
    text: string,
    highlights: { phrase: string; type: 'shared' | 'covered-elsewhere' | 'novel' | 'existing-only'; tooltip?: string }[]
  ) => {
    if (!text) return null;

    // Filter valid phrases
    const validPhrases = highlights.filter((h) => h.phrase && h.phrase.trim().length > 1);
    if (validPhrases.length === 0) return text;

    // Sort phrases by descending length to match longest phrases first
    validPhrases.sort((a, b) => b.phrase.length - a.phrase.length);

    // Escape regex special chars
    const escapeRegex = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const pattern = new RegExp(
      `(${validPhrases.map((h) => escapeRegex(h.phrase)).join('|')})`,
      'gi'
    );

    const parts = text.split(pattern);

    return parts.map((part, i) => {
      const matchMeta = validPhrases.find(
        (h) => h.phrase.toLowerCase() === part.toLowerCase()
      );

      if (!matchMeta) {
        return <span key={i}>{part}</span>;
      }

      let highlightClass = 'marker-highlight active';
      if (matchMeta.type === 'novel') {
        highlightClass = 'marker-highlight-coral active';
      } else if (matchMeta.type === 'covered-elsewhere' || matchMeta.type === 'existing-only') {
        highlightClass = 'marker-highlight-violet active';
      }

      return (
        <span
          key={i}
          className={highlightClass}
          title={matchMeta.tooltip || matchMeta.phrase}
        >
          {part}
        </span>
      );
    });
  };

  const targetCourseLabel = courseMatch.course_id || courseMatch.title || 'Reference';

  // Compile highlights for Side A (Proposal)
  const highlightsA = [
    ...(showShared
      ? (activeMatch.shared_topics || []).map((st) => ({
          phrase: st.new,
          type: 'shared' as const,
          tooltip: `Direct semantic match with ${targetCourseLabel}: "${st.existing}" (similarity: ${st.sim.toFixed(3)})`,
        }))
      : []),
    ...(showCoveredElsewhere
      ? (activeMatch.covered_elsewhere || []).map((ce) => ({
          phrase: ce.topic,
          type: 'covered-elsewhere' as const,
          tooltip: `Covered in ${targetCourseLabel} Unit ${ce.match_unit}: "${ce.match}"`,
        }))
      : []),
    ...(showNovel
      ? (activeMatch.only_in_new || []).map((o) => ({
          phrase: o,
          type: 'novel' as const,
          tooltip: 'Novel topic uniquely introduced in this proposal',
        }))
      : []),
  ];

  // Compile highlights for Side B (Existing)
  const highlightsB = [
    ...(showShared
      ? (activeMatch.shared_topics || []).map((st) => ({
          phrase: st.existing,
          type: 'shared' as const,
          tooltip: `Direct semantic match with Proposal: "${st.new}" (similarity: ${st.sim.toFixed(3)})`,
        }))
      : []),
    ...(showExistingOnly
      ? (activeMatch.only_in_existing || []).map((oe) => ({
          phrase: oe,
          type: 'existing-only' as const,
          tooltip: `Topic present in ${targetCourseLabel} but absent in Proposal`,
        }))
      : []),
  ];

  return (
    <section className="dashboard-section" aria-label="Side-by-Side Text Comparison">
      <div className="section-header-row">
        <div>
          <div className="section-tag">
            <span className="accent">(Verification) 6.3</span> Side-by-Side Document Comparison
          </div>
          <h3 className="dashboard-subheading">Aligned Curriculum Passages & Highlighted Overlaps</h3>
        </div>

        {/* Legend / Interactive Toggles */}
        <div className="viewer-legend num">
          <button
            type="button"
            className={`legend-chip cursor-pointer ${showShared ? 'active' : 'inactive'}`}
            onClick={() => setShowShared(!showShared)}
            title="Click to toggle shared matches highlighter"
            style={{ opacity: showShared ? 1 : 0.45 }}
          >
            <span className="legend-box box-yellow" /> Shared Match ({activeMatch.shared_topics?.length || 0})
          </button>
          <button
            type="button"
            className={`legend-chip cursor-pointer ${showCoveredElsewhere ? 'active' : 'inactive'}`}
            onClick={() => {
              setShowCoveredElsewhere(!showCoveredElsewhere);
              setShowExistingOnly(!showExistingOnly);
            }}
            title="Click to toggle covered elsewhere highlighter"
            style={{ opacity: showCoveredElsewhere ? 1 : 0.45 }}
          >
            <span className="legend-box box-violet" /> Covered Elsewhere ({activeMatch.covered_elsewhere?.length || 0})
          </button>
          <button
            type="button"
            className={`legend-chip cursor-pointer ${showNovel ? 'active' : 'inactive'}`}
            onClick={() => setShowNovel(!showNovel)}
            title="Click to toggle novel topics highlighter"
            style={{ opacity: showNovel ? 1 : 0.45 }}
          >
            <span className="legend-box box-coral" /> Novel Topics ({activeMatch.only_in_new?.length || 0})
          </button>
        </div>
      </div>

      {/* Match Unit Selector Tabs */}
      <div className="viewer-tabs-row num">
        {matches.map((m, idx) => (
          <button
            key={idx}
            type="button"
            className={`viewer-tab-btn ${selectedMatchIdx === idx ? 'is-active' : ''}`}
            onClick={() => setSelectedMatchIdx(idx)}
          >
            <span>Unit 0{m.new_order} vs {targetCourseLabel} Unit 0{m.old_order}</span>
            <span className="viewer-tab-score">SIM {m.score.toFixed(3)}</span>
          </button>
        ))}
      </div>

      {/* Side-by-Side Panes */}
      <div className="viewer-panes-grid">
        {/* Pane A: Proposal Syllabus */}
        <div className="viewer-pane pane-a">
          <div className="pane-header">
            <div className="pane-header-left">
              <span className="pane-badge num">SYLLABUS A · PROPOSAL</span>
              <h4 className="pane-title">Unit 0{activeMatch.new_order}</h4>
            </div>
          </div>

          <div className="pane-body">
            <p className="pane-prose">
              {renderHighlightedText(activeMatch.new_text, highlightsA)}
            </p>
          </div>

          <div className="pane-footer num">
            <span>Shared Topics: {activeMatch.shared_topics?.length || 0}</span>
            <span>Novel Additions: {activeMatch.only_in_new?.length || 0}</span>
          </div>
        </div>

        {/* Pane B: Reference Syllabus */}
        <div className="viewer-pane pane-b">
          <div className="pane-header">
            <div className="pane-header-left">
              <span className="pane-badge sheet-badge-b num">SYLLABUS B · REFERENCE</span>
              <h4 className="pane-title">Unit 0{activeMatch.old_order}</h4>
            </div>
            <div className="pane-badge-sub num">
              {courseMatch.course_id ? `${courseMatch.course_id} · ` : ''}{courseMatch.title}
            </div>
          </div>

          <div className="pane-body">
            <p className="pane-prose">
              {renderHighlightedText(activeMatch.old_text, highlightsB)}
            </p>
          </div>

          <div className="pane-footer num">
            <span>Cosine Similarity: {activeMatch.score.toFixed(3)}</span>
            <span>Band: {activeMatch.band?.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
