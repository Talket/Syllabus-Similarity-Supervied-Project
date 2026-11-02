export interface SceneRange {
  id: number;
  name: string;
  label: string;
  sub: string;
  start: number;       // where scene elements begin entrance/movement
  end: number;         // where scene elements finish exit/transition
  focusStart: number;  // optimal inspection range start for debug
  focusEnd: number;    // optimal inspection range end for debug
  scrollLengthVh: number; // proportional scroll track allocation
}

// 2000vh total scroll length with smooth overlaps between adjacent scenes
export const TOTAL_SCROLL_VH = 2000;

export const SEAMS: SceneRange[] = [
  {
    id: 0,
    name: 'Hero',
    label: '',
    sub: '',
    start: 0.00,
    end: 0.04,
    focusStart: 0.00,
    focusEnd: 0.04,
    scrollLengthVh: 80,
  },
  {
    id: 1,
    name: 'Read',
    label: '(Read) 1.0',
    sub: '',
    start: 0.04,
    end: 0.18,
    focusStart: 0.06,
    focusEnd: 0.16,
    scrollLengthVh: 280,
  },
  {
    id: 2,
    name: 'Split',
    label: '(Split) 2.0',
    sub: 'Units & Topics Breakdown',
    start: 0.18,
    end: 0.36,
    focusStart: 0.22,
    focusEnd: 0.32,
    scrollLengthVh: 360,
  },
  {
    id: 3,
    name: 'Embed',
    label: '(Embed) 3.0',
    sub: 'Semantic Meaning Space',
    start: 0.36,
    end: 0.54,
    focusStart: 0.40,
    focusEnd: 0.50,
    scrollLengthVh: 360,
  },
  {
    id: 4,
    name: 'Match',
    label: '(Match) 4.0',
    sub: 'Semantic Pairs Alignment',
    start: 0.54,
    end: 0.80,
    focusStart: 0.60,
    focusEnd: 0.76,
    scrollLengthVh: 520,
  },
  {
    id: 5,
    name: 'Verdict',
    label: '(Verdict) 5.0',
    sub: 'Curriculum Novelty Verdict',
    start: 0.80,
    end: 0.94,
    focusStart: 0.83,
    focusEnd: 0.92,
    scrollLengthVh: 280,
  },
];

/**
 * Maps scene ID (0..5) and sub-progress (0..1) to master timeline progress (0..1)
 */
export function getMasterProgress(sceneId: number, subProgress: number = 0.5): number {
  const range = SEAMS.find((s) => s.id === sceneId) || SEAMS[0];
  const clampedSub = Math.min(1, Math.max(0, subProgress));
  return range.focusStart + clampedSub * (range.focusEnd - range.focusStart);
}

/**
 * Gets active scene metadata based on master timeline progress
 */
export function getActiveScene(masterProgress: number): SceneRange {
  const p = Math.min(1, Math.max(0, masterProgress));
  for (let i = SEAMS.length - 1; i >= 0; i--) {
    if (p >= SEAMS[i].start) {
      return SEAMS[i];
    }
  }
  return SEAMS[0];
}
