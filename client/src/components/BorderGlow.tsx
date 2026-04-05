import React, { useRef, useEffect, useState } from 'react';

export interface BorderGlowProps {
  children: React.ReactNode;
  className?: string;
  edgeSensitivity?: number;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  animated?: boolean;
  colors?: string[];
}

/**
 * BorderGlow Component - Exact implementation from reactbits.dev
 * Glow effect follows cursor when hovering near card edges
 */
export const BorderGlow: React.FC<BorderGlowProps> = ({
  children,
  className = '',
  edgeSensitivity = 30,
  glowColor = '40 80 80',
  backgroundColor = '#060010',
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1.0,
  coneSpread = 25,
  animated = false,
  colors = ['#c084fc', '#f472b6', '#38bdf8'],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isNearEdge, setIsNearEdge] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setMousePos({ x, y });

      // Check if cursor is near edge
      const distToTop = y;
      const distToBottom = rect.height - y;
      const distToLeft = x;
      const distToRight = rect.width - x;

      const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);
      const threshold = (edgeSensitivity / 100) * Math.min(rect.width, rect.height);

      setIsNearEdge(minDist < threshold);
    };

    const handleMouseLeave = () => {
      setIsNearEdge(false);
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [edgeSensitivity]);

  const gradientStops = colors
    .map((color, i) => `${color} ${(i / (colors.length - 1)) * 100}%`)
    .join(', ');

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        backgroundColor,
        borderRadius: `${borderRadius}px`,
      }}
    >
      <style>{`
        @keyframes borderGlowSweep {
          0% {
            opacity: 0;
            transform: translateX(-100%);
          }
          50% {
            opacity: ${glowIntensity};
          }
          100% {
            opacity: 0;
            transform: translateX(100%);
          }
        }
      `}</style>

      {/* Glow effect layer */}
      {isNearEdge && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: `${borderRadius}px`,
            pointerEvents: 'none',
            background: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, hsl(${glowColor}) 0%, transparent ${glowRadius}px)`,
            opacity: glowIntensity,
            mixBlendMode: 'screen',
          }}
        />
      )}

      {/* Border gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: `${borderRadius}px`,
          padding: '2px',
          background: `linear-gradient(90deg, ${gradientStops})`,
          pointerEvents: 'none',
          opacity: 0.3,
          WebkitMaskImage: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent ${glowRadius * 1.5}px)`,
          maskImage: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent ${glowRadius * 1.5}px)`,
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', borderRadius: `${borderRadius}px` }}>
        {children}
      </div>
    </div>
  );
};

export default BorderGlow;
