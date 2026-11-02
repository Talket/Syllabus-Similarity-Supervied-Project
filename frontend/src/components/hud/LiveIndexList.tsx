import React from 'react';
import { TopicItem, VizLink } from '../../types/api';

interface LiveIndexListProps {
  topics: TopicItem[];
  activeTopicIndex: number | null; // currently highlighted in match sequence
  matchedLinks?: VizLink[];
  progress?: number;
  onSelectTopic?: (topic: TopicItem) => void;
  visible?: boolean;
}

export const LiveIndexList: React.FC<LiveIndexListProps> = ({
  topics,
  activeTopicIndex,
  onSelectTopic,
  visible = true,
}) => {
  if (!visible) return null;

  // Show only matched topics as a ledger
  const matchedTopics = topics.filter((t) => t.covered);

  return (
    <aside className="live-index-aside" aria-label="Matched Topics Ledger">
      <div className="live-index-header">
        <span className="live-index-title">Matched Topics</span>
        <span className="live-index-count num">{matchedTopics.length} pairs</span>
      </div>

      <div className="live-index-scroll">
        <ol className="live-index-list">
          {matchedTopics.map((t, idx) => {
            const originalIndex = topics.findIndex((item) => item.topic === t.topic);
            const isActive = activeTopicIndex === originalIndex;

            return (
              <li
                key={`${t.unit}-${t.topic}-${idx}`}
                className={`live-index-item ${isActive ? 'is-active' : ''} is-covered`}
                onClick={() => onSelectTopic?.(t)}
              >
                <div className="live-index-item-meta num">
                  <span className="live-index-unit">Unit 0{t.unit}</span>
                  {t.score > 0 && (
                    <span className="live-index-score">{t.score.toFixed(3)}</span>
                  )}
                </div>

                <div className="live-index-phrase-wrap">
                  <span
                    className={`marker-highlight ${isActive ? 'active' : ''}`}
                    title={t.topic}
                  >
                    {t.topic}
                  </span>
                </div>

                {isActive && t.match && (
                  <div className="live-index-match-preview">
                    <span className="live-index-match-label">Matched with:</span>
                    <span className="live-index-match-text">“{t.match}”</span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
};

