import React, { useState } from 'react';

interface StrictnessSliderProps {
  currentStrictness: number; // e.g. 0.75
  baselineStrictness?: number; // threshold used for current API dataset
  onChangeLocal: (newStrictness: number) => void;
  onReRequestApi: (newStrictness: number) => Promise<void>;
  isLoading?: boolean;
}

export const StrictnessSlider: React.FC<StrictnessSliderProps> = ({
  currentStrictness,
  baselineStrictness = 0.75,
  onChangeLocal,
  onReRequestApi,
  isLoading = false,
}) => {
  const [val, setVal] = useState<number>(currentStrictness);
  const [isPendingApi, setIsPendingApi] = useState<boolean>(false);

  const presets = [
    { label: 'Relaxed', value: 0.65, desc: 'Wider semantic umbrella; matches looser topical analogies' },
    { label: 'Balanced', value: 0.75, desc: 'Standard production threshold calibrated for academic syllabi' },
    { label: 'Strict', value: 0.85, desc: 'High cosine precision; requires near-identical phrasing' },
  ];

  const handleSelectPreset = async (presetVal: number) => {
    setVal(presetVal);
    onChangeLocal(presetVal);
    try {
      setIsPendingApi(true);
      await onReRequestApi(presetVal);
    } catch (err) {
      console.error('Failed to recalibrate with new strictness', err);
    } finally {
      setIsPendingApi(false);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = parseFloat(e.target.value);
    setVal(newVal);
    onChangeLocal(newVal);
  };

  const handleRelease = async () => {
    try {
      setIsPendingApi(true);
      await onReRequestApi(val);
    } catch (err) {
      console.error('Failed to recalibrate with new strictness', err);
    } finally {
      setIsPendingApi(false);
    }
  };

  const isBusy = isLoading || isPendingApi;

  return (
    <div className="strictness-panel-card" aria-label="Topic Matching Strictness Calibration">
      <div className="strictness-header">
        <div className="strictness-header-left">
          <div className="scene-numbered-title">
            <span className="accent">(Calibration) 6.5</span> Semantic Matching Sensitivity
          </div>
          <h3 className="strictness-title">Topic Matching Strictness (t_phrase)</h3>
          <p className="strictness-callout-label">
            <strong>Recalculates topic overlap against the model.</strong> Moving this threshold sends the input units back to the NLP model to determine semantic topic alignment.
          </p>
        </div>

        <div className="strictness-val-badge num">
          <span className="val-number">{val.toFixed(2)}</span>
          <span className="val-state">
            {val < 0.70 ? (
              <span className="badge-warning">RELAXED</span>
            ) : val > 0.80 ? (
              <span className="badge-cyan">STRICT</span>
            ) : (
              <span className="badge-ok">BALANCED</span>
            )}
          </span>
        </div>
      </div>

      {/* Discrete Stops Buttons */}
      <div className="strictness-presets-row" role="radiogroup" aria-label="Strictness Presets">
        {presets.map((p) => {
          const isActive = Math.abs(val - p.value) < 0.02;
          return (
            <button
              key={p.label}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={isBusy}
              onClick={() => handleSelectPreset(p.value)}
              className={`preset-stop-btn ${isActive ? 'is-active' : ''}`}
            >
              <div className="preset-btn-top">
                <span className="preset-label">{p.label}</span>
                <span className="preset-val num">{p.value.toFixed(2)}</span>
              </div>
              <span className="preset-desc">{p.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Continuous Range Slider for Fine Adjustment */}
      <div className="slider-control-container">
        <div className="slider-track-wrap">
          <input
            type="range"
            min="0.55"
            max="0.95"
            step="0.01"
            value={val}
            onChange={handleSliderChange}
            onMouseUp={handleRelease}
            onTouchEnd={handleRelease}
            onKeyUp={handleRelease}
            className="strictness-range-input cursor-pointer"
            aria-label="Fine adjust topic matching threshold"
            disabled={isBusy}
          />
        </div>

        {/* Calibration Ticks */}
        <div className="slider-ticks-row num">
          <div className="slider-tick">
            <span className="tick-line" />
            <span className="tick-val">0.55</span>
            <span className="tick-label">Permissive</span>
          </div>
          <div className="slider-tick tick-anchor">
            <span className="tick-line" />
            <span className="tick-val">0.65</span>
            <span className="tick-label">Relaxed</span>
          </div>
          <div className="slider-tick tick-anchor tick-default">
            <span className="tick-line" />
            <span className="tick-val">0.75</span>
            <span className="tick-label">Balanced (Default)</span>
          </div>
          <div className="slider-tick tick-anchor">
            <span className="tick-line" />
            <span className="tick-val">0.85</span>
            <span className="tick-label">Strict</span>
          </div>
          <div className="slider-tick">
            <span className="tick-line" />
            <span className="tick-val">0.95</span>
            <span className="tick-label">Exact</span>
          </div>
        </div>
      </div>

      <div className="strictness-footer">
        <div className="strictness-status-info num">
          {isBusy ? (
            <div className="slider-loading-state">
              <span className="spinner-dot" />
              <span className="text-yellow">Recalculating topic overlap against the model with t_phrase = {val.toFixed(2)}...</span>
            </div>
          ) : (
            <span className="text-dim">
              Threshold defines the cosine cutoff between proposal and reference topic vectors.
            </span>
          )}
        </div>

        {Math.abs(val - 0.75) > 0.01 && (
          <button
            type="button"
            className="strictness-reset-btn num cursor-pointer"
            onClick={() => handleSelectPreset(0.75)}
            disabled={isBusy}
          >
            Reset to 0.75
          </button>
        )}
      </div>
    </div>
  );
};
