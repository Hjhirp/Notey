/**
 * Unit tests for time utilities
 */

import { formatTime, getTimePercentage, getTimeFromPercentage, findActivePhoto } from '../timeUtils';

describe('timeUtils', () => {
  describe('formatTime', () => {
    it('formats seconds correctly', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(30)).toBe('0:30');
      expect(formatTime(60)).toBe('1:00');
      expect(formatTime(90)).toBe('1:30');
      expect(formatTime(3661)).toBe('61:01');
    });

    it('handles edge cases', () => {
      expect(formatTime(-10)).toBe('0:00');
      expect(formatTime(NaN)).toBe('0:00');
      expect(formatTime(Infinity)).toBe('0:00');
    });

    it('pads seconds with zero', () => {
      expect(formatTime(65)).toBe('1:05');
      expect(formatTime(125)).toBe('2:05');
    });
  });

  describe('getTimePercentage', () => {
    it('calculates percentage correctly', () => {
      expect(getTimePercentage(0, 100)).toBe(0);
      expect(getTimePercentage(50, 100)).toBe(50);
      expect(getTimePercentage(100, 100)).toBe(100);
    });

    it('handles edge cases', () => {
      expect(getTimePercentage(10, 0)).toBe(0);
      expect(getTimePercentage(-10, 100)).toBe(0);
      expect(getTimePercentage(150, 100)).toBe(100);
    });
  });

  describe('getTimeFromPercentage', () => {
    it('calculates time correctly', () => {
      expect(getTimeFromPercentage(0, 100)).toBe(0);
      expect(getTimeFromPercentage(50, 100)).toBe(50);
      expect(getTimeFromPercentage(100, 100)).toBe(100);
    });
  });

  describe('findActivePhoto', () => {
    const photos = [
      { id: '1', offset: 10 },
      { id: '2', offset: 30 },
      { id: '3', offset: 60 },
    ];

    it('finds the correct active photo', () => {
      expect(findActivePhoto(photos, 5)).toBeNull();
      expect(findActivePhoto(photos, 10)?.id).toBe('1');
      expect(findActivePhoto(photos, 25)?.id).toBe('1');
      expect(findActivePhoto(photos, 30)?.id).toBe('2');
      expect(findActivePhoto(photos, 45)?.id).toBe('2');
      expect(findActivePhoto(photos, 100)?.id).toBe('3');
    });

    it('handles empty array', () => {
      expect(findActivePhoto([], 50)).toBeNull();
    });
  });
});