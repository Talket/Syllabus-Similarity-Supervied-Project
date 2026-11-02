import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Viz, VizPoint } from '../../types/api';

interface EmbedSceneProps {
  progress: number; // 0..1
  viz: Viz;
  activePointId?: number | null;
  onHoverPoint?: (point: VizPoint | null) => void;
}

export const EmbedScene: React.FC<EmbedSceneProps> = ({
  progress,
  viz,
  activePointId,
  onHoverPoint,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<VizPoint | null>(null);

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pointsMeshRef = useRef<THREE.Points | null>(null);
  const discGridRef = useRef<THREE.Group | null>(null);
  const positionsOrigRef = useRef<Float32Array | null>(null);
  const positionsTargetRef = useRef<Float32Array | null>(null);
  const colorsArrayRef = useRef<Float32Array | null>(null);
  const animFrameIdRef = useRef<number>(0);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, -0.6, 3.4);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer (capped dpr at 2)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Meaning Space Disc Guides (Concentic circles + crosshairs)
    const discGroup = new THREE.Group();
    discGroup.rotation.x = 0.25; // Subtle 3D tilt
    discGridRef.current = discGroup;
    scene.add(discGroup);

    const ringMaterial = new THREE.LineBasicMaterial({
      color: 0xf2f1ed,
      transparent: true,
      opacity: 0.12,
    });

    [0.5, 1.0, 1.5, 2.0].forEach((r) => {
      const circleGeo = new THREE.BufferGeometry().setFromPoints(
        new THREE.Path().absarc(0, 0, r, 0, Math.PI * 2, true).getPoints(64)
      );
      const ring = new THREE.Line(circleGeo, ringMaterial);
      discGroup.add(ring);
    });

    // Cross axes
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-2.2, 0, 0),
      new THREE.Vector3(2.2, 0, 0),
      new THREE.Vector3(0, -2.2, 0),
      new THREE.Vector3(0, 2.2, 0),
    ]);
    const axisLine = new THREE.LineSegments(axisGeo, ringMaterial);
    discGroup.add(axisLine);

    // Points Geometry
    const pts = viz.points;
    const count = pts.length;
    const positionsTarget = new Float32Array(count * 3);
    const positionsCurrent = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colorA = new THREE.Color('#6ee7f9'); // Cyan
    const colorB = new THREE.Color('#8b7cff'); // Violet
    const colorCoveredA = new THREE.Color('#ffd93d'); // Matched A Yellow

    const scale = 1.8;

    pts.forEach((pt, i) => {
      const tx = pt.x * scale;
      const ty = pt.y * scale;
      // Organic slight z depth based on PCA
      const tz = (Math.sin(pt.x * 4) * Math.cos(pt.y * 4) * 0.18);

      positionsTarget[i * 3] = tx;
      positionsTarget[i * 3 + 1] = ty;
      positionsTarget[i * 3 + 2] = tz;

      // Start positions: scattered outward
      const angle = (i / count) * Math.PI * 2;
      const scatterDist = 4.0 + (i % 5);
      positionsCurrent[i * 3] = Math.cos(angle) * scatterDist;
      positionsCurrent[i * 3 + 1] = Math.sin(angle) * scatterDist;
      positionsCurrent[i * 3 + 2] = (Math.random() - 0.5) * 3;

      // Color assignment
      const c = pt.side === 'A' ? (pt.covered ? colorCoveredA : colorA) : colorB;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    });

    positionsOrigRef.current = positionsCurrent;
    positionsTargetRef.current = positionsTarget;
    colorsArrayRef.current = colors;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positionsCurrent.slice(), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Circular particle texture created dynamically
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const pointsMesh = new THREE.Points(geometry, material);
    pointsMeshRef.current = pointsMesh;
    discGroup.add(pointsMesh);

    // Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let time = 0;
    const animate = () => {
      time += 0.003;
      if (discGroup) {
        // Slow continuous orbit/drift (A24 idea)
        discGroup.rotation.z = time * 0.4;
        discGroup.rotation.x = 0.25 + Math.sin(time) * 0.08;
        discGroup.rotation.y = Math.cos(time * 0.8) * 0.08;
      }
      renderer.render(scene, camera);
      animFrameIdRef.current = requestAnimationFrame(animate);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameIdRef.current);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    };
  }, [viz]);

  // Update particle positions based on progress (0..1)
  useEffect(() => {
    if (!pointsMeshRef.current || !positionsOrigRef.current || !positionsTargetRef.current) return;

    const count = viz.points.length;
    const posAttr = pointsMeshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const currentArr = posAttr.array as Float32Array;
    const origArr = positionsOrigRef.current;
    const targetArr = positionsTargetRef.current;

    // Smooth ease for arrival
    const eased = Math.min(1, Math.max(0, progress));
    const smoothT = Math.pow(eased, 2.2);

    for (let i = 0; i < count * 3; i++) {
      currentArr[i] = origArr[i] + (targetArr[i] - origArr[i]) * smoothT;
    }

    posAttr.needsUpdate = true;
  }, [progress, viz.points.length]);

  return (
    <div className="scene-viewport scene-embed" aria-label="Scene 3: Semantic Embedding in Meaning-Space">
      <div className="embed-hud-header">
        <div className="section-tag">
          <span className="accent">(Embed) 3.0</span>
        </div>
        <div className="embed-legend num">
          <span className="legend-item">
            <span className="legend-dot dot-cyan" /> Side A: Proposal ({viz.points.filter((p) => p.side === 'A').length} pts)
          </span>
          <span className="legend-item">
            <span className="legend-dot dot-violet" /> Side B: Comparison ({viz.points.filter((p) => p.side === 'B').length} pts)
          </span>
          <span className="legend-item">
            <span className="legend-dot dot-yellow" /> Matched In-Model
          </span>
        </div>
      </div>

      <div className="three-canvas-container" ref={mountRef} />

      {hoveredPoint && (
        <div className="point-tooltip num">
          <div className="tooltip-title">{hoveredPoint.text}</div>
          <div className="tooltip-meta">
            Side {hoveredPoint.side} · Unit {hoveredPoint.unit} · ({hoveredPoint.x.toFixed(2)}, {hoveredPoint.y.toFixed(2)})
          </div>
        </div>
      )}
    </div>
  );
};

