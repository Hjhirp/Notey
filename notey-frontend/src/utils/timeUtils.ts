/**
 * Time utility functions for timeline player
 */

/**
 * Format seconds to MM:SS format
 */
export function formatTime(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Calculate percentage from current time and duration
 */
export function getTimePercentage(currentTime: number, duration: number): number {
  if (!duration || duration <= 0) return 0;
  return Math.min(Math.max((currentTime / duration) * 100, 0), 100);
}

/**
 * Calculate time from percentage and duration
 */
export function getTimeFromPercentage(percentage: number, duration: number): number {
  return (percentage / 100) * duration;
}

/**
 * Find the active photo based on current time
 */
export function findActivePhoto<T extends { offset: number }>(
  photos: T[], 
  currentTime: number
): T | null {
  if (!photos.length) return null;
  
  // Find the last photo with offset <= currentTime
  let activePhoto: T | null = null;
  for (const photo of photos) {
    if (photo.offset <= currentTime) {
      activePhoto = photo;
    } else {
      break; // Photos should be sorted by offset
    }
  }
  
  return activePhoto;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}