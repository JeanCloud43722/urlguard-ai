import React, { CSSProperties } from 'react';
import './BorderGlow.css';

export interface BorderGlowProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  glowIntensity?: 'low' | 'medium' | 'high';
  borderRadius?: string;
  borderWidth?: number;
  animationDuration?: number;
}

/**
 * BorderGlow Component
 * Renders a container with an animated glowing border effect
 * Inspired by reactbits.dev/border-glow
 */
export const BorderGlow: React.FC<BorderGlowProps> = ({
  children,
  className = '',
  glowColor = '#3b82f6',
  glowIntensity = 'medium',
  borderRadius = '12px',
  borderWidth = 2,
  animationDuration = 3,
}) => {
  const intensityMap = {
    low: 0.3,
    medium: 0.6,
    high: 1,
  };

  const glowOpacity = intensityMap[glowIntensity];

  const containerStyle: CSSProperties = {
    position: 'relative',
    borderRadius,
    overflow: 'hidden',
  };

  const borderStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius,
    padding: borderWidth,
    background: `linear-gradient(45deg, ${glowColor}, transparent, ${glowColor})`,
    backgroundSize: '300% 300%',
    animation: `borderGlowAnimation ${animationDuration}s ease-in-out infinite`,
    WebkitMaskImage:
      'linear-gradient(to right, black, black calc(100% - 1px), transparent calc(100% - 1px)), linear-gradient(to bottom, black, black calc(100% - 1px), transparent calc(100% - 1px))',
    WebkitMaskComposite: 'source-out',
    maskComposite: 'exclude',
    opacity: glowOpacity,
    pointerEvents: 'none',
  };

  const contentStyle: CSSProperties = {
    position: 'relative',
    borderRadius,
    background: 'inherit',
  };

  return (
    <div style={containerStyle} className={`border-glow-container ${className}`}>
      <style>{`
        @keyframes borderGlowAnimation {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
      <div style={borderStyle} />
      <div style={contentStyle}>{children}</div>
    </div>
  );
};

export default BorderGlow;
