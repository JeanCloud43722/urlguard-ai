import React, { ReactNode, CSSProperties } from 'react';
import './GlassCard.css';

export interface GlassCardProps {
  children: ReactNode;
  className?: string;
  blur?: number; // 0-20, default 12
  saturation?: number; // 0-200, default 180
  opacity?: number; // 0-1, default 0.1
  borderColor?: string; // default rgba(255,255,255,0.2)
  borderSize?: number; // default 1
  borderRadius?: number; // default 24
  borderOpacity?: number; // 0-1, default 0.4
  innerGlowColor?: string; // default rgba(255,255,255,0.2)
  innerGlowBlur?: number; // default 10
  brightness?: number; // 0-200, default 100
  onHoverScale?: number; // default 1.02
  onClick?: () => void;
  onHover?: (isHovering: boolean) => void;
  enableHaptics?: boolean; // default true
  reducedMotion?: boolean; // auto-detect from prefers-reduced-motion
  style?: CSSProperties;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      className = '',
      blur = 12,
      saturation = 180,
      opacity = 0.1,
      borderColor = 'rgba(255, 255, 255, 0.2)',
      borderSize = 1,
      borderRadius = 24,
      borderOpacity = 0.4,
      innerGlowColor = 'rgba(255, 255, 255, 0.2)',
      innerGlowBlur = 10,
      brightness = 100,
      onHoverScale = 1.02,
      onClick,
      onHover,
      enableHaptics = true,
      reducedMotion: reducedMotionProp,
      style,
    },
    ref
  ) => {
    const [isHovering, setIsHovering] = React.useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

    // Detect prefers-reduced-motion on mount
    React.useEffect(() => {
      if (reducedMotionProp !== undefined) {
        setPrefersReducedMotion(reducedMotionProp);
        return;
      }

      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        setPrefersReducedMotion(e.matches);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }, [reducedMotionProp]);

    const handleMouseEnter = () => {
      setIsHovering(true);
      onHover?.(true);
      if (enableHaptics && !prefersReducedMotion) {
        triggerGlassHaptic('hover');
      }
    };

    const handleMouseLeave = () => {
      setIsHovering(false);
      onHover?.(false);
    };

    const handleClick = () => {
      if (enableHaptics && !prefersReducedMotion) {
        triggerGlassHaptic('tap');
      }
      onClick?.();
    };

    const glassVars: CSSProperties = {
      '--glass-blur': `${blur}px`,
      '--glass-saturation': `${saturation}%`,
      '--glass-opacity': opacity,
      '--glass-border-color': borderColor,
      '--glass-border-size': `${borderSize}px`,
      '--glass-border-radius': `${borderRadius}px`,
      '--glass-border-opacity': borderOpacity,
      '--glass-inner-glow-color': innerGlowColor,
      '--glass-inner-glow-blur': `${innerGlowBlur}px`,
      '--glass-brightness': `${brightness}%`,
      '--glass-hover-scale': onHoverScale,
      '--glass-transition': prefersReducedMotion ? 'none' : '0.3s cubic-bezier(0.25, 1, 0.5, 1)',
    } as CSSProperties;

    return (
      <div
        ref={ref}
        className={`glass-card ${isHovering && !prefersReducedMotion ? 'glass-card--hovering' : ''} ${className}`}
        style={{
          ...glassVars,
          ...style,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        role="region"
        aria-label="Glass morphism card"
      >
        <div className="glass-card__content">{children}</div>
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

/**
 * Trigger haptic feedback for glass card interactions
 * @param type - 'tap' for click, 'hover' for hover
 */
export function triggerGlassHaptic(type: 'tap' | 'hover') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;

  try {
    if (type === 'tap') {
      // Double pulse for tap
      navigator.vibrate([10, 5, 10]);
    } else if (type === 'hover') {
      // Single subtle pulse for hover
      navigator.vibrate(5);
    }
  } catch (e) {
    console.debug('Haptic feedback not supported:', e);
  }
}

export default GlassCard;
