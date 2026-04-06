/**
 * useHapticFeedback Hook
 * Provides haptic feedback for scroll and interaction events
 * Uses navigator.vibrate() API for touch devices
 * Falls back to CSS animations for non-touch devices
 */

export function useHapticFeedback() {
  /**
   * Trigger haptic feedback on touch devices
   * @param pattern - Vibration pattern in milliseconds (e.g., 10 for short pulse)
   */
  const triggerHaptic = (pattern: number | number[] = 10) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        console.debug('Haptic feedback not supported:', e);
      }
    }
  };

  /**
   * Trigger haptic feedback on scroll events
   * Subtle pulse (10ms) to indicate momentum scrolling
   */
  const onScroll = () => {
    triggerHaptic(10);
  };

  /**
   * Trigger haptic feedback on button click
   * Double pulse (10ms, 5ms gap, 10ms) for interactive feedback
   */
  const onClick = () => {
    triggerHaptic([10, 5, 10]);
  };

  /**
   * Trigger haptic feedback on form submission
   * Longer pulse (20ms) for significant actions
   */
  const onSubmit = () => {
    triggerHaptic(20);
  };

  return {
    triggerHaptic,
    onScroll,
    onClick,
    onSubmit,
  };
}
