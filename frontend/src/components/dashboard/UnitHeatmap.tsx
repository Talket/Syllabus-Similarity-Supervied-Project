import React, { useState } from 'react';
import { UnitMatrix } from '../../types/api';

interface UnitHeatmapProps {
  matrix: UnitMatrix;
  onSelectUnitPair?: (aOrder: number, bOrder: number) => void;
}

export const UnitHeatmap: React.FC<UnitHeatmapProps> = ({ matrix, onSelectUnitPair }) => {
  const [hoveredCell, setHoveredCell] = useState<{
    row: number;
    col: number;
    val: number;
    aTitle: string;
    bTitle: string;
  } | null>(null);

  const getCellColor = (val: number): string => {
    // Range roughly -0.05 to 0.70
    // Thresholds: >= 0.50 strong, >= 0.38 moderate, >= 0.20 partial, < 0.20 minimal
    if (val >= 0.5) return 'rgba(110, 231, 249, 0.85)'; // Beam cyan
    if (val >= 0.38) return 'rgba(110, 231, 249, 0.55)';
    if (val >= 0.25) return 'rgba(110, 231, 249, 0.30)';
    if (val >= 0.12) return 'rgba(255, 255, 255, 0.08)';
    return 'rgba(255, 255, 255, 0.02)';
  };

  const getCellTextColor = (val: number): string => {
    if (val >= 0.5) return '#0c0c0c';
    if (val >= 0.3) return '#f2f1ed';
    return '#8c8b88';
  };

  return (
    <section className="dashboard-section" aria-label="Unit Similarity Heatmap">
      <div className="section-header-row">
        <div>
          <div className="section-tag">
            <span className="accent">(Matrix) 6.2</span> Cross-Unit Similarity Heatmap
          </div>
          <h3 className="dashboard-subheading">Pairwise Cosine Affinity Grid</h3>
        </div>

        <div className="heatmap-legend num">
          <span className="heatmap-legend-label">SIMILARITY:</span>
          <span className="heatmap-legend-chip" style={{ background: 'rgba(255, 255, 255, 0.02)', color: '#8c8b88' }}>&lt; 0.20</span>
          <span className="heatmap-legend-chip" style={{ background: 'rgba(110, 231, 249, 0.30)', color: '#f2f1ed' }}>0.25–0.38</span>
          <span className="heatmap-legend-chip" style={{ background: 'rgba(110, 231, 249, 0.85)', color: '#0c0c0c' }}>&ge; 0.50 Strong</span>
        </div>
      </div>

      <div className="heatmap-wrapper">
        <div className="heatmap-table-container">
          <table className="heatmap-table">
            <thead>
              <tr>
                <th className="heatmap-corner-cell num">PROPOSAL (A) \ REFERENCE (B)</th>
                {matrix.b_titles.map((bTitle, cIdx) => (
                  <th key={cIdx} className="heatmap-col-header num" title={bTitle}>
                    <span>B{cIdx + 1}</span>
                    <span className="col-header-full">{bTitle.slice(0, 18)}...</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.sim.map((row, rIdx) => {
                const aTitle = matrix.a_titles[rIdx] || `Unit ${rIdx + 1}`;
                return (
                  <tr key={rIdx}>
                    <td className="heatmap-row-header" title={aTitle}>
                      <span className="row-order num">A{rIdx + 1}</span>
                      <span className="row-title">{aTitle}</span>
                    </td>

                    {row.map((val, cIdx) => {
                      const bTitle = matrix.b_titles[cIdx] || `Unit ${cIdx + 1}`;
                      const isHovered =
                        hoveredCell?.row === rIdx && hoveredCell?.col === cIdx;

                      return (
                        <td
                          key={cIdx}
                          className={`heatmap-cell num cursor-pointer ${isHovered ? 'is-cell-hovered' : ''}`}
                          style={{
                            backgroundColor: getCellColor(val),
                            color: getCellTextColor(val),
                          }}
                          onMouseEnter={() =>
                            setHoveredCell({ row: rIdx, col: cIdx, val, aTitle, bTitle })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                          onClick={() => onSelectUnitPair?.(rIdx + 1, cIdx + 1)}
                        >
                          <span>{val.toFixed(3)}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Hover Inspector Card */}
        <div className="heatmap-inspector-card">
          {hoveredCell ? (
            <div className="inspector-content">
              <div className="inspector-tag num">PAIRWISE INSPECTION</div>
              <div className="inspector-score num">
                <span className="inspector-val">{hoveredCell.val.toFixed(3)}</span>
                <span className="inspector-badge">
                  {hoveredCell.val >= 0.50 ? 'STRONG ALIGNMENT' : hoveredCell.val >= 0.38 ? 'MODERATE OVERLAP' : 'LOOSE / DISJOINT'}
                </span>
              </div>
              <div className="inspector-pair">
                <div className="inspector-line">
                  <span className="side-badge num">A{hoveredCell.row + 1}</span>
                  <span className="side-text">{hoveredCell.aTitle}</span>
                </div>
                <div className="inspector-line">
                  <span className="side-badge badge-b num">B{hoveredCell.col + 1}</span>
                  <span className="side-text">{hoveredCell.bTitle}</span>
                </div>
              </div>
              <div className="inspector-action num">Click cell to load in text viewer ↓</div>
            </div>
          ) : (
            <div className="inspector-placeholder num">
              <span>HOVER ANY MATRIX CELL FOR PAIRWISE METRICS</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
