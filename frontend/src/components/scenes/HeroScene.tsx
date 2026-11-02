import React, { useEffect, useState } from 'react';
import { ParsedDoc } from '../../types/api';
import { IconUpload, IconArrowDown } from '../common/Icons';

interface HeroSceneProps {
  progress?: number;
  parsedA?: ParsedDoc;
  onExplore?: () => void;
  onOpenUpload?: () => void;
}

export const HeroScene: React.FC<HeroSceneProps> = ({
  parsedA,
  onExplore,
  onOpenUpload,
}) => {
  // Cursor-following 3D parallax tilt
  const [tilt, setTilt] = useState({ x: 3, y: -5 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx; // -1 .. 1
      const dy = (e.clientY - cy) / cy; // -1 .. 1
      setTilt({
        x: -dy * 9, // tilt vertical
        y: dx * 11, // tilt horizontal
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Periodic yellow marker swipe across a unit line every 3.2s
  const units = parsedA?.units?.slice(0, 5) || [];
  const [activeSwipeIndex, setActiveSwipeIndex] = useState<number>(0);

  useEffect(() => {
    if (units.length === 0) return;
    const interval = setInterval(() => {
      setActiveSwipeIndex((prev) => (prev + 1) % units.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [units.length]);

  return (
    <section className="scene-hero" aria-label="Hero Introduction">
      <div className="hero-layout">
        {/* Left Column: Editorial Display Typography & Honest Copy */}
        <div className="hero-left-col">
          <h1 className="hero-headline">
            Find what is <br />
            <span className="hero-marker-phrase">actually new.</span>
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
              onClick={onExplore}
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

        {/* Right Column: One Bright Lit 3D Paper Sheet with Real Text & Marker Swipe */}
        <div className="hero-right-col" aria-hidden="true">
          <div
            className="hero-lit-sheet"
            style={{
              transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) rotateZ(-1.5deg)`,
            }}
          >
            <div className="sheet-header">
              <span className="sheet-badge num">SYLLABUS A · PROPOSAL</span>
              <span className="sheet-code num">{parsedA?.code || 'NPTEL_INT395'}</span>
            </div>

            <h2 className="hero-sheet-title">
              {parsedA?.title || 'Introduction to Machine Learning'}
            </h2>
            <div className="sheet-divider" />

            <div className="hero-sheet-units">
              {units.map((u, i) => (
                <div key={u.order} className="hero-sheet-unit">
                  <div className="sheet-unit-order num">Unit 0{u.order}</div>
                  <div className="hero-sheet-unit-title">
                    <span
                      className={`marker-highlight ${i === activeSwipeIndex ? 'active' : ''}`}
                    >
                      {u.title}
                    </span>
                  </div>
                  <p className="hero-sheet-unit-text">{u.text.slice(0, 95)}...</p>
                </div>
              ))}
            </div>

            <div className="sheet-footer num">
              <span>{parsedA?.units?.length || 7} UNITS DETECTED</span>
              <span>FORMAT: {parsedA?.format?.toUpperCase() || 'UNIT'}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
