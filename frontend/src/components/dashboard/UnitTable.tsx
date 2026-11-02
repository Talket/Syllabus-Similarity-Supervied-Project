import React from 'react';
import { Unit } from '../../types/api';

interface UnitTableProps {
  units: Unit[];
  selectedUnitOrder: number;
  onSelectUnit: (order: number) => void;
  onOpenEditUnits?: () => void;
}

export const UnitTable: React.FC<UnitTableProps> = ({
  units,
  selectedUnitOrder,
  onSelectUnit,
  onOpenEditUnits,
}) => {
  return (
    <section className="dashboard-section" aria-label="Unit-by-Unit Status Breakdown">
      <div className="section-header-row">
        <div>
          <div className="scene-numbered-title">
            <span className="accent">(Structure) 6.1</span> Unit Coverage Breakdown
          </div>
          <h3 className="dashboard-subheading">Curricular Modules & Best Alignment</h3>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {onOpenEditUnits && (
            <button
              type="button"
              onClick={onOpenEditUnits}
              className="edit-units-trigger-btn num cursor-pointer"
              title="Edit detected units and re-evaluate via /api/compare/json"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>Edit Detected Units</span>
            </button>
          )}
          <div className="unit-table-legend num">
            <span className="unit-status-chip status-novel">NOVEL</span>
            <span className="unit-status-chip status-partly-covered">PARTLY COVERED</span>
            <span className="unit-status-chip status-covered">COVERED</span>
          </div>
        </div>
      </div>

      <div className="unit-table-container">
        <table className="unit-data-table">
          <thead>
            <tr className="num">
              <th style={{ width: '8%' }}>ORDER</th>
              <th style={{ width: '38%' }}>PROPOSAL UNIT TITLE</th>
              <th style={{ width: '16%' }}>STATUS</th>
              <th style={{ width: '18%' }}>BEST MATCH SCORE</th>
              <th style={{ width: '20%' }}>BEST MATCH TARGET</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => {
              const isSelected = selectedUnitOrder === u.order;
              const statusClass = `status-${u.status.toLowerCase().replace(/\s+/g, '-')}`;
              const scorePct = u.best_score ? Math.round(u.best_score * 100) : 0;

              return (
                <tr
                  key={u.order}
                  className={`unit-table-row ${isSelected ? 'is-selected' : ''} cursor-pointer`}
                  onClick={() => onSelectUnit(u.order)}
                  title="Click to view detailed side-by-side text comparison"
                >
                  <td className="unit-cell-order num">
                    <span>0{u.order}</span>
                  </td>

                  <td className="unit-cell-title">
                    <strong className="unit-name">{u.title}</strong>
                    {isSelected && <span className="unit-selected-tag num">ACTIVE VIEW</span>}
                  </td>

                  <td className="unit-cell-status">
                    <span className={`unit-status-chip ${statusClass}`}>{u.status}</span>
                  </td>

                  <td className="unit-cell-score">
                    <div className="unit-score-bar-wrap">
                      <div className="unit-score-meta num">
                        <span>{u.best_score !== undefined ? u.best_score.toFixed(3) : '—'}</span>
                        <span className="unit-score-pct">{scorePct}%</span>
                      </div>
                      <div className="unit-score-track">
                        <div
                          className="unit-score-fill"
                          style={{
                            width: `${scorePct}%`,
                            backgroundColor:
                              u.status === 'covered'
                                ? 'var(--color-cyan)'
                                : u.status === 'partly covered'
                                ? 'var(--color-yellow)'
                                : 'var(--color-coral)',
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="unit-cell-target">
                    {u.best_unit_title ? (
                      <span className="unit-target-name num">
                        {u.best_course_title || u.best_course ? `${u.best_course_title || u.best_course} · ` : ''}{u.best_unit_title}
                      </span>
                    ) : (
                      <span className="text-dim num">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
