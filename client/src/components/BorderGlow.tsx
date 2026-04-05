import React, { CSSProperties } from 'react';

export interface BorderGlowProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  glowIntensity?: 'low' | 'medium' | 'high';
  borderRadius?: string;
  borderWidth?: number;
  animationDuration?: number;
}

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
    low: '0.3',
    medium: '0.6',
    high: '1',
  };

  const glowOpacity = intensityMap[glowIntensity];

  return (
    <div className={`relative ${className}`} style={{ borderRadius }}>
      <style>{`
        @keyframes borderGlowPulse {
          0%, 100% {
            box-shadow: 0 0 10px ${glowColor}80, 0 0 20px ${glowColor}40, inset 0 0 10px ${glowColor}20;
          }
          50% {
            box-shadow: 0 0 20px ${glowColor}ff, 0 0 30px ${glowColor}80, inset 0 0 15px ${glowColor}40;
          }
        }
        .border-glow-wrapper {
          border-radius: ${borderRadius};
          animation: borderGlowPulse ${animationDuration}s ease-in-out infinite;
          opacity: ${glowOpacity};
        }
      `}</style>
      <div
        className="border-glow-wrapper"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', borderRadius }}>
        {children}
      </div>
    </div>
  );
};

export default BorderGlow;
