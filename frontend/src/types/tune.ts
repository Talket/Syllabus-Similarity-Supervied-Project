export interface TuneSettings {
  // Scene Durations (relative weight in timeline)
  scene0Duration: number; // Hero (0-4%)
  scene1Duration: number; // Read (4-18%)
  scene2Duration: number; // Split (18-36%)
  scene3Duration: number; // Embed (36-54%)
  scene4Duration: number; // Match (54-80%)
  scene5Duration: number; // Verdict (80-94%)

  // Motion & Dynamics
  easingStrength: number; // 0.2 .. 2.5
  chipSpeed: number; // 0.2 .. 3.0 (higher = faster flight)

  // Scan Line
  scanSpeed: number; // 0.5 .. 2.5
  scanGlow: number; // 0.2 .. 2.0

  // Camera Controls
  cameraDistance: number; // 2.0 .. 10.0
  cameraAngle: number; // 20 .. 85 degrees
  cameraArc: number; // 0.2 .. 2.0

  // 3D Point Cloud & Atmosphere
  pointSize: number; // 5 .. 50
  pointGlow: number; // 0.0 .. 1.0
  dustAmount: number; // 200 .. 2500
  trailLength: number; // 0.5 .. 3.0

  // Match Beams
  beamThickness: number; // 1 .. 6
  beamBrightness: number; // 0.1 .. 2.5

  // Palette
  colorA: string; // Proposal syllabus point color
  colorB: string; // Counterpart syllabus point color
  beamColor: string; // Semantic link beam color
  gridColor: string; // Ground plane grid color
}

export const DEFAULT_TUNE_SETTINGS: TuneSettings = {
  scene0Duration: 4,
  scene1Duration: 14,
  scene2Duration: 18,
  scene3Duration: 18,
  scene4Duration: 26,
  scene5Duration: 14,
  easingStrength: 1.0,
  chipSpeed: 1.0,
  scanSpeed: 1.0,
  scanGlow: 1.0,
  cameraDistance: 4.8,
  cameraAngle: 60,
  cameraArc: 1.0,
  pointSize: 22,
  pointGlow: 0.35,
  dustAmount: 1200,
  trailLength: 1.0,
  beamThickness: 1.0,
  beamBrightness: 1.0,
  colorA: '#6ee7f7',
  colorB: '#c4b5fd',
  beamColor: '#ffd93d',
  gridColor: '#6ee7f7',
};
