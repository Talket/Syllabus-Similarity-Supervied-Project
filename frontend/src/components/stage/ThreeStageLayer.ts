import * as THREE from 'three';
import { ComparePairResponse, VizPoint, VizLink } from '../../types/api';
import { TuneSettings, DEFAULT_TUNE_SETTINGS } from '../../types/tune';

function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

export class ThreeStageLayer {
  private container: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;

  // Persistent Point Cloud (Single THREE.Points + ShaderMaterial)
  private pointsMesh: THREE.Points | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private positionsArr: Float32Array | null = null;
  private origPositionsArr: Float32Array | null = null;
  private targetPositionsArr: Float32Array | null = null;
  private colorsArr: Float32Array | null = null;
  private origColorsArr: Float32Array | null = null;
  private alphasArr: Float32Array | null = null;
  private sizesArr: Float32Array | null = null;

  // Living Ambient Layer: Perspective Ground Grid
  private groundGrid: THREE.LineSegments | null = null;
  private gridMaterial: THREE.LineBasicMaterial | null = null;

  // Living Ambient Layer: Drifting Dust Motes
  private dustMesh: THREE.Points | null = null;
  private dustGeo: THREE.BufferGeometry | null = null;
  private dustPositions: Float32Array | null = null;
  private dustInitialPositions: Float32Array | null = null;
  private dustCount = 1200;

  // Persistent Beams (Single LineSegments + ShaderMaterial with travelling pulse)
  private beamsMesh: THREE.LineSegments | null = null;
  private beamsShaderMat: THREE.ShaderMaterial | null = null;

  // Shockwave Ring in Verdict
  private shockwaveMesh: THREE.Mesh | null = null;
  private shockwaveMat: THREE.ShaderMaterial | null = null;

  // Data cache
  private points: VizPoint[] = [];
  private links: VizLink[] = [];
  private totalPoints = 0;
  private tuneSettings: TuneSettings = DEFAULT_TUNE_SETTINGS;

  public get pointCount(): number {
    return this.totalPoints;
  }

  // Cached vectors to prevent per-frame garbage collection
  private _tempVec3 = new THREE.Vector3();
  private _camTarget = new THREE.Vector3(0, 0, 0);
  private raycaster = new THREE.Raycaster();
  private mouseVec = new THREE.Vector2();
  private lastRenderedP = 0;
  private lastRenderedTime = 0;

  // Ambient loop control
  private animFrameId: number | null = null;
  private isDisposed = false;

  // Resize listener
  private onResizeBound = this.onResize.bind(this);

  public init(container: HTMLElement, data: ComparePairResponse) {
    this.container = container;
    this.points = data.viz?.points || [];
    this.links = [...(data.viz?.links || [])].sort((a, b) => b.score - a.score);
    this.totalPoints = this.points.length;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. ONE Renderer created once, pixel ratio capped at 1.75
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = 'stage-canvas';
    container.appendChild(this.renderer.domElement);

    // 2. ONE Scene & Camera created once, never destroyed
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 3.8, 3.2);
    this.camera.lookAt(0, 0, 0);

    // 3. Ground Perspective Grid
    this.buildGroundGrid();

    // 4. Living Ambient Layer: Drifting Dust Motes
    this.buildDustMotes();

    // 5. Build Point Cloud with ShaderMaterial & per-point attributes
    this.buildPointCloud();

    // 6. Build Beams with Single ShaderMaterial & Travelling Light Pulse
    this.buildBeams();

    // 7. Shockwave Ring for Verdict
    this.buildShockwave();

