import React, { useEffect, useRef, useState, useMemo } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ComparePairResponse, TopicItem, VizPoint } from '../../types/api';
import { SceneHUD } from '../hud/SceneHUD';
import { ThreeStageLayer } from './ThreeStageLayer';
import { buildMasterTimeline, StageRefs } from './timelineBuilder';
import { SEAMS, getMasterProgress, TOTAL_SCROLL_VH } from './seams';
import { TuneSettings } from '../../types/tune';
import { IconUpload, IconArrowDown } from '../common/Icons';
import { PerfOverlay } from '../common/PerfOverlay';
import './testRunner';

gsap.registerPlugin(ScrollTrigger);

declare global {
  interface Window {
    __stage?: {
      seek: (p: number) => void;
      timeline: gsap.core.Timeline | null;
      three: ThreeStageLayer | null;
      getPointScreenPos: (i: number) => { x: number; y: number };
      getPointAlpha: (i: number) => number;
      totalPoints: number;
      chipsCount: number;
      getChipCenter: (i: number) => { x: number; y: number };
    };
  }
}

export interface StageProps {
  data: ComparePairResponse;
  onFinishAnimation?: () => void;
  onOpenUpload?: () => void;
  mode?: 'scroll' | 'timeline' | 'presenter';
  isDataReady?: boolean;
  onExitPresenter?: () => void;
  debugScene?: number | null;
  debugProgress?: number;
  tuneSettings?: TuneSettings;
  isLibraryMode?: boolean;
}

