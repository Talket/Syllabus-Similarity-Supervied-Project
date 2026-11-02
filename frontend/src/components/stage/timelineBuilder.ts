import gsap from 'gsap';
import { ComparePairResponse } from '../../types/api';
import { ThreeStageLayer } from './ThreeStageLayer';
import { SEAMS } from './seams';
import { TuneSettings } from '../../types/tune';

export interface StageRefs {
  heroGroup: HTMLElement | null;
  sheetA: HTMLElement | null;
  sheetB: HTMLElement | null;
  sheetABg: HTMLElement | null;
  sheetBBg: HTMLElement | null;
  scanBeam: HTMLElement | null;
  unitStripsA: (HTMLElement | null)[];
  unitStripsB: (HTMLElement | null)[];
  unitBodyA: (HTMLElement | null)[];
  unitBodyB: (HTMLElement | null)[];
  unitChipsContainersA: (HTMLElement | null)[];
  unitChipsContainersB: (HTMLElement | null)[];
  chips: (HTMLElement | null)[];
  persistentCounter: HTMLElement | null;
  counterNum: HTMLElement | null;
  counterPrefix: HTMLElement | null;
  counterSuffix: HTMLElement | null;
  matchLedger: HTMLElement | null;
  verdictOverlay: HTMLElement | null;
}