    // 8. WebGL Pipeline Warmup: Compile shaders & warm up buffers
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);

    window.addEventListener('resize', this.onResizeBound);

    // Start independent ambient loop for continuous breathing and dust drift
    this.startAmbientLoop();
  }

  private buildGroundGrid() {
    if (!this.scene) return;
    const gridPoints: THREE.Vector3[] = [];
    const rings = 5;
    const segments = 64;
    for (let r = 1; r <= rings; r++) {
      const radius = (r / rings) * 3.8;
      for (let s = 0; s < segments; s++) {
        const theta1 = (s / segments) * Math.PI * 2;
        const theta2 = ((s + 1) / segments) * Math.PI * 2;
        gridPoints.push(new THREE.Vector3(Math.cos(theta1) * radius, -0.05, Math.sin(theta1) * radius));
        gridPoints.push(new THREE.Vector3(Math.cos(theta2) * radius, -0.05, Math.sin(theta2) * radius));
      }
    }
    for (let sp = 0; sp < 12; sp++) {
      const theta = (sp / 12) * Math.PI * 2;
      gridPoints.push(new THREE.Vector3(0, -0.05, 0));
      gridPoints.push(new THREE.Vector3(Math.cos(theta) * 3.8, -0.05, Math.sin(theta) * 3.8));
    }

    const gridGeo = new THREE.BufferGeometry().setFromPoints(gridPoints);
    this.gridMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.tuneSettings.gridColor),
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.groundGrid = new THREE.LineSegments(gridGeo, this.gridMaterial);
    this.scene.add(this.groundGrid);
  }

  private buildDustMotes() {
    if (!this.scene) return;
    this.dustCount = this.tuneSettings.dustAmount || 1200;
    this.dustGeo = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(this.dustCount * 3);
    this.dustInitialPositions = new Float32Array(this.dustCount * 3);

    for (let i = 0; i < this.dustCount; i++) {
      const x = (Math.random() - 0.5) * 12.0;
      const y = Math.random() * 5.5 - 0.5;
      const z = (Math.random() - 0.5) * 12.0;
      this.dustPositions[i * 3 + 0] = x;
      this.dustPositions[i * 3 + 1] = y;
      this.dustPositions[i * 3 + 2] = z;
      this.dustInitialPositions[i * 3 + 0] = x;
      this.dustInitialPositions[i * 3 + 1] = y;
      this.dustInitialPositions[i * 3 + 2] = z;
    }

    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));

    const dustMat = new THREE.ShaderMaterial({
      vertexShader: `
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.5, 4.0 * (1.0 / -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, dist) * 0.25;
          gl_FragColor = vec4(0.55, 0.72, 0.95, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.dustMesh = new THREE.Points(this.dustGeo, dustMat);
    this.scene.add(this.dustMesh);
  }

  private buildPointCloud() {
    if (!this.scene || this.totalPoints === 0) return;

    this.geometry = new THREE.BufferGeometry();

    this.positionsArr = new Float32Array(this.totalPoints * 3);
    this.origPositionsArr = new Float32Array(this.totalPoints * 3);
    this.targetPositionsArr = new Float32Array(this.totalPoints * 3);
    this.colorsArr = new Float32Array(this.totalPoints * 3);
    this.origColorsArr = new Float32Array(this.totalPoints * 3);
    this.alphasArr = new Float32Array(this.totalPoints);
    this.sizesArr = new Float32Array(this.totalPoints);

    const colA = new THREE.Color(this.tuneSettings.colorA);
    const colB = new THREE.Color(this.tuneSettings.colorB);

    for (let i = 0; i < this.totalPoints; i++) {
      const pt = this.points[i];

      // Ground disc mapping scaled so cloud fills >= 65% of screen height
      const tx = pt.x * 3.4;
      const tz = pt.y * 3.4;
      const ty = ((pt.unit || 1) - 3.5) * 0.12;

      this.targetPositionsArr[i * 3 + 0] = tx;
      this.targetPositionsArr[i * 3 + 1] = ty;
      this.targetPositionsArr[i * 3 + 2] = tz;

      this.positionsArr[i * 3 + 0] = tx;
      this.positionsArr[i * 3 + 1] = ty;
      this.positionsArr[i * 3 + 2] = tz;

      this.origPositionsArr[i * 3 + 0] = tx;
      this.origPositionsArr[i * 3 + 1] = ty;
      this.origPositionsArr[i * 3 + 2] = tz;

      // Color coding: Side A = Proposal Cyan, Side B = Comparison Violet
      const c = pt.side === 'A' ? colA : colB;
      this.colorsArr[i * 3 + 0] = c.r;
      this.colorsArr[i * 3 + 1] = c.g;
      this.colorsArr[i * 3 + 2] = c.b;
      this.origColorsArr[i * 3 + 0] = c.r;
      this.origColorsArr[i * 3 + 1] = c.g;
      this.origColorsArr[i * 3 + 2] = c.b;

      // Initial Alpha = 0.0 (fades in as chips fly)
      this.alphasArr[i] = 0.0;
      this.sizesArr[i] = 26.0;
    }

    const posAttr = new THREE.BufferAttribute(this.positionsArr, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', posAttr);

    const colorAttr = new THREE.BufferAttribute(this.colorsArr, 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('customColor', colorAttr);

    const alphaAttr = new THREE.BufferAttribute(this.alphasArr, 1);
    alphaAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('alpha', alphaAttr);

    const sizeAttr = new THREE.BufferAttribute(this.sizesArr, 1);
    sizeAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('pointSize', sizeAttr);

    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSizeMultiplier: { value: this.tuneSettings.pointSize / 22.0 },
        uGlow: { value: this.tuneSettings.pointGlow },
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float alpha;
        attribute float pointSize;
        attribute vec3 customColor;
        uniform float uSizeMultiplier;
        uniform float uTime;

        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = customColor;
          // Subtle breathing motion
          float breath = sin(uTime * 1.5 + position.x * 2.0) * 0.02;
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position.x, position.y + breath, position.z, 1.0);
          gl_PointSize = pointSize * uSizeMultiplier * (1.8 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uGlow;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          if (vAlpha <= 0.002) discard;
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float edge = smoothstep(0.5, 0.32, dist);
          float core = smoothstep(0.35, 0.0, dist) * (0.8 + uGlow);
          gl_FragColor = vec4(vColor + vec3(core * 0.35), vAlpha * edge);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.pointsMesh = new THREE.Points(this.geometry, shaderMaterial);
    this.scene.add(this.pointsMesh);
  }

  private buildBeams() {
    if (!this.scene) return;

    const pointsMap = new Map<number, THREE.Vector3>();
    for (let i = 0; i < this.totalPoints; i++) {
      const pt = this.points[i];
      pointsMap.set(
        pt.id,
        new THREE.Vector3(
          this.targetPositionsArr![i * 3 + 0],
          this.targetPositionsArr![i * 3 + 1],
          this.targetPositionsArr![i * 3 + 2]
        )
      );
    }

    const linePoints: THREE.Vector3[] = [];
    const linkIndices: number[] = [];
    const arcTArr: number[] = [];

    // Build glowing bezier arcs merged into a single BufferGeometry
    this.links.forEach((link, linkIdx) => {
      const pA = pointsMap.get(link.a);
      const pB = pointsMap.get(link.b);
      if (!pA || !pB) return;

      const midPoint = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
      midPoint.y += 0.55 + link.score * 0.45;

      const curve = new THREE.QuadraticBezierCurve3(pA, midPoint, pB);
      const curvePts = curve.getPoints(24);

      for (let s = 0; s < curvePts.length - 1; s++) {
        linePoints.push(curvePts[s]);
        linePoints.push(curvePts[s + 1]);
        linkIndices.push(linkIdx);
        linkIndices.push(linkIdx);
        arcTArr.push(s / (curvePts.length - 1));
        arcTArr.push((s + 1) / (curvePts.length - 1));
      }
    });

    const beamsGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
    beamsGeo.setAttribute('aLinkIndex', new THREE.BufferAttribute(new Float32Array(linkIndices), 1));
    beamsGeo.setAttribute('aArcT', new THREE.BufferAttribute(new Float32Array(arcTArr), 1));

    // ShaderMaterial for all 17 arcs with travelling pulse of light
    this.beamsShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uActiveLink: { value: -1.0 },
        uBrightness: { value: this.tuneSettings.beamBrightness },
        uBeamColor: { value: new THREE.Color(this.tuneSettings.beamColor) },
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float aLinkIndex;
        attribute float aArcT;
        varying float vLinkIndex;
        varying float vArcT;
        void main() {
          vLinkIndex = aLinkIndex;
          vArcT = aArcT;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uActiveLink;
        uniform float uBrightness;
        uniform vec3 uBeamColor;
        uniform float uTime;
        varying float vLinkIndex;
        varying float vArcT;
        void main() {
          if (uActiveLink < -0.5 || vLinkIndex > uActiveLink) discard;
          float age = uActiveLink - vLinkIndex;
          float alpha = min(0.98, (0.4 + age * 0.1) * uBrightness);
          // Travelling pulse of light along active beam
          float pulse = exp(-pow(fract(vArcT - uTime * 0.9) - 0.5, 2.0) * 32.0) * 1.8;
          vec3 col = uBeamColor * (uBrightness + pulse);
          gl_FragColor = vec4(col, min(1.0, alpha + pulse * 0.4));
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    this.beamsMesh = new THREE.LineSegments(beamsGeo, this.beamsShaderMat);
    this.scene.add(this.beamsMesh);
  }

  private buildShockwave() {
    if (!this.scene) return;
    const ringGeo = new THREE.RingGeometry(0.96, 1.0, 64);
    ringGeo.rotateX(-Math.PI / 2);

    this.shockwaveMat = new THREE.ShaderMaterial({
      uniforms: {
        uScale: { value: 0.0 },
        uAlpha: { value: 0.0 },
        uColor: { value: new THREE.Color('#ff6b6b') },
      },
      vertexShader: `
        uniform float uScale;
        void main() {
          vec3 pos = position * uScale;
          pos.y += 0.02;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uAlpha;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(uColor, uAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.shockwaveMesh = new THREE.Mesh(ringGeo, this.shockwaveMat);
    this.scene.add(this.shockwaveMesh);
  }

  /**
   * Projects a 3D point in the point cloud to 2D screen coordinates
   * Camera is held steady during chip handoff pose looking at 0, 0, 0
   */
  public projectPointToScreen(pointIndex: number, width: number, height: number): { x: number; y: number } {
    if (!this.camera || !this.targetPositionsArr || pointIndex >= this.totalPoints) {
      return { x: width * 0.5, y: height * 0.5 };
    }

    this._tempVec3.set(
      this.targetPositionsArr[pointIndex * 3 + 0],
      this.targetPositionsArr[pointIndex * 3 + 1],
      this.targetPositionsArr[pointIndex * 3 + 2]
    );

    // Apply exact steady handoff camera pose scaled by tune settings
    const elevAngle = Math.max(10, Math.min(88, 58 + (this.tuneSettings.cameraAngle - 60)));
    const elevRad = (elevAngle * Math.PI) / 180;
    const distanceR = 4.2 * (this.tuneSettings.cameraDistance / 4.8);
    const camY = distanceR * Math.sin(elevRad);
    const camZ = distanceR * Math.cos(elevRad);

    const projCam = this.camera.clone();
    projCam.position.set(0, camY, camZ);
    projCam.lookAt(0, 0, 0);
    projCam.updateMatrixWorld();

    this._tempVec3.project(projCam);

    return {
      x: (this._tempVec3.x * 0.5 + 0.5) * width,
      y: (-this._tempVec3.y * 0.5 + 0.5) * height,
    };
  }

  /**
   * Returns current projected screen coordinates of point in live WebGL scene
   */
  public getPointScreenPos(pointIndex: number, width: number, height: number): { x: number; y: number } {
    if (!this.camera || !this.positionsArr || pointIndex >= this.totalPoints) {
      return { x: 0, y: 0 };
    }
    this._tempVec3.set(
      this.positionsArr[pointIndex * 3 + 0],
      this.positionsArr[pointIndex * 3 + 1],
      this.positionsArr[pointIndex * 3 + 2]
    );
    this.camera.updateMatrixWorld();
    this._tempVec3.project(this.camera);
    return {
      x: (this._tempVec3.x * 0.5 + 0.5) * width,
      y: (-this._tempVec3.y * 0.5 + 0.5) * height,
    };
  }

  /**
   * Returns current alpha of point in live WebGL scene
   */
  public getPointAlpha(pointIndex: number): number {
    return this.alphasArr && pointIndex < this.totalPoints ? this.alphasArr[pointIndex] : 0;
  }

  /**
   * Ambient Animation Loop: runs continuously even when scroll is paused
   */
  private startAmbientLoop() {
    const loop = (t: number) => {
      if (this.isDisposed) return;
      if (document.hidden) {
        this.animFrameId = requestAnimationFrame(loop);
        return;
      }

      const sec = t * 0.001;
      this.updateAmbient(sec);

      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private updateAmbient(timeSec: number) {
    if (!this.renderer || !this.scene || !this.camera) return;

    // 1. Gently drift dust motes
    if (this.dustGeo && this.dustPositions && this.dustInitialPositions) {
      for (let i = 0; i < this.dustCount; i++) {
        const initX = this.dustInitialPositions[i * 3 + 0];
        const initY = this.dustInitialPositions[i * 3 + 1];
        const initZ = this.dustInitialPositions[i * 3 + 2];

        this.dustPositions[i * 3 + 0] = initX + Math.sin(timeSec * 0.4 + i * 0.05) * 0.25;
        this.dustPositions[i * 3 + 1] = initY + Math.cos(timeSec * 0.3 + i * 0.08) * 0.2;
        this.dustPositions[i * 3 + 2] = initZ + Math.sin(timeSec * 0.35 + i * 0.03) * 0.25;
      }
      (this.dustGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // 2. Update shader time uniforms
    if (this.pointsMesh && (this.pointsMesh.material as THREE.ShaderMaterial).uniforms) {
      (this.pointsMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = timeSec;
    }
    if (this.beamsShaderMat && this.beamsShaderMat.uniforms) {
      this.beamsShaderMat.uniforms.uTime.value = timeSec;
    }

    // Render if idle
    this.renderAt(this.lastRenderedP, timeSec);
  }

  /**
   * Continuous render driven by timeline master progress
   */
  public renderAt(masterProgress: number, timeSeconds: number) {
    if (!this.renderer || !this.scene || !this.camera || !this.geometry) return;

    const p = Math.min(1, Math.max(0, masterProgress));
    this.lastRenderedP = p;
    this.lastRenderedTime = timeSeconds;

    // --- 1. Continuous Camera Trajectory ---
    // Scroll budget:
    // Hero 0..0.04, Read 0.04..0.18, Split 0.18..0.36
    // Embed 0.36..0.54, Match 0.54..0.80, Verdict 0.80..0.94, Dashboard Hand-off 0.94..1.00
    let elevationDeg = 58;
    let distanceR = 4.4;
    let orbitAzimuth = 0;

    if (p <= 0.34) {
      // Scene 0..2: resting elevated pose
      elevationDeg = 58;
      distanceR = 4.4;
      orbitAzimuth = 0;
    } else if (p > 0.34 && p <= 0.42) {
      // Handoff pose during chip flight
      elevationDeg = 58;
      distanceR = 4.2;
      orbitAzimuth = 0;
    } else if (p > 0.42 && p <= 0.54) {
      // Scene 3 Embed: cinematic camera arc sweeps around and down into disc
      const t = smoothstep(0.42, 0.54, p);
      elevationDeg = 58 - t * 6; // 58 -> 52 deg
      distanceR = 4.2 - t * 0.6; // 4.2 -> 3.6
      orbitAzimuth = t * 0.65 * this.tuneSettings.cameraArc;
    } else if (p > 0.54 && p <= 0.80) {
      // Scene 4 Match: push in to 3.4, continue orbit to follow active beams
      const t = smoothstep(0.54, 0.80, p);
      elevationDeg = 52 - t * 2; // 52 -> 50 deg
      distanceR = 3.6 - t * 0.3; // 3.6 -> 3.3
      orbitAzimuth = (0.65 + t * 0.55) * this.tuneSettings.cameraArc;
    } else if (p > 0.80 && p <= 0.94) {
      // Scene 5 Verdict: pull back to 4.4, elevate to 62 deg
      const t = smoothstep(0.80, 0.94, p);
      elevationDeg = 50 + t * 12; // 50 -> 62 deg
      distanceR = 3.3 + t * 1.1; // 3.3 -> 4.4
      orbitAzimuth = (1.20 + t * 0.15) * this.tuneSettings.cameraArc;
    } else {
      // Hand-off to Dashboard: Camera pulls up and away into gauge position
      const t = smoothstep(0.94, 1.0, p);
      elevationDeg = 62 + t * 22; // 62 -> 84 deg
      distanceR = 4.4 + t * 4.2; // 4.4 -> 8.6
      orbitAzimuth = 1.35;
    }

    // Apply camera distance & angle tuning
    const distScale = this.tuneSettings.cameraDistance / 4.8;
    const angleDelta = this.tuneSettings.cameraAngle - 60;
    const finalElevDeg = Math.max(10, Math.min(88, elevationDeg + angleDelta));
    const finalDistR = distanceR * distScale;

    // Subtle continuous live orbit active in Embed, Match, Verdict
    const liveDrift = p > 0.36 ? Math.sin(timeSeconds * 0.3) * 0.025 : 0;
    const finalAzimuth = orbitAzimuth + liveDrift;
    const elevRad = (finalElevDeg * Math.PI) / 180;

    const camY = finalDistR * Math.sin(elevRad);
    const rXZ = finalDistR * Math.cos(elevRad);
    const camX = rXZ * Math.sin(finalAzimuth);
    const camZ = rXZ * Math.cos(finalAzimuth);

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this._camTarget);

    // --- 2. Ground Grid Opacity & Ripple ---
    if (this.gridMaterial) {
      if (p < 0.30) {
        this.gridMaterial.opacity = 0;
      } else if (p >= 0.30 && p <= 0.40) {
        this.gridMaterial.opacity = ((p - 0.30) / 0.10) * 0.22;
      } else if (p > 0.40 && p <= 0.88) {
        this.gridMaterial.opacity = 0.22;
      } else {
        this.gridMaterial.opacity = Math.max(0.02, 0.22 - ((p - 0.88) / 0.12) * 0.20);
      }
    }

    // --- 3. Point Cloud Alpha, Color & Position Transitions ---
    const alphaAttr = this.geometry.attributes.alpha as THREE.BufferAttribute;
    const colorAttr = this.geometry.attributes.customColor as THREE.BufferAttribute;
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;

    const alphas = this.alphasArr!;
    const colors = this.colorsArr!;
    const positions = this.positionsArr!;

    // Point arrival timing synchronized with topic chip flight (Embed begins at p=0.36)
    if (p <= 0.80) {
      for (let i = 0; i < this.totalPoints; i++) {
        // Points fade in smoothly between p = 0.36 and 0.44 as chips fly in
        const arriveP = 0.36 + (i / this.totalPoints) * 0.06;
        const fadeDurationP = 0.015;

        if (p < arriveP) {
          alphas[i] = 0.0;
        } else if (p >= arriveP && p < arriveP + fadeDurationP) {
          alphas[i] = ((p - arriveP) / fadeDurationP) * 0.95;
        } else {
          alphas[i] = 0.95;
        }

        // Reset positions & colors if returning from Verdict
        positions[i * 3 + 0] = this.origPositionsArr![i * 3 + 0];
        positions[i * 3 + 1] = this.origPositionsArr![i * 3 + 1];
        positions[i * 3 + 2] = this.origPositionsArr![i * 3 + 2];
        colors[i * 3 + 0] = this.origColorsArr![i * 3 + 0];
        colors[i * 3 + 1] = this.origColorsArr![i * 3 + 1];
        colors[i * 3 + 2] = this.origColorsArr![i * 3 + 2];
      }
      alphaAttr.needsUpdate = true;
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
    } else {
      // Scene 5 Verdict (p = 0.80 to 0.94): Matched points dim, unmatched proposal points turn coral & rise
      const verdictT = smoothstep(0.80, 0.94, p);
      for (let i = 0; i < this.totalPoints; i++) {
        const pt = this.points[i];
        if (pt.covered) {
          alphas[i] = THREE.MathUtils.lerp(0.95, 0.20, verdictT);
          colors[i * 3 + 0] = this.origColorsArr![i * 3 + 0];
          colors[i * 3 + 1] = this.origColorsArr![i * 3 + 1];
          colors[i * 3 + 2] = this.origColorsArr![i * 3 + 2];
          positions[i * 3 + 0] = this.origPositionsArr![i * 3 + 0];
          positions[i * 3 + 1] = this.origPositionsArr![i * 3 + 1];
          positions[i * 3 + 2] = this.origPositionsArr![i * 3 + 2];
        } else if (pt.side === 'A') {
          // Unmatched proposal points: turn coral (#ff6b6b) and rise upward
          alphas[i] = 0.98;
          colors[i * 3 + 0] = THREE.MathUtils.lerp(this.origColorsArr![i * 3 + 0], 1.0, verdictT);
          colors[i * 3 + 1] = THREE.MathUtils.lerp(this.origColorsArr![i * 3 + 1], 0.42, verdictT);
          colors[i * 3 + 2] = THREE.MathUtils.lerp(this.origColorsArr![i * 3 + 2], 0.42, verdictT);

          const origX = this.origPositionsArr![i * 3 + 0];
          const origZ = this.origPositionsArr![i * 3 + 2];
          const driftFactor = 1.0 + verdictT * 0.25;
          positions[i * 3 + 0] = origX * driftFactor;
          positions[i * 3 + 1] = this.origPositionsArr![i * 3 + 1] + verdictT * 1.15; // Rise on vertical trails
          positions[i * 3 + 2] = origZ * driftFactor;
        } else {
          // Unmatched counterpart points: subtle dim
          alphas[i] = THREE.MathUtils.lerp(0.95, 0.18, verdictT);
          colors[i * 3 + 0] = this.origColorsArr![i * 3 + 0];
          colors[i * 3 + 1] = this.origColorsArr![i * 3 + 1];
          colors[i * 3 + 2] = this.origColorsArr![i * 3 + 2];
          positions[i * 3 + 0] = this.origPositionsArr![i * 3 + 0];
          positions[i * 3 + 1] = this.origPositionsArr![i * 3 + 1];
          positions[i * 3 + 2] = this.origPositionsArr![i * 3 + 2];
        }
      }
      alphaAttr.needsUpdate = true;
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
    }

    // --- 4. 17 Glowing Beams with Travelling Pulses in Match (p = 0.54 to 0.80) ---
    if (this.beamsShaderMat) {
      if (p < 0.54 || p > 0.86) {
        this.beamsShaderMat.uniforms.uActiveLink.value = -1.0;
      } else {
        const matchProgress = smoothstep(0.54, 0.78, p);
        this.beamsShaderMat.uniforms.uActiveLink.value = matchProgress * (this.links.length - 1);
      }
    }

    // --- 5. Verdict Shockwave Expansion (p = 0.80 to 0.94) ---
    if (this.shockwaveMat && this.shockwaveMesh) {
      if (p >= 0.80 && p <= 0.94) {
        const swT = smoothstep(0.80, 0.94, p);
        this.shockwaveMat.uniforms.uScale.value = swT * 6.5;
        this.shockwaveMat.uniforms.uAlpha.value = (1.0 - swT) * 0.45;
        this.shockwaveMesh.visible = true;
      } else {
        this.shockwaveMesh.visible = false;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Raycasts against active points for cursor hover feedback in Scene 3 / 4
   */
  public raycastPoint(screenX: number, screenY: number, width: number, height: number): VizPoint | null {
    if (!this.camera || !this.pointsMesh) return null;
    this.mouseVec.x = (screenX / width) * 2 - 1;
    this.mouseVec.y = -(screenY / height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouseVec, this.camera);
    this.raycaster.params.Points = { threshold: 0.15 };

    const intersects = this.raycaster.intersectObject(this.pointsMesh);
    if (intersects.length > 0 && intersects[0].index !== undefined) {
      const idx = intersects[0].index;
      if (this.alphasArr && this.alphasArr[idx] > 0.3) {
        return this.points[idx] || null;
      }
    }
    return null;
  }

  private onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  }

  public updateTuneSettings(settings: TuneSettings) {
    this.tuneSettings = settings;

    // 1. Update points uniforms
    if (this.pointsMesh && (this.pointsMesh.material as THREE.ShaderMaterial).uniforms) {
      const mat = this.pointsMesh.material as THREE.ShaderMaterial;
      if (mat.uniforms.uSizeMultiplier) mat.uniforms.uSizeMultiplier.value = settings.pointSize / 22.0;
      if (mat.uniforms.uGlow) mat.uniforms.uGlow.value = settings.pointGlow;
    }

    // 2. Update beams uniforms
    if (this.beamsShaderMat && this.beamsShaderMat.uniforms) {
      if (this.beamsShaderMat.uniforms.uBrightness) this.beamsShaderMat.uniforms.uBrightness.value = settings.beamBrightness;
      if (this.beamsShaderMat.uniforms.uBeamColor) this.beamsShaderMat.uniforms.uBeamColor.value.set(settings.beamColor);
    }

    // 3. Update point colors
    if (this.colorsArr && this.origColorsArr && this.geometry) {
      const colA = new THREE.Color(settings.colorA);
      const colB = new THREE.Color(settings.colorB);
      for (let i = 0; i < this.totalPoints; i++) {
        const pt = this.points[i];
        const c = pt.side === 'A' ? colA : colB;
        this.origColorsArr[i * 3 + 0] = c.r;
        this.origColorsArr[i * 3 + 1] = c.g;
        this.origColorsArr[i * 3 + 2] = c.b;
        this.colorsArr[i * 3 + 0] = c.r;
        this.colorsArr[i * 3 + 1] = c.g;
        this.colorsArr[i * 3 + 2] = c.b;
      }
      (this.geometry.attributes.customColor as THREE.BufferAttribute).needsUpdate = true;
    }

    // 4. Update ground grid color
    if (this.gridMaterial) {
      this.gridMaterial.color.set(settings.gridColor);
    }

    // 5. Update dust motes count if changed
    if (settings.dustAmount && settings.dustAmount !== this.dustCount && this.scene && this.dustMesh) {
      this.scene.remove(this.dustMesh);
      if (this.dustGeo) this.dustGeo.dispose();
      this.buildDustMotes();
    }

    // Trigger immediate re-render if already rendered
    if (this.lastRenderedP >= 0) {
      this.renderAt(this.lastRenderedP, this.lastRenderedTime);
    }
  }

  public dispose() {
    this.isDisposed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.onResizeBound);
    if (this.geometry) this.geometry.dispose();
    if (this.pointsMesh && (this.pointsMesh.material as THREE.Material)) {
      (this.pointsMesh.material as THREE.Material).dispose();
    }
    if (this.gridMaterial) this.gridMaterial.dispose();
    if (this.dustGeo) this.dustGeo.dispose();
    if (this.dustMesh && (this.dustMesh.material as THREE.Material)) {
      (this.dustMesh.material as THREE.Material).dispose();
    }
    if (this.beamsMesh) {
      this.beamsMesh.geometry.dispose();
      if (this.beamsShaderMat) this.beamsShaderMat.dispose();
    }
    if (this.shockwaveMesh) {
      this.shockwaveMesh.geometry.dispose();
      if (this.shockwaveMat) this.shockwaveMat.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
    }
  }
}