export const Stage: React.FC<StageProps> = ({
  data,
  onFinishAnimation,
  onOpenUpload,
  mode = 'scroll',
  isDataReady = true,
  onExitPresenter,
  debugScene,
  debugProgress,
  tuneSettings,
  isLibraryMode = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const webglContainerRef = useRef<HTMLDivElement>(null);
  const masterTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const threeLayerRef = useRef<ThreeStageLayer | null>(null);

  // DOM Actor Element Refs (every moving actor exists persistently)
  const heroGroupRef = useRef<HTMLDivElement>(null);
  const sheetARef = useRef<HTMLDivElement>(null);
  const sheetBRef = useRef<HTMLDivElement>(null);
  const sheetABgRef = useRef<HTMLDivElement>(null);
  const sheetBBgRef = useRef<HTMLDivElement>(null);
  const scanBeamRef = useRef<HTMLDivElement>(null);
  const unitStripsARef = useRef<(HTMLDivElement | null)[]>([]);
  const unitStripsBRef = useRef<(HTMLDivElement | null)[]>([]);
  const unitBodyARef = useRef<(HTMLParagraphElement | null)[]>([]);
  const unitBodyBRef = useRef<(HTMLParagraphElement | null)[]>([]);
  const unitChipsContainersARef = useRef<(HTMLDivElement | null)[]>([]);
  const unitChipsContainersBRef = useRef<(HTMLDivElement | null)[]>([]);
  const chipsRef = useRef<(HTMLDivElement | null)[]>([]);
  const persistentCounterRef = useRef<HTMLDivElement>(null);
  const counterNumRef = useRef<HTMLSpanElement>(null);
  const counterPrefixRef = useRef<HTMLSpanElement>(null);
  const counterSuffixRef = useRef<HTMLSpanElement>(null);
  const matchLedgerRef = useRef<HTMLDivElement>(null);
  const verdictOverlayRef = useRef<HTMLDivElement>(null);
  const pointTooltipRef = useRef<HTMLDivElement>(null);

  // React state is ONLY used for HUD scene label and auto-hide
  const isDebug = debugScene !== undefined && debugScene !== null;
  const initialHudScene = isDebug ? debugScene : 0;
  const [activeHudScene, setActiveHudScene] = useState<number>(initialHudScene);
  const [isHudHidden, setIsHudHidden] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const presenterProgressFillRef = useRef<HTMLDivElement>(null);

  // Check ?perf=1 parameter
  const showPerf = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('perf') === '1';
  }, []);

  const unitsA = data.parsed.a?.units || [];
  const unitsB = data.parsed.b?.units || [];
  const matchedTopics = data.report.topics.items.filter((t) => t.covered);

  // Group Document A topics by unit
  const topicsAByUnit = useMemo(() => {
    const map: Record<number, TopicItem[]> = {};
    unitsA.forEach((u) => {
      map[u.order] = data.report.topics.items.filter((t) => t.unit === u.order);
    });
    return map;
  }, [unitsA, data.report.topics.items]);

  // Group Document B topics from viz.points by unit
  const topicsBByUnit = useMemo(() => {
    const map: Record<number, VizPoint[]> = {};
    unitsB.forEach((u) => {
      map[u.order] = (data.viz?.points || []).filter((p) => p.side === 'B' && p.unit === u.order);
    });
    return map;
  }, [unitsB, data.viz?.points]);

  // Total topics list for chips mapping
  const allTopicChips = useMemo(() => {
    const list: { side: 'A' | 'B'; unit: number; text: string; id: number }[] = [];
    unitsA.forEach((u) => {
      (topicsAByUnit[u.order] || []).forEach((t) => {
        list.push({ side: 'A', unit: u.order, text: t.topic, id: list.length });
      });
    });
    unitsB.forEach((u) => {
      (topicsBByUnit[u.order] || []).forEach((p) => {
        list.push({ side: 'B', unit: u.order, text: p.text, id: list.length });
      });
    });
    return list;
  }, [unitsA, unitsB, topicsAByUnit, topicsBByUnit]);

  // --- INITIALIZE STAGE (MOUNTED ONCE) ---
  useEffect(() => {
    const container = webglContainerRef.current;
    if (!container) return;

    // 1. Create ONE Three.js layer (mounted once, never unmounted)
    const threeLayer = new ThreeStageLayer();
    threeLayer.init(container, data);
    threeLayerRef.current = threeLayer;

    // 2. Build ONE Master Timeline from DOM refs
    const stageRefs: StageRefs = {
      heroGroup: heroGroupRef.current,
      sheetA: sheetARef.current,
      sheetB: sheetBRef.current,
      sheetABg: sheetABgRef.current,
      sheetBBg: sheetBBgRef.current,
      scanBeam: scanBeamRef.current,
      unitStripsA: unitStripsARef.current,
      unitStripsB: unitStripsBRef.current,
      unitBodyA: unitBodyARef.current,
      unitBodyB: unitBodyBRef.current,
      unitChipsContainersA: unitChipsContainersARef.current,
      unitChipsContainersB: unitChipsContainersBRef.current,
      chips: chipsRef.current,
      persistentCounter: persistentCounterRef.current,
      counterNum: counterNumRef.current,
      counterPrefix: counterPrefixRef.current,
      counterSuffix: counterSuffixRef.current,
      matchLedger: matchLedgerRef.current,
      verdictOverlay: verdictOverlayRef.current,
    };

    const buildTimeline = () => {
      if (masterTimelineRef.current) {
        masterTimelineRef.current.kill();
      }
      const newTl = buildMasterTimeline(
        stageRefs,
        threeLayer,
        data,
        (sceneId) => {
          setActiveHudScene(sceneId);
        },
        tuneSettings,
        (hidden) => {
          setIsHudHidden(hidden);
        }
      );
      masterTimelineRef.current = newTl;
      if (window.__stage) {
        window.__stage.timeline = newTl;
      }
      return newTl;
    };

    let tl = buildTimeline();

    // 3. Point Cloud Hover Feedback via Raycasting (pure ref, zero React state per frame)
    const viewport = viewportRef.current;
    const handlePointerMove = (e: PointerEvent) => {
      const three = threeLayerRef.current;
      const tip = pointTooltipRef.current;
      if (!three || !tip || !viewport) return;
      const rect = viewport.getBoundingClientRect();
      const pt = three.raycastPoint(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
      if (pt) {
        tip.style.display = 'block';
        tip.style.left = `${e.clientX - rect.left}px`;
        tip.style.top = `${e.clientY - rect.top}px`;
        tip.textContent = `${pt.side === 'A' ? 'Proposal' : 'Comparison'} U0${pt.unit}: ${pt.text}`;
      } else {
        tip.style.display = 'none';
      }
    };
    if (viewport) {
      viewport.addEventListener('pointermove', handlePointerMove, { passive: true });
    }

    // 4. Expose window.__stage for inspection and automated tests
    window.__stage = {
      seek: (p: number) => {
        const clampedP = Math.min(1, Math.max(0, p));
        const activeTl = masterTimelineRef.current || tl;
        activeTl.progress(clampedP);
        threeLayer.renderAt(clampedP, activeTl.time());
      },
      timeline: masterTimelineRef.current || tl,
      three: threeLayer,
      getPointScreenPos: (i: number) => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        return threeLayer.getPointScreenPos(i, w, h);
      },
      getPointAlpha: (i: number) => {
        return threeLayer.getPointAlpha(i);
      },
      totalPoints: data.viz?.points?.length || 0,
      chipsCount: chipsRef.current.length,
      getChipCenter: (i: number) => {
        const chip = chipsRef.current[i];
        if (!chip) return { x: 0, y: 0 };
        const rect = chip.getBoundingClientRect();
        return { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 };
      },
    };

    // 5. Handle Debug Mode Frame Freeze (?scene=X&p=Y)
    if (isDebug) {
      const targetP = getMasterProgress(debugScene!, debugProgress ?? 0.5);
      tl.progress(targetP);
      threeLayer.renderAt(targetP, tl.time());
      return () => {
        if (viewport) viewport.removeEventListener('pointermove', handlePointerMove);
        if (masterTimelineRef.current) masterTimelineRef.current.kill();
        threeLayer.dispose();
      };
    }

    // 6. Scroll Mode Driver: ScrollTrigger pins viewport across TOTAL_SCROLL_VH
    if (mode === 'scroll') {
      const track = trackRef.current;
      if (!track || !viewport) return;

      const trigger = ScrollTrigger.create({
        trigger: track,
        pin: viewport,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => {
          const p = self.progress;
          const activeTl = masterTimelineRef.current || tl;
          activeTl.progress(p);
          threeLayer.renderAt(p, activeTl.time());
          if (presenterProgressFillRef.current) {
            presenterProgressFillRef.current.style.width = `${(p * 100).toFixed(1)}%`;
          }
        },
      });

      return () => {
        if (viewport) viewport.removeEventListener('pointermove', handlePointerMove);
        trigger.kill();
        if (masterTimelineRef.current) masterTimelineRef.current.kill();
        threeLayer.dispose();
        delete window.__stage;
      };
    }

    // 7. Timeline / Presenter Mode Driver: Play smoothly over time
    if (mode === 'timeline' || mode === 'presenter') {
      const duration = mode === 'presenter' ? 55 : 20;
      const origUpdate = tl.eventCallback('onUpdate');
      tl.eventCallback('onUpdate', () => {
        origUpdate?.();
        const p = tl.progress();
        threeLayer.renderAt(p, tl.time());
        if (presenterProgressFillRef.current) {
          presenterProgressFillRef.current.style.width = `${(p * 100).toFixed(1)}%`;
        }
      });
      tl.eventCallback('onComplete', () => {
        onFinishAnimation?.();
      });
      tl.timeScale(tl.duration() / duration);
      // Skip past hero (0..0.04) directly into the Read scan of the uploaded document
      const startP = mode === 'presenter' ? 0.0 : 0.04;
      tl.progress(startP);
      tl.play();

      const handleKey = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          e.preventDefault();
          if (tl.paused()) {
            tl.resume();
            setIsPaused(false);
          } else {
            tl.pause();
            setIsPaused(true);
          }
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          tl.time(Math.min(tl.duration(), tl.time() + 4));
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          tl.time(Math.max(0, tl.time() - 4));
        } else if (e.code === 'Escape') {
          e.preventDefault();
          tl.kill();
          onExitPresenter?.();
        }
      };

      window.addEventListener('keydown', handleKey);

      return () => {
        if (viewport) viewport.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('keydown', handleKey);
        tl.kill();
        threeLayer.dispose();
        delete window.__stage;
      };
    }
  }, [data, mode, isDebug, debugScene, debugProgress, onExitPresenter, tuneSettings]);

  // Live Three.js Shader/Camera/Color parameter updates without rebuilding timeline
  useEffect(() => {
    if (threeLayerRef.current && tuneSettings) {
      threeLayerRef.current.updateTuneSettings(tuneSettings);
    }
  }, [tuneSettings]);

  const handleSkipToDashboard = () => {
    if (masterTimelineRef.current) {
      masterTimelineRef.current.progress(1);
    }
    const dashboard = document.getElementById('results-dashboard');
    if (dashboard) {
      const targetTop = dashboard.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: targetTop, behavior: 'instant' });
    }
    onFinishAnimation?.();
  };

  const handleWatchHowItWorks = () => {
    window.scrollBy({ top: window.innerHeight * 1.5, behavior: 'smooth' });
  };

  // Memoize persistent Stage DOM
  const stageViewportDOM = useMemo(() => {
    return (
      <div
        className={isDebug ? 'stage-debug-track' : 'stage-track'}
        ref={trackRef}
        style={{ height: isDebug ? '100vh' : `${TOTAL_SCROLL_VH}vh` }}
      >
        <div className="stage-viewport" ref={viewportRef}>
          {/* Layer 1: Persistent Three.js WebGL Canvas Layer (Mounted Once) */}
          <div className="stage-webgl-layer" ref={webglContainerRef} aria-hidden="true" />

          {/* Interactive Raycast Hover Tooltip */}
          <div className="stage-point-tooltip" ref={pointTooltipRef} aria-hidden="true" />

          {/* Layer 2: Persistent DOM Elements */}
          <div className="stage-dom-layer">
            {/* ONE Persistent Counter Element (Travels from Split -> Match -> Verdict) */}
            <div className="stage-persistent-counter" ref={persistentCounterRef}>
              <span className="counter-prefix" ref={counterPrefixRef}>Units & Topics:</span>
              <span className="counter-number num tabular" ref={counterNumRef}>0</span>
              <span className="counter-suffix" ref={counterSuffixRef}>/ {data.report.topics.total}</span>
            </div>

            {/* --- HERO TEXT GROUP (Left Column in Hero) --- */}
            <div className="stage-hero-group" ref={heroGroupRef}>
              <h1 className="hero-headline">
                <span className="hero-line-inner">Find what is</span>
                <br />
                <span className="hero-marker-phrase">
                  <span className="hero-marker-text">actually new.</span>
                </span>
              </h1>

              <p className="hero-subtext">
                A fine-tuned language model reads two course syllabi, projects topic phrases into
                semantic meaning-space, and isolates what the proposal truly adds that no existing
                curriculum covers.
              </p>

              <div className="hero-actions">
                {onOpenUpload && (
                  <button
                    type="button"
                    className="hero-primary-btn cursor-pointer"
                    onClick={onOpenUpload}
                  >
                    <span>Compare two syllabi</span>
                    <IconUpload size={17} />
                  </button>
                )}

                <button
                  type="button"
                  className="hero-secondary-btn cursor-pointer"
                  onClick={handleWatchHowItWorks}
                >
                  <span>Watch how it works</span>
                  <IconArrowDown size={17} />
                </button>
              </div>

              <div className="hero-scroll-cue num">
                <span className="scroll-cue-dot" />
                <span>SCROLL TO SCRUB THE MODEL'S WORK</span>
              </div>
            </div>

            {/* --- PERSISTENT SHEET A (Proposal Document) --- */}
            <div className="stage-sheet-ambient-bob">
              <div className="stage-sheet stage-sheet-a" ref={sheetARef}>
                <div className="sheet-paper-bg" ref={sheetABgRef} />
                <div className="sheet-paper-sheen" aria-hidden="true" />

                {/* THE BLUE SCAN BEAM: Full-height traversal with trailing glow and after-image */}
                <div className="scan-beam" ref={scanBeamRef} aria-hidden="true">
                  <div className="scan-beam-line" />
                  <div className="scan-beam-glow" />
                  <div className="scan-beam-trail" />
                </div>

                <div className="sheet-header">
                  <span className="sheet-badge num">
                    {isLibraryMode ? 'UPLOADED SYLLABUS · PROPOSAL' : 'SYLLABUS A · PROPOSAL'}
                  </span>
                  <span className="sheet-code num">{data.parsed.a?.code || 'NPTEL_INT395'}</span>
                </div>

                <h2 className="sheet-title">{data.parsed.a?.title || 'Introduction to Machine Learning'}</h2>
                <div className="sheet-divider" />

                {/* The persistent Unit Strips of Document A */}
                <div className="sheet-units-stack">
                  {unitsA.map((unit, uIdx) => {
                    const unitTopics = topicsAByUnit[unit.order] || [];
                    const displayTopics = unitTopics.slice(0, 3);
                    const overflowCount = Math.max(0, unitTopics.length - 3);

                    return (
                      <div
                        key={`strip-a-${unit.order}`}
                        className="stage-unit-strip stage-unit-strip-a"
                        ref={(el) => (unitStripsARef.current[uIdx] = el)}
                      >
                        <div className="unit-strip-header">
                          <span className="unit-order num">Unit 0{unit.order}</span>
                          <h4 className="unit-title">{unit.title}</h4>
                        </div>

                        {/* Excerpt text cross-fades to topic chips */}
                        <p
                          className="unit-body-text"
                          ref={(el) => (unitBodyARef.current[uIdx] = el)}
                        >
                          {unit.text.slice(0, 90)}...
                        </p>

                        {/* Topic chips container inside strip */}
                        <div
                          className="unit-chips-container"
                          ref={(el) => (unitChipsContainersARef.current[uIdx] = el)}
                        >
                          {unitTopics.map((t, cIdx) => {
                            const chipGlobalIdx = allTopicChips.findIndex(
                              (c) => c.side === 'A' && c.unit === unit.order && c.text === t.topic
                            );
                            const isHiddenInCard = cIdx >= 3;
                            return (
                              <div
                                key={`chip-a-${unit.order}-${cIdx}`}
                                className={`stage-topic-chip chip-cyan ${isHiddenInCard ? 'chip-clip-safety' : ''}`}
                                ref={(el) => {
                                  if (chipGlobalIdx !== -1) chipsRef.current[chipGlobalIdx] = el;
                                }}
                              >
                                <span className="chip-unit num">U{t.unit}</span>
                                <span className="chip-label">{t.topic}</span>
                              </div>
                            );
                          })}
                          {overflowCount > 0 && (
                            <div className="stage-topic-chip chip-more num" aria-hidden="true">
                              +{overflowCount} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="sheet-footer num">
                  <span>{unitsA.length} UNITS DETECTED</span>
                  <span>FORMAT: {data.parsed.a?.format?.toUpperCase() || 'UNIT'}</span>
                </div>
              </div>
            </div>

            {/* --- PERSISTENT SHEET B (Comparison Document OR Topic Matrix) --- */}
            <div className="stage-sheet-ambient-bob">
              <div
                className={`stage-sheet stage-sheet-b ${isLibraryMode ? 'is-topics-board' : ''}`}
                ref={sheetBRef}
              >
                <div className="sheet-paper-bg" ref={sheetBBgRef} />
                <div className="sheet-paper-sheen" aria-hidden="true" />

                <div className="sheet-header">
                  <span className={`sheet-badge ${isLibraryMode ? 'sheet-badge-topics' : 'sheet-badge-b'} num`}>
                    {isLibraryMode ? 'REFERENCE TOPICS · KNOWLEDGE BASE' : 'SYLLABUS B · COMPARISON'}
                  </span>
                  <span className="sheet-code num">
                    {isLibraryMode ? '90 COURSES BENCHMARK' : (data.parsed.b?.code || '')}
                  </span>
                </div>

                <h2 className="sheet-title">
                  {isLibraryMode ? 'Curriculum Reference Topics' : (data.parsed.b?.title || 'Reference Syllabus')}
                </h2>
                {isLibraryMode && (
                  <p className="topics-board-meta num">
                    Semantic benchmark clusters across academic curriculum corpus
                  </p>
                )}
                <div className="sheet-divider" />

                {/* The persistent Unit Strips / Topic Clusters of Document B */}
                <div className="sheet-units-stack">
                  {unitsB.map((unit, uIdx) => {
                    const unitTopicsB = topicsBByUnit[unit.order] || [];
                    const overflowCountB = Math.max(0, unitTopicsB.length - 3);

                    return (
                      <div
                        key={`strip-b-${unit.order}`}
                        className="stage-unit-strip stage-unit-strip-b"
                        ref={(el) => (unitStripsBRef.current[uIdx] = el)}
                      >
                        <div className="unit-strip-header">
                          <span className="unit-order num">
                            {isLibraryMode ? `Cluster 0${unit.order}` : `Unit 0${unit.order}`}
                          </span>
                          <h4 className="unit-title">{unit.title}</h4>
                        </div>

                        <p
                          className="unit-body-text"
                          ref={(el) => (unitBodyBRef.current[uIdx] = el)}
                        >
                          {isLibraryMode
                            ? `Indexed: ${unitTopicsB.map((pt) => pt.text).slice(0, 3).join(' • ')}`
                            : `${unit.text.slice(0, 90)}...`}
                        </p>

                        <div
                          className="unit-chips-container"
                          ref={(el) => (unitChipsContainersBRef.current[uIdx] = el)}
                        >
                          {unitTopicsB.map((pt, cIdx) => {
                            const chipGlobalIdx = allTopicChips.findIndex(
                              (c) => c.side === 'B' && c.unit === unit.order && c.text === pt.text
                            );
                            const isHiddenInCard = cIdx >= 3;
                            return (
                              <div
                                key={`chip-b-${unit.order}-${cIdx}`}
                                className={`stage-topic-chip chip-violet ${isHiddenInCard ? 'chip-clip-safety' : ''}`}
                                ref={(el) => {
                                  if (chipGlobalIdx !== -1) chipsRef.current[chipGlobalIdx] = el;
                                }}
                              >
                                <span className="chip-unit num">
                                  {isLibraryMode ? `C${pt.unit}` : `U${pt.unit}`}
                                </span>
                                <span className="chip-label">{pt.text}</span>
                              </div>
                            );
                          })}
                          {overflowCountB > 0 && (
                            <div className="stage-topic-chip chip-more chip-more-violet num" aria-hidden="true">
                              +{overflowCountB} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="sheet-footer num">
                  <span>
                    {isLibraryMode
                      ? `${allTopicChips.filter((c) => c.side === 'B').length || unitsB.length * 4} BENCHMARK TOPICS`
                      : `${unitsB.length} UNITS DETECTED`}
                  </span>
                  <span>
                    {isLibraryMode
                      ? 'CORPUS: CS / AI CURRICULUM'
                      : `FORMAT: ${data.parsed.b?.format?.toUpperCase() || 'UNIT'}`}
                  </span>
                </div>
              </div>
            </div>

            {/* --- MATCH LEDGER PANEL (Slides in from Right in Scene 4) --- */}
            <aside className="stage-match-ledger" ref={matchLedgerRef} aria-label="Matched Topics Ledger">
              <div className="match-ledger-header">
                <span className="match-ledger-title">Matched Topics Ledger</span>
                <span className="match-ledger-count num">{matchedTopics.length} pairs</span>
              </div>
              <div className="match-ledger-scroll">
                <ol className="match-ledger-list">
                  {matchedTopics.map((t, idx) => (
                    <li key={`ledger-${t.unit}-${t.topic}-${idx}`} className="match-ledger-item light-paper-card">
                      <div className="ledger-item-meta num">
                        <span className="ledger-unit">Unit 0{t.unit}</span>
                        <span className="ledger-score text-yellow font-bold">{t.score.toFixed(3)}</span>
                      </div>
                      <div className="ledger-phrase">
                        <span className="marker-sweep-text">{t.topic}</span>
                      </div>
                      {t.match && (
                        <div className="ledger-match-target">
                          <span className="ledger-match-label">
                            Matched with {t.course_title || data.parsed.b?.code || data.parsed.b?.title || 'Comparison'}:
                          </span>
                          <span className="ledger-match-text">“{t.match}”</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </aside>

            {/* --- VERDICT OVERLAY (Fades in at center in Scene 5) --- */}
            <div className="stage-verdict-overlay" ref={verdictOverlayRef}>
              <div className="verdict-sentence-wrap">
                <p className="verdict-sentence">
                  of <strong className="num text-highlight">{data.report.topics.total}</strong> topics in the proposal are not found in the other syllabus.
                </p>
              </div>

              <div className="verdict-stats-ribbon num">
                <div className="verdict-stat-cell">
                  <span className="stat-label">UNIT-LEVEL INDEX</span>
                  <span className="stat-value text-coral">{Math.round(data.report.novelty * 100)}%</span>
                </div>
                <div className="verdict-stat-sep" />
                <div className="verdict-stat-cell">
                  <span className="stat-label">COVERED IN COMPARISON</span>
                  <span className="stat-value text-yellow">{data.report.topics.covered} topics</span>
                </div>
                <div className="verdict-stat-sep" />
                <div className="verdict-stat-cell">
                  <span className="stat-label">PROPOSAL UNITS</span>
                  <span className="stat-value">{data.report.n_units} units</span>
                </div>
              </div>

              <div className="verdict-action-wrap">
                <button
                  type="button"
                  className="verdict-dashboard-btn num cursor-pointer"
                  onClick={handleSkipToDashboard}
                >
                  <span>Inspect Full Curriculum Matrix & Panes</span>
                  <span className="btn-arrow">↓</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [data, unitsA, unitsB, topicsAByUnit, topicsBByUnit, allTopicChips, isDebug]);

  return (
    <div
      className={`stage-outer-wrap ${isDebug ? 'is-debug-mode' : ''} ${mode === 'presenter' ? 'is-presenter-mode' : ''}`}
    >
      {/* HUD Header with auto-hide support */}
      <SceneHUD
        currentScene={activeHudScene}
        report={data.report}
        onSkipAnimation={handleSkipToDashboard}
        onOpenUpload={onOpenUpload}
        showSkip={mode !== 'presenter' && !isDebug}
        isHidden={isHudHidden}
      />

      {/* Presenter Controls Bar */}
      {mode === 'presenter' && (
        <div role="region" aria-label="Presenter Controls" className="presenter-controls-bar num">
          <div className="presenter-badge">
            <span className="presenter-pulse-dot" />
            <span>PRESENTER MODE (60s DEMO)</span>
          </div>
          <div className="presenter-progress-bar-wrap">
            <div
              className="presenter-progress-fill"
              ref={presenterProgressFillRef}
              style={{ width: '0%' }}
            />
          </div>
          <div className="presenter-shortcuts-hint">
            <strong>{isPaused ? '⏸ PAUSED' : '▶ PLAYING'}</strong>
            <span> · Space: Pause · ← / →: Step · Esc: Exit</span>
          </div>
        </div>
      )}

      {/* Main Track & Sticky Viewport */}
      {stageViewportDOM}

      {/* Frame Time Performance Overlay if ?perf=1 */}
      {showPerf && <PerfOverlay />}
    </div>
  );
};
