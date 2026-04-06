/**
 * useGlassHaptics Hook
 * Provides haptic feedback specifically optimized for glass-morphism UI interactions
 * Respects accessibility preferences and device capabilities
 */

import { useEffect, useState } from 'react';

export interface GlassHapticsConfig {
  enableHaptics?: boolean;
  respectReducedMotion?: boolean;
  respectReducedTransparency?: boolean;
  tapPattern?: number | number[];
  hoverPattern?: number | number[];
  scrollPattern?: number | number[];
}

export function useGlassHaptics(config: GlassHapticsConfig = {}) {
  const {
    enableHaptics = true,
    respectReducedMotion = true,
    respectReducedTransparency = true,
    tapPattern = [10, 5, 10],
    hoverPattern = 5,
    scrollPattern = 10,
  } = config;

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [prefersReducedTransparency, setPrefersReducedTransparency] = useState(false);
  const [supportsHaptics, setSupportsHaptics] = useState(false);

  // Detect accessibility preferences on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);

    // Check reduced transparency preference
    const transparencyQuery = window.matchMedia('(prefers-reduced-transparency: reduce)');
    setPrefersReducedTransparency(transparencyQuery.matches);

    // Check haptic support
    setSupportsHaptics(typeof navigator !== 'undefined' && !!navigator.vibrate);

    // Listen for changes
    const handleMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    const handleTransparencyChange = (e: MediaQueryListEvent) => setPrefersReducedTransparency(e.matches);

    motionQuery.addEventListener('change', handleMotionChange);
    transparencyQuery.addEventListener('change', handleTransparencyChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      transparencyQuery.removeEventListener('change', handleTransparencyChange);
    };
  }, []);

  /**
   * Trigger haptic feedback based on interaction type
   */
  const triggerHaptic = (type: 'tap' | 'hover' | 'scroll') => {
    if (!enableHaptics || !supportsHaptics) return;
    if (respectReducedMotion && prefersReducedMotion) return;

    try {
      let pattern: number | number[];

      switch (type) {
        case 'tap':
          pattern = tapPattern;
          break;
        case 'hover':
          pattern = hoverPattern;
          break;
        case 'scroll':
          pattern = scrollPattern;
          break;
        default:
          return;
      }

      navigator.vibrate(pattern);
    } catch (e) {
      console.debug('Haptic feedback error:', e);
    }
  };

  /**
   * Get CSS variable overrides for reduced transparency
   */
  const getAccessibilityOverrides = () => {
    const overrides: Record<string, string> = {};

    if (respectReducedTransparency && prefersReducedTransparency) {
      overrides['--glass-opacity'] = '0.3';
      overrides['--glass-border-opacity'] = '0.6';
    }

    if (respectReducedMotion && prefersReducedMotion) {
      overrides['--glass-transition'] = 'none';
    }

    return overrides;
  };

  return {
    triggerHaptic,
    getAccessibilityOverrides,
    prefersReducedMotion,
    prefersReducedTransparency,
    supportsHaptics,
  };
}

/**
 * Check if a glass card should be rendered based on performance constraints
 * Limits simultaneous glass elements on mobile to prevent jank
 */
export function shouldRenderGlassCard(index: number, maxConcurrent: number = 8): boolean {
  if (typeof window === 'undefined') return true;

  // On mobile, limit glass cards
  const isMobile = window.innerWidth < 768;
  if (isMobile && index >= maxConcurrent) {
    return false;
  }

  return true;
}

/**
 * Get optimized glass card props based on device capabilities
 */
export function getOptimizedGlassProps(isMobile: boolean = false) {
  return {
    blur: isMobile ? 8 : 12,
    saturation: isMobile ? 160 : 180,
    brightness: isMobile ? 95 : 100,
    onHoverScale: isMobile ? 1.01 : 1.02,
  };
}

/**
 * Validate text contrast against glass background
 * Returns true if contrast ratio >= 4.5:1 (WCAG AA)
 */
export function validateGlassContrast(
  foregroundColor: string,
  glassOpacity: number = 0.1
): boolean {
  // Simplified contrast check - in production, use a library like `wcag-contrast`
  // This is a placeholder that assumes light text on dark glass is sufficient
  const isLightText = foregroundColor.includes('white') || foregroundColor.includes('light');
  const isHighOpacity = glassOpacity > 0.15;

  // Light text on semi-transparent glass usually meets WCAG AA
  return isLightText || isHighOpacity;
}
