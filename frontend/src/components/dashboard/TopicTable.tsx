import React, { useState, useMemo } from 'react';
import { TopicItem } from '../../types/api';

interface TopicTableProps {
  topics: TopicItem[];
  effectiveThreshold?: number; // to filter by strictness threshold
}

export const TopicTable: React.FC<TopicTableProps> = ({
  topics,
  effectiveThreshold = 0.75,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'new' | 'covered'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter topics based on active tab, search query, and effective strictness threshold
  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      // Re-evaluate covered status according to effective threshold if score is available
      const isActuallyCovered = t.covered && t.score >= effectiveThreshold;

      if (filterMode === 'new' && isActuallyCovered) return false;
      if (filterMode === 'covered' && !isActuallyCovered) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTopic = t.topic.toLowerCase().includes(q);
        const matchCounterpart = (t.match || '').toLowerCase().includes(q);
        if (!matchTopic && !matchCounterpart) return false;
      }

      return true;
    });
  }, [topics, filterMode, searchQuery, effectiveThreshold]);

  const counts = useMemo(() => {
    const coveredCount = topics.filter((t) => t.covered && t.score >= effectiveThreshold).length;
    return {
      all: topics.length,
      covered: coveredCount,
      new: topics.length - coveredCount,
    };
  }, [topics, effectiveThreshold]);

  return (
    <section className="dashboard-section" aria-label="Topic Comparison Ledger">
      <div className="section-header-row">
        <div>
          <div className="scene-numbered-title">
            <span className="accent">(Ledger) 6.4</span> Granular Topic Catalog
          </div>
          <h3 className="dashboard-subheading">Two-Column Curriculum Ledger</h3>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="topic-controls-row">
          <div className="topic-filter-tabs num">
            <button
              type="button"
              className={`topic-tab-btn ${filterMode === 'all' ? 'is-active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              All Topics ({counts.all})
            </button>
            <button
              type="button"
              className={`topic-tab-btn tab-coral ${filterMode === 'new' ? 'is-active' : ''}`}
              onClick={() => setFilterMode('new')}
            >
              Novel ({counts.new})
            </button>
            <button
              type="button"
              className={`topic-tab-btn tab-yellow ${filterMode === 'covered' ? 'is-active' : ''}`}
              onClick={() => setFilterMode('covered')}
            >
              Covered ({counts.covered})
            </button>
          </div>

          <div className="topic-search-wrap">
            <input
              type="text"
              placeholder="Search topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="topic-search-input num"
              aria-label="Filter topics list"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Two-Column Ledger Layout */}
      <div className="two-column-ledger-container">
        <div className="ledger-columns-header num">
          <div className="ledger-col-head col-left">
            <span>SYLLABUS A (PROPOSAL TOPICS)</span>
          </div>
          <div className="ledger-col-head col-right">
            <span>SYLLABUS B (MATCHING TOPICS & DISTANCE)</span>
          </div>
        </div>

        <div className="ledger-rows-list">
          {filteredTopics.length === 0 ? (
            <div className="ledger-empty-state num">
              No topics matching the current filter criteria
            </div>
          ) : (
            filteredTopics.map((t, idx) => {
              const isCovered = t.covered && t.score >= effectiveThreshold;
              return (
                <div
                  key={`${t.unit}-${t.topic}-${idx}`}
                  className={`ledger-entry-row ${isCovered ? 'is-covered' : 'is-novel'}`}
                >
                  {/* Left Column: Syllabus A */}
                  <div className="ledger-entry-left">
                    <div className="ledger-topic-badge-row">
                      <span className="ledger-unit-badge num">Unit 0{t.unit}</span>
                      {isCovered ? (
                        <span className="ledger-status-badge badge-covered num">COVERED</span>
                      ) : (
                        <span className="ledger-status-badge badge-coral num">NEW</span>
                      )}
                    </div>
                    <div className="ledger-topic-text">
                      <span className="topic-title-strong">{t.topic}</span>
                    </div>
                  </div>

                  {/* Divider arrow/indicator */}
                  <div className="ledger-entry-divider">
                    <span className="divider-line" />
                    {isCovered ? (
                      <span className="divider-icon text-yellow">⟷</span>
                    ) : (
                      <span className="divider-icon text-dim">∅</span>
                    )}
                    <span className="divider-line" />
                  </div>

                  {/* Right Column: Syllabus B */}
                  <div className="ledger-entry-right">
                    {isCovered && t.match ? (
                      <div className="ledger-match-card">
                        <div className="ledger-match-top num">
                          <span className="ledger-match-course">
                            {t.course_title ? `${t.course_title} · ` : ''}{t.match_unit ? `Unit 0${t.match_unit}` : 'Matched Unit'}
                          </span>
                          <span className="ledger-match-score text-yellow">
                            cos {t.score.toFixed(3)}
                          </span>
                        </div>
                        <div className="ledger-match-quote">
                          “{t.match}”
                        </div>
                      </div>
                    ) : (
                      <div className="ledger-no-match num">
                        <span className="no-match-tag">No direct match</span>
                        <span className="no-match-desc">Not found in reference syllabus at threshold {effectiveThreshold.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};
