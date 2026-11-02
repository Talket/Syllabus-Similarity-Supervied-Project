export interface SeekStepRecord {
  step: number;
  p: number;
  element: string;
  posDelta: number;
  opacityDelta: number;
}

export interface AcceptanceTestReport {
  seekTest: {
    passed: boolean;
    samples: number;
    maxPosDelta: number;
    maxOpacityDelta: number;
    worstPosOffender: string;
    worstOpacityOffender: string;
    failures: SeekStepRecord[];
  };
  domNodeStabilityTest: {
    passed: boolean;
    countAtP0: number;
    countAtP50: number;
    countAtP100: number;
  };
  perfMetrics?: {
    fps: number;
    avgMs: number;
    p95Ms: number;
    worstMs: number;
    droppedFrames: number;
    sampleCount: number;
  };
}

export async function runAcceptanceTests(): Promise<AcceptanceTestReport> {
  const stage = (window as any).__stage;
  if (!stage || !stage.seek) {
    throw new Error('Stage seek interface not available on window.__stage');
  }

  // 1. DOM Node Count Stability Test
  stage.seek(0.0);
  const countAtP0 = document.querySelectorAll('*').length;

  stage.seek(0.5);
  const countAtP50 = document.querySelectorAll('*').length;

  stage.seek(1.0);
  const countAtP100 = document.querySelectorAll('*').length;

  const domPassed = countAtP0 === countAtP50 && countAtP50 === countAtP100;

  // 2. 600-step Seek Test across shared actors
  const trackedSelectors = [
    { name: 'Sheet A', selector: '.stage-sheet-a' },
    { name: 'Sheet B', selector: '.stage-sheet-b' },
    { name: 'Hero Group', selector: '.stage-hero-group' },
    { name: 'Persistent Counter', selector: '.stage-persistent-counter' },
    { name: 'Match Ledger', selector: '.stage-match-ledger' },
    { name: 'Verdict Overlay', selector: '.stage-verdict-overlay' },
    { name: 'Unit Strip A0', selector: '.stage-unit-strip-a' },
    { name: 'Unit Strip B0', selector: '.stage-unit-strip-b' },
  ];

  const steps = 600;
  let maxPosDelta = 0;
  let maxOpacityDelta = 0;
  let worstPosOffender = 'none';
  let worstOpacityOffender = 'none';
  const failures: SeekStepRecord[] = [];

  // Track previous positions
  let prevStates: Record<string, { x: number; y: number; opacity: number }> = {};

  // Sample p from 0 to 1
  for (let s = 0; s <= steps; s++) {
    const p = s / steps;
    stage.seek(p);

    trackedSelectors.forEach(({ name, selector }) => {
      const el = document.querySelector(selector) as HTMLElement;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const opacity = parseFloat(style.opacity) || 0;
      const x = rect.left;
      const y = rect.top;

      if (prevStates[name]) {
        const prev = prevStates[name];
        const dx = x - prev.x;
        const dy = y - prev.y;
        const posDelta = Math.sqrt(dx * dx + dy * dy);
        const opacityDelta = Math.abs(opacity - prev.opacity);

        if (posDelta > maxPosDelta) {
          maxPosDelta = posDelta;
          worstPosOffender = `${name} at p=${p.toFixed(4)} (jump: ${posDelta.toFixed(1)}px)`;
        }

        if (opacityDelta > maxOpacityDelta) {
          maxOpacityDelta = opacityDelta;
          worstOpacityOffender = `${name} at p=${p.toFixed(4)} (delta: ${opacityDelta.toFixed(3)})`;
        }

        // Tightened thresholds: limit of 40 px per step and 0.20 opacity
        if (posDelta > 40 || opacityDelta > 0.20) {
          failures.push({
            step: s,
            p: parseFloat(p.toFixed(4)),
            element: name,
            posDelta: parseFloat(posDelta.toFixed(1)),
            opacityDelta: parseFloat(opacityDelta.toFixed(3)),
          });
        }
      }

      prevStates[name] = { x, y, opacity };
    });
  }

  // Return to initial pose
  stage.seek(0.0);

  const seekPassed = failures.length === 0;

  return {
    seekTest: {
      passed: seekPassed,
      samples: steps,
      maxPosDelta: parseFloat(maxPosDelta.toFixed(1)),
      maxOpacityDelta: parseFloat(maxOpacityDelta.toFixed(3)),
      worstPosOffender,
      worstOpacityOffender,
      failures,
    },
    domNodeStabilityTest: {
      passed: domPassed,
      countAtP0,
      countAtP50,
      countAtP100,
    },
  };
}

export function runScrollBenchmark(): Promise<{
  avgMs: number;
  p95Ms: number;
  worstMs: number;
  droppedFrames: number;
  fps: number;
  samples: number;
}> {
  return new Promise((resolve) => {
    const frameTimes: number[] = [];
    let lastTime = performance.now();
    const durationMs = 4500; // Realistic 4.5s scroll session across full story
    const maxScroll = Math.max(1000, document.documentElement.scrollHeight - window.innerHeight);
    const startTime = performance.now();

    function step() {
      const now = performance.now();
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      const delta = now - lastTime;
      lastTime = now;
      if (delta > 0 && delta < 250) {
        frameTimes.push(delta);
      }

      // Smooth scroll progression mimicking natural mouse wheel scrub
      window.scrollTo(0, progress * maxScroll);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        const avg = frameTimes.reduce((a, b) => a + b, 0) / (frameTimes.length || 1);
        const sorted = [...frameTimes].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(sorted.length * 0.95)] || avg;
        const worst = sorted[sorted.length - 1] || avg;
        const dropped = frameTimes.filter((d) => d > 33.33).length; // Dropped frames under 30fps
        const fps = Math.min(60, Math.round(1000 / (avg || 16.6)));
        const res = {
          avgMs: parseFloat(avg.toFixed(2)),
          p95Ms: parseFloat(p95.toFixed(2)),
          worstMs: parseFloat(worst.toFixed(2)),
          droppedFrames: dropped,
          fps,
          samples: frameTimes.length,
        };
        resolve(res);
      }
    }

    requestAnimationFrame(step);
  });
}

// Automatically expose on window
if (typeof window !== 'undefined') {
  (window as any).__runAcceptanceTests = runAcceptanceTests;
  (window as any).__runScrollBenchmark = runScrollBenchmark;

  // Auto-execute if requested via URL
  const params = new URLSearchParams(window.location.search);
  if (params.get('test') === '1') {
    setTimeout(() => {
      runAcceptanceTests()
        .then((report) => {
          console.log('ACCEPTANCE_TEST_REPORT:' + JSON.stringify(report));
        })
        .catch((err) => {
          console.error('ACCEPTANCE_TEST_ERROR:', err);
        });
    }, 600);
  }

  if (params.get('benchmark') === 'scroll') {
    setTimeout(() => {
      runScrollBenchmark()
        .then((bench) => {
          console.log('SCROLL_BENCHMARK_REPORT:' + JSON.stringify(bench));
        })
        .catch((err) => {
          console.error('SCROLL_BENCHMARK_ERROR:', err);
        });
    }, 800);
  }
}
