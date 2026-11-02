import React, { useState } from 'react';
import { TuneSettings, DEFAULT_TUNE_SETTINGS } from '../../types/tune';

interface TunePanelProps {
  settings: TuneSettings;
  onChange: (next: TuneSettings) => void;
  onReset?: () => void;
  onClose?: () => void;
}

export const TunePanel: React.FC<TunePanelProps> = ({
  settings,
  onChange,
  onReset,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const update = <K extends keyof TuneSettings>(key: K, value: TuneSettings[K]) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy settings JSON', err);
    }
  };

  return (
    <div
      className={`tune-panel-container ${isCollapsed ? 'is-collapsed' : ''}`}
      role="region"
      aria-label="Director Tuning Panel"
    >
      <div className="tune-panel-header">
        <div className="tune-panel-title">
          <span className="tune-panel-badge num">?tune=1</span>
          <span className="tune-panel-name">Director Controls</span>
        </div>
        <div className="tune-panel-actions">
          <button
            type="button"
            className="tune-btn-icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
          >
            {isCollapsed ? '+' : '−'}
          </button>
          {onClose && (
            <button
              type="button"
              className="tune-btn-icon"
              onClick={onClose}
              title="Close Tuning Panel"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="tune-panel-body">
          {/* Action Row */}
          <div className="tune-btn-row">
            <button
              type="button"
              className={`tune-btn-copy num ${copied ? 'is-copied' : ''}`}
              onClick={handleCopyJson}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{copied ? 'Copied as JSON!' : 'Copy settings as JSON'}</span>
            </button>

            {onReset && (
              <button
                type="button"
                className="tune-btn-reset num"
                onClick={onReset}
                title="Restore Baseline Defaults"
              >
                Reset
              </button>
            )}
          </div>

          {/* Section: Scene Durations */}
          <div className="tune-group">
            <div className="tune-group-title num">SCENE DURATIONS</div>
            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Scene 0: Hero (0-4%)</span>
                <span className="tune-val num">{settings.scene0Duration}s</span>
              </div>
              <input
                type="range"
                min="2"
                max="15"
                step="1"
                value={settings.scene0Duration}
                onChange={(e) => update('scene0Duration', parseFloat(e.target.value))}
              />
            </div>

            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Scene 1: Read (4-18%)</span>
                <span className="tune-val num">{settings.scene1Duration}s</span>
              </div>
              <input
                type="range"
                min="6"
                max="25"
                step="1"
                value={settings.scene1Duration}
                onChange={(e) => update('scene1Duration', parseFloat(e.target.value))}
              />
            </div>

            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Scene 2: Split (18-36%)</span>
                <span className="tune-val num">{settings.scene2Duration}s</span>
              </div>
              <input
                type="range"
                min="8"
                max="30"
                step="1"
                value={settings.scene2Duration}
                onChange={(e) => update('scene2Duration', parseFloat(e.target.value))}
              />
            </div>

            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Scene 3: Embed (36-54%)</span>
                <span className="tune-val num">{settings.scene3Duration}s</span>
              </div>
              <input
                type="range"
                min="10"
                max="35"
                step="1"
                value={settings.scene3Duration}
                onChange={(e) => update('scene3Duration', parseFloat(e.target.value))}
              />
            </div>

            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Scene 4: Match (54-80%)</span>
                <span className="tune-val num">{settings.scene4Duration}s</span>
              </div>
              <input
                type="range"
                min="12"
                max="45"
                step="1"
                value={settings.scene4Duration}
                onChange={(e) => update('scene4Duration', parseFloat(e.target.value))}
              />
            </div>

            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Scene 5: Verdict (80-94%)</span>
                <span className="tune-val num">{settings.scene5Duration}s</span>
              </div>
              <input
                type="range"
                min="8"
                max="30"
                step="1"
                value={settings.scene5Duration}
                onChange={(e) => update('scene5Duration', parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Section: Scan Line */}
          <div className="tune-group">
            <div className="tune-group-title num">BLUE SCAN LINE</div>
            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Scan Sweep Speed</span>
                <span className="tune-val num">{settings.scanSpeed.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.05"
                value={settings.scanSpeed}
                onChange={(e) => update('scanSpeed', parseFloat(e.target.value))}
              />
            </div>
            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Scan Glow Intensity</span>
                <span className="tune-val num">{settings.scanGlow.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.05"
                value={settings.scanGlow}
                onChange={(e) => update('scanGlow', parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Section: Motion & Speed */}
          <div className="tune-group">
            <div className="tune-group-title num">MOTION & CHIP SPEED</div>
            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Easing Strength</span>
                <span className="tune-val num">{settings.easingStrength.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.5"
                step="0.05"
                value={settings.easingStrength}
                onChange={(e) => update('easingStrength', parseFloat(e.target.value))}
              />
            </div>

            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Chip Flight Speed</span>
                <span className="tune-val num">{settings.chipSpeed.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.1"
                value={settings.chipSpeed}
                onChange={(e) => update('chipSpeed', parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Section: Camera Perspective */}
          <div className="tune-group">
            <div className="tune-group-title num">CAMERA PERSPECTIVE</div>
            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Camera Distance</span>
                <span className="tune-val num">{settings.cameraDistance.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="2.0"
                max="10.0"
                step="0.1"
                value={settings.cameraDistance}
                onChange={(e) => update('cameraDistance', parseFloat(e.target.value))}
              />
            </div>

            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Camera Elevation Angle</span>
                <span className="tune-val num">{settings.cameraAngle.toFixed(0)}°</span>
              </div>
              <input
                type="range"
                min="20"
                max="85"
                step="1"
                value={settings.cameraAngle}
                onChange={(e) => update('cameraAngle', parseFloat(e.target.value))}
              />
            </div>

            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Camera Orbit Arc</span>
                <span className="tune-val num">{settings.cameraArc.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.05"
                value={settings.cameraArc}
                onChange={(e) => update('cameraArc', parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Section: 3D Point Size, Glow & Atmosphere */}
          <div className="tune-group">
            <div className="tune-group-title num">POINTS & ATMOSPHERE</div>
            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Point Size</span>
                <span className="tune-val num">{settings.pointSize.toFixed(0)}px</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="1"
                value={settings.pointSize}
                onChange={(e) => update('pointSize', parseFloat(e.target.value))}
              />
            </div>

            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Point Glow Intensity</span>
                <span className="tune-val num">{(settings.pointGlow * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={settings.pointGlow}
                onChange={(e) => update('pointGlow', parseFloat(e.target.value))}
              />
            </div>

            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Ambient Dust Motes</span>
                <span className="tune-val num">{settings.dustAmount} pts</span>
              </div>
              <input
                type="range"
                min="200"
                max="2500"
                step="50"
                value={settings.dustAmount}
                onChange={(e) => update('dustAmount', parseInt(e.target.value, 10))}
              />
            </div>

            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Flight Trail Length</span>
                <span className="tune-val num">{settings.trailLength.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={settings.trailLength}
                onChange={(e) => update('trailLength', parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Section: Match Beams */}
          <div className="tune-group">
            <div className="tune-group-title num">MATCH BEAMS</div>
            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Beam Thickness</span>
                <span className="tune-val num">{settings.beamThickness.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="6.0"
                step="0.5"
                value={settings.beamThickness}
                onChange={(e) => update('beamThickness', parseFloat(e.target.value))}
              />
            </div>

            <div className="tune-control-item">
              <div className="tune-label-row">
                <span>Beam Brightness</span>
                <span className="tune-val num">{(settings.beamBrightness * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.5"
                step="0.05"
                value={settings.beamBrightness}
                onChange={(e) => update('beamBrightness', parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Section: Colours */}
          <div className="tune-group">
            <div className="tune-group-title num">COLOURS</div>
            <div className="tune-color-grid">
              <label className="tune-color-item">
                <span className="tune-color-label">Proposal (A)</span>
                <div className="tune-color-input-wrap">
                  <input
                    type="color"
                    value={settings.colorA}
                    onChange={(e) => update('colorA', e.target.value)}
                  />
                  <span className="num">{settings.colorA}</span>
                </div>
              </label>

              <label className="tune-color-item">
                <span className="tune-color-label">Counterpart (B)</span>
                <div className="tune-color-input-wrap">
                  <input
                    type="color"
                    value={settings.colorB}
                    onChange={(e) => update('colorB', e.target.value)}
                  />
                  <span className="num">{settings.colorB}</span>
                </div>
              </label>

              <label className="tune-color-item">
                <span className="tune-color-label">Beam Arcs</span>
                <div className="tune-color-input-wrap">
                  <input
                    type="color"
                    value={settings.beamColor}
                    onChange={(e) => update('beamColor', e.target.value)}
                  />
                  <span className="num">{settings.beamColor}</span>
                </div>
              </label>

              <label className="tune-color-item">
                <span className="tune-color-label">Ground Grid</span>
                <div className="tune-color-input-wrap">
                  <input
                    type="color"
                    value={settings.gridColor}
                    onChange={(e) => update('gridColor', e.target.value)}
                  />
                  <span className="num">{settings.gridColor}</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