export function buildMasterTimeline(
  refs: StageRefs,
  threeLayer: ThreeStageLayer,
  data: ComparePairResponse,
  onSceneChange?: (sceneId: number) => void,
  tune?: TuneSettings,
  onHudVisibilityChange?: (hidden: boolean) => void
): gsap.core.Timeline {
  gsap.config({ force3D: 'auto' });

  const tl = gsap.timeline({
    paused: true,
    defaults: { ease: 'sine.inOut' },
  });

  const totalTopics = data.report.topics.total || 67;
  const newTopics = data.report.topics.new || 50;
  const coveredTopics = data.report.topics.covered || 17;
  const stageWidth = typeof window !== 'undefined' ? window.innerWidth : 1366;
  const stageHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

  // Hook scene boundary notifications for HUD (React state updated ONLY when label changes)
  let lastReportedScene = -1;
  let lastHudHidden = false;

  tl.eventCallback('onUpdate', () => {
    const p = tl.progress();
    let currentScene = 0;
    for (let i = SEAMS.length - 1; i >= 0; i--) {
      if (p >= SEAMS[i].start) {
        currentScene = SEAMS[i].id;
        break;
      }
    }
    if (currentScene !== lastReportedScene) {
      lastReportedScene = currentScene;
      onSceneChange?.(currentScene);
    }

    // Auto-hide HUD when entering dashboard transition (p >= 0.94)
    const isHidden = p >= 0.94;
    if (isHidden !== lastHudHidden) {
      lastHudHidden = isHidden;
      onHudVisibilityChange?.(isHidden);
    }

    // Drive continuous Three.js rendering during timeline scrub / playback
    threeLayer.renderAt(p, tl.time());
  });

  // --- INITIAL STAGE SETUP (t = 0) ---
  if (refs.heroGroup) gsap.set(refs.heroGroup, { opacity: 1, x: 0 });
  if (refs.sheetA) {
    // Hero pose: right of center, crisp tilt, fully opaque bright paper
    gsap.set(refs.sheetA, {
      xPercent: 48,
      rotateZ: -2.5,
      rotateX: 6,
      rotateY: -8,
      opacity: 1,
      scale: 1,
      transformPerspective: 1200,
    });
  }
  if (refs.sheetB) {
    // Hidden directly behind Sheet A (0 opacity)
    gsap.set(refs.sheetB, {
      xPercent: 48,
      rotateZ: 0,
      opacity: 0,
      scale: 0.98,
      transformPerspective: 1200,
    });
  }
  if (refs.scanBeam) gsap.set(refs.scanBeam, { opacity: 0, top: '-4%' });
  if (refs.persistentCounter) gsap.set(refs.persistentCounter, { opacity: 0, y: -20, x: 0, scale: 1 });
  if (refs.counterNum) {
    gsap.set(refs.counterNum, {
      fontSize: '1.35rem',
      color: '#ffd93d',
      fontFamily: 'var(--font-mono)',
      lineHeight: '1',
      textShadow: 'none',
    });
  }
  if (refs.counterPrefix) gsap.set(refs.counterPrefix, { opacity: 1, display: 'inline' });
  if (refs.counterSuffix) gsap.set(refs.counterSuffix, { opacity: 1, display: 'inline' });
  if (refs.matchLedger) gsap.set(refs.matchLedger, { x: 440, opacity: 0 });
  if (refs.verdictOverlay) gsap.set(refs.verdictOverlay, { opacity: 0, scale: 0.96 });

  // Unit body texts start visible; chips start collapsed & invisible
  refs.unitBodyA.forEach((el) => el && gsap.set(el, { opacity: 1, height: 'auto' }));
  refs.unitBodyB.forEach((el) => el && gsap.set(el, { opacity: 1, height: 'auto' }));
  refs.unitStripsA.forEach((el) => el && gsap.set(el, { maxHeight: 54 }));
  refs.unitStripsB.forEach((el) => el && gsap.set(el, { maxHeight: 54 }));
  refs.chips.forEach((el) => el && gsap.set(el, { opacity: 0, scale: 0.85 }));

  // --- TIME SEGMENT 1: HERO -> READ (t = 0 to 18) ---
  // NO DEAD ZONE: First notch immediately starts motion at t = 1.5
  // Hero text group glides left and fades out
  if (refs.heroGroup) {
    tl.to(
      refs.heroGroup,
      {
        x: -80,
        opacity: 0,
        duration: 4.5,
        ease: 'sine.inOut',
      },
      1.5
    );
  }

  // Sheet A glides from right to dead-center and straightens from tilt immediately
  if (refs.sheetA) {
    tl.to(
      refs.sheetA,
      {
        xPercent: 0,
        rotateZ: 0,
        rotateX: 0,
        rotateY: 0,
        duration: 6.0,
        ease: 'sine.inOut',
      },
      1.5
    );
  }

  // BLUE SCAN LINE: Sweeps from top of Sheet A all the way to very bottom (100% + beyond)
  // Scan runs from t = 4.0 to t = 16.5
  const scanSweepSpeed = tune?.scanSpeed || 1.0;
  const scanDuration = Math.max(8.0, 12.0 / scanSweepSpeed);

  if (refs.scanBeam) {
    tl.to(refs.scanBeam, { opacity: 1, duration: 1.0, ease: 'sine.out' }, 4.0)
      .to(refs.scanBeam, { top: '104%', duration: scanDuration, ease: 'none' }, 4.0)
      .to(refs.scanBeam, { opacity: 0, duration: 1.5, ease: 'sine.in' }, 4.0 + scanDuration);
  }

  // As scan passes each unit strip in Sheet A, that line flashes cyan and slightly lifts
  refs.unitStripsA.forEach((strip, idx) => {
    if (!strip) return;
    const stripPassTime = 4.5 + (idx / Math.max(1, refs.unitStripsA.length)) * scanDuration;
    tl.to(
      strip,
      {
        y: -3,
        borderColor: 'rgba(56, 189, 248, 0.9)',
        boxShadow: '0 4px 16px rgba(56, 189, 248, 0.35)',
        duration: 0.8,
        ease: 'power2.out',
      },
      stripPassTime
    ).to(
      strip,
      {
        y: 0,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        boxShadow: 'none',
        duration: 1.0,
        ease: 'power2.in',
      },
      stripPassTime + 0.8
    );
  });

  // --- TIME SEGMENT 2: READ -> SPLIT TWO COLUMNS (t = 18 to 36) ---
  // Sheets fan out to left (-52%) and right (+52%) columns
  if (refs.sheetA) {
    tl.to(
      refs.sheetA,
      {
        xPercent: -52,
        scale: 1,
        transformPerspective: 0,
        rotateZ: 0,
        rotateX: 0,
        rotateY: 0,
        duration: 8.0,
        ease: 'sine.inOut',
      },
      18
    );
  }
  if (refs.sheetB) {
    gsap.set(refs.sheetB, { xPercent: 0, opacity: 0, scale: 0.98 });
    tl.to(
      refs.sheetB,
      {
        xPercent: 52,
        opacity: 1,
        scale: 1,
        transformPerspective: 0,
        rotateZ: 0,
        rotateX: 0,
        rotateY: 0,
        duration: 8.0,
        ease: 'sine.inOut',
      },
      18
    );
  }

  // Paper card backgrounds stay bright, crisp and opaque during Split
  if (refs.sheetABg) {
    tl.to(refs.sheetABg, { opacity: 1.0, duration: 4.0, ease: 'sine.inOut' }, 20);
  }
  if (refs.sheetBBg) {
    tl.to(refs.sheetBBg, { opacity: 1.0, duration: 4.0, ease: 'sine.inOut' }, 20);
  }

  // Persistent Counter appears at top-left
  if (refs.persistentCounter) {
    tl.to(
      refs.persistentCounter,
      {
        opacity: 1,
        y: 0,
        duration: 4.0,
        ease: 'sine.out',
      },
      20
    );
  }

  // Unit strips tear off with slight rotation and settle, expanding to display topic chips
  refs.unitStripsA.forEach((strip, i) => {
    if (!strip) return;
    tl.fromTo(
      strip,
      { rotate: (i % 2 === 0 ? -1.5 : 1.5) },
      { rotate: 0, opacity: 1, maxHeight: 72, duration: 3.5, ease: 'sine.out' },
      20 + i * 0.35
    );
  });
  refs.unitStripsB.forEach((strip, i) => {
    if (!strip) return;
    tl.fromTo(
      strip,
      { rotate: (i % 2 === 0 ? 1.5 : -1.5) },
      { rotate: 0, opacity: 1, maxHeight: 72, duration: 3.5, ease: 'sine.out' },
      20 + i * 0.35
    );
  });

  // Cross-fade: unit body excerpt text collapses out as topic chips pop out with small overshoot
  refs.unitBodyA.forEach((body) => {
    if (body) tl.to(body, { opacity: 0, height: 0, marginTop: 0, marginBottom: 0, overflow: 'hidden', duration: 2.2, ease: 'sine.inOut' }, 21);
  });
  refs.unitBodyB.forEach((body) => {
    if (body) tl.to(body, { opacity: 0, height: 0, marginTop: 0, marginBottom: 0, overflow: 'hidden', duration: 2.2, ease: 'sine.inOut' }, 21);
  });

  // Topic chips pop out with small overshoot and glide into rows
  refs.chips.forEach((chip, i) => {
    if (!chip) return;
    const totalPoints = threeLayer.pointCount || refs.chips.length || 149;
    const chipEntrance = 21 + (i / totalPoints) * 4.5;
    tl.fromTo(
      chip,
      { opacity: 0, scale: 0.75 },
      {
        opacity: 1,
        scale: 1.0,
        duration: 2.0,
        ease: 'back.out(1.4)',
      },
      chipEntrance
    );
  });

  // Counter counts topics from 0 up to totalTopics (67)
  const counterObj = { count: 0 };
  tl.to(
    counterObj,
    {
      count: totalTopics,
      duration: 8.0,
      ease: 'none',
      onUpdate: () => {
        if (refs.counterNum) {
          refs.counterNum.textContent = String(Math.round(counterObj.count));
        }
      },
    },
    24
  );

  // Critical hand-off to Embed: Paper sheets fade out completely by t = 36 to reveal 3D canvas
  if (refs.sheetABg) tl.to(refs.sheetABg, { opacity: 0, duration: 3.5, ease: 'sine.inOut' }, 32);
  if (refs.sheetBBg) tl.to(refs.sheetBBg, { opacity: 0, duration: 3.5, ease: 'sine.inOut' }, 32);
  refs.unitStripsA.forEach((s) => s && tl.to(s, { borderBottomColor: 'transparent', borderLeftColor: 'transparent', duration: 2.5 }, 32));
  refs.unitStripsB.forEach((s) => s && tl.to(s, { borderBottomColor: 'transparent', borderLeftColor: 'transparent', duration: 2.5 }, 32));

  if (refs.sheetA) tl.to(refs.sheetA, { opacity: 0, duration: 3.0, ease: 'sine.inOut' }, 34);
  if (refs.sheetB) tl.to(refs.sheetB, { opacity: 0, duration: 3.0, ease: 'sine.inOut' }, 34);

  // --- TIME SEGMENT 3: SPLIT -> EMBED MEANING SPACE (t = 36 to 54) ---
  tl.call(
    () => {
      if (refs.counterPrefix) refs.counterPrefix.textContent = 'Vectors:';
      if (refs.counterSuffix) refs.counterSuffix.textContent = 'pts in meaning space';
    },
    undefined,
    38
  );

  // --- TIME SEGMENT 4: EMBED -> MATCH BEAMS & LEDGER (t = 54 to 80) ---
  // Ledger panel slides in from right with light paper chips
  if (refs.matchLedger) {
    tl.to(
      refs.matchLedger,
      {
        x: 0,
        opacity: 1,
        duration: 7.0,
        ease: 'sine.inOut',
      },
      54
    );
  }

  // Counter updates for Match
  tl.call(
    () => {
      if (refs.counterPrefix) refs.counterPrefix.textContent = 'Matched:';
      if (refs.counterSuffix) refs.counterSuffix.textContent = `of ${coveredTopics} pairs`;
    },
    undefined,
    56
  );

  const matchCounterObj = { count: 0 };
  tl.to(
    matchCounterObj,
    {
      count: coveredTopics,
      duration: 14.0,
      ease: 'none',
      onUpdate: () => {
        if (refs.counterNum) {
          refs.counterNum.textContent = String(Math.round(matchCounterObj.count));
        }
      },
    },
    56
  );

  // --- TIME SEGMENT 5: MATCH -> VERDICT COLLAPSE (t = 80 to 94) ---
  // Ledger slides out to right
  if (refs.matchLedger) {
    tl.to(
      refs.matchLedger,
      {
        x: 440,
        opacity: 0,
        duration: 5.0,
        ease: 'sine.inOut',
      },
      80
    );
  }

  // ONE Persistent Counter travels smoothly into Center Stage and transforms into the giant Verdict display
  if (refs.persistentCounter) {
    const targetX = stageWidth * 0.5 - stageWidth * 0.05;
    const targetY = stageHeight * 0.20 - 88;

    tl.to(
      refs.persistentCounter,
      {
        x: targetX,
        y: targetY,
        xPercent: -50,
        scale: 1.0,
        duration: 8.0,
        ease: 'sine.inOut',
      },
      80
    );
  }

  if (refs.counterPrefix) {
    tl.to(refs.counterPrefix, { opacity: 0, duration: 2.0, ease: 'sine.out' }, 80);
  }
  if (refs.counterSuffix) {
    tl.to(refs.counterSuffix, { opacity: 0, duration: 2.0, ease: 'sine.out' }, 80);
  }

  if (refs.counterNum) {
    tl.to(
      refs.counterNum,
      {
        fontSize: 'clamp(7.5rem, 20vw, 18rem)',
        color: '#ff6b6b',
        fontFamily: 'Fraunces, Georgia, serif',
        lineHeight: 0.85,
        textShadow: '0 0 50px rgba(255, 107, 107, 0.45)',
        duration: 8.0,
        ease: 'sine.inOut',
      },
      80
    );
  }

  tl.call(
    () => {
      if (refs.counterPrefix) refs.counterPrefix.textContent = '';
      if (refs.counterSuffix) refs.counterSuffix.textContent = '';
    },
    undefined,
    81
  );

  // Counter transitions smoothly to newTopics (50) with deceleration
  const verdictCounterObj = { count: coveredTopics };
  tl.to(
    verdictCounterObj,
    {
      count: newTopics,
      duration: 8.0,
      ease: 'power3.out',
      onUpdate: () => {
        if (refs.counterNum) {
          refs.counterNum.textContent = String(Math.round(verdictCounterObj.count));
        }
      },
    },
    81
  );

  // Verdict overlay card fades in underneath
  if (refs.verdictOverlay) {
    tl.to(
      refs.verdictOverlay,
      {
        opacity: 1,
        scale: 1,
        duration: 7.0,
        ease: 'sine.out',
      },
      83
    );
  }

  // --- TIME SEGMENT 6: HAND-OFF TO DASHBOARD (t = 94 to 100) ---
  if (refs.verdictOverlay) {
    tl.to(refs.verdictOverlay, { opacity: 0, duration: 4.0, ease: 'sine.in' }, 95);
  }
  if (refs.persistentCounter) {
    tl.to(refs.persistentCounter, { opacity: 0, scale: 0.8, duration: 4.0, ease: 'sine.in' }, 95);
  }

  // Anchor timeline duration to exactly 100.0
  tl.set({}, {}, 100);

  // --- CHIP FLIGHT TO 3D POINTS ---
  const totalPoints = threeLayer.pointCount || refs.chips.length || 149;

  // Measure exact resting positions of each chip in its live Split pose (t = 33.0)
  const origUpdate = tl.eventCallback('onUpdate');
  tl.eventCallback('onUpdate', null);
  tl.progress(0.33);

  const chipRestingCenters = refs.chips.map((chip) => {
    if (!chip) return { x: stageWidth * 0.5, y: stageHeight * 0.5 };
    const rect = chip.getBoundingClientRect();
    return {
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.5,
    };
  });

  tl.progress(0);
  tl.eventCallback('onUpdate', origUpdate);

  refs.chips.forEach((chip, i) => {
    if (!chip) return;
    const flyStart = 34.0 + (i / totalPoints) * 6.0;
    const proj = threeLayer.projectPointToScreen(i, stageWidth, stageHeight);
    const resting = chipRestingCenters[i] || { x: stageWidth * 0.5, y: stageHeight * 0.5 };
    const deltaX = proj.x - resting.x;
    const deltaY = proj.y - resting.y;

    const flightDur = tune ? Math.max(1.0, 3.8 / tune.chipSpeed) : 3.8;
    const easeType = tune && Math.abs(tune.easingStrength - 1.0) > 0.1
      ? gsap.parseEase(`power${Math.max(1, Math.min(4, Math.round(tune.easingStrength * 2)))}.inOut`)
      : 'sine.inOut';

    tl.to(
      chip,
      {
        x: deltaX,
        y: deltaY,
        scale: 0.14,
        duration: flightDur,
        ease: easeType,
        force3D: true,
      },
      flyStart
    ).to(
      chip,
      {
        opacity: 0,
        duration: 0.9,
        ease: 'none',
      },
      flyStart + flightDur
    );
  });

  return tl;
}
