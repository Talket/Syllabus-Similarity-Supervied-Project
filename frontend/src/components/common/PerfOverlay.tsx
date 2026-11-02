import React, { useEffect, useState, useRef } from 'react';

export interface PerfMetrics {
  fps: number;
  avgMs: number;
  p95Ms: number;
  worstMs: number;
  droppedFrames: number;
  sampleCount: number;
}

declare global {
  interface Window {
    __perfMetrics?: {
      get: () => PerfMetrics;
      reset: () => void;
      recordScroll: (durationMs?: number) => Promise<PerfMetrics>;
    };
  }
}

export const PerfOverlay: React.FC = () => {
  const [metrics, setMetrics] = useState<PerfMetrics>({
    fps: 60,
    avgMs: 16.6,
    p95Ms: 16.6,
    worstMs: 16.6,
    droppedFrames: 0,
    sampleCount: 0,
  });

  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(performance.now());
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Expose metrics retrieval on window for automated headless test scripts
    window.__perfMetrics = {
      get: () => {
        const samples = [...frameTimesRef.current];
        if (samples.length === 0) {
          return { fps: 60, avgMs: 16.6, p95Ms: 16.6, worstMs: 16.6, droppedFrames: 0, sampleCount: 0 };
        }
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        const sorted = [...samples].sort((a, b) => a - b);
        const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
        const p95 = sorted[p95Idx] || avg;
        const worst = sorted[sorted.length - 1] || avg;
        const dropped = samples.filter((d) => d > 33.33).length;
        const fps = Math.min(60, Math.round(1000 / (avg || 16.6)));
        return {
          fps,
          avgMs: parseFloat(avg.toFixed(2)),
          p95Ms: parseFloat(p95.toFixed(2)),
          worstMs: parseFloat(worst.toFixed(2)),
          droppedFrames: dropped,
          sampleCount: samples.length,
        };
      },
      reset: () => {
        frameTimesRef.current = [];
      },
      recordScroll: (durationMs: number = 4000) => {
        return new Promise<PerfMetrics>((resolve) => {
          frameTimesRef.current = [];
          const startTime = performance.now();
          const maxScroll = Math.max(1000, document.documentElement.scrollHeight - window.innerHeight);

          function scrollStep() {
            const now = performance.now();
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / durationMs);

            window.scrollTo(0, progress * maxScroll);

            if (progress < 1) {
              requestAnimationFrame(scrollStep);
            } else {
              // Wait 200ms to collect settling frames
              setTimeout(() => {
                resolve(window.__perfMetrics!.get());
              }, 200);
            }
          }
          requestAnimationFrame(scrollStep);
        });
      },
    };

    let frameCount = 0;

    const tick = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Ignore startup or tab switch outliers
      if (delta > 0 && delta < 250) {
        frameTimesRef.current.push(delta);
        if (frameTimesRef.current.length > 500) {
          frameTimesRef.current.shift();
        }
      }

      frameCount++;
      if (frameCount % 20 === 0 && frameTimesRef.current.length > 5) {
        const samples = frameTimesRef.current;
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        const sorted = [...samples].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(sorted.length * 0.95)] || avg;
        const worst = sorted[sorted.length - 1] || avg;
        const dropped = samples.filter((d) => d > 33.33).length;
        const fps = Math.min(60, Math.round(1000 / (avg || 16.6)));

        setMetrics({
          fps,
          avgMs: parseFloat(avg.toFixed(1)),
          p95Ms: parseFloat(p95.toFixed(1)),
          worstMs: parseFloat(worst.toFixed(1)),
          droppedFrames: dropped,
          sampleCount: samples.length,
        });
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  return (
    <div
      role="region"
      aria-label="Performance Metrics"
      className="perf-overlay-badge num"
    >
      <span className="perf-dot" />
      <span className="perf-val text-yellow">{metrics.fps} FPS</span>
      <span className="perf-sep">·</span>
      <span>Avg: <strong className="text-highlight">{metrics.avgMs}ms</strong></span>
      <span className="perf-sep">·</span>
      <span>p95: <strong className={metrics.p95Ms <= 18 ? 'text-cyan' : 'text-coral'}>{metrics.p95Ms}ms</strong></span>
      <span className="perf-target num">(&lt;18ms target)</span>
    </div>
  );
};

