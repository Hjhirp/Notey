/**
 * Unit tests for download utilities
 */

import { getFileExtension, sanitizeFilename, createZipFilename } from '../downloadUtils';

describe('downloadUtils', () => {
  describe('getFileExtension', () => {
    it('extracts extension from URL', () => {
      expect(getFileExtension('file.webm')).toBe('webm');
      expect(getFileExtension('path/to/file.wav')).toBe('wav');
      expect(getFileExtension('file.jpg')).toBe('jpg');
    });

    it('falls back to content-type', () => {
      expect(getFileExtension('file', 'audio/webm')).toBe('webm');
      expect(getFileExtension('file', 'image/jpeg')).toBe('jpg');
      expect(getFileExtension('file', 'image/png')).toBe('png');
    });

    it('handles unknown types', () => {
      expect(getFileExtension('file')).toBe('bin');
      expect(getFileExtension('file', 'unknown/type')).toBe('bin');
    });
  });

  describe('sanitizeFilename', () => {
    it('replaces invalid characters', () => {
      expect(sanitizeFilename('file/name.txt')).toBe('file_name.txt');
      expect(sanitizeFilename('file\\name.txt')).toBe('file_name.txt');
      expect(sanitizeFilename('file:name.txt')).toBe('file_name.txt');
    });

    it('removes leading and trailing underscores', () => {
      expect(sanitizeFilename('___file___')).toBe('file');
      expect(sanitizeFilename('_file_')).toBe('file');
    });

    it('collapses multiple underscores', () => {
      expect(sanitizeFilename('file___name')).toBe('file_name');
    });
  });

  describe('createZipFilename', () => {
    it('creates filename with title', () => {
      const result = createZipFilename('abc123-def456-ghi789', 'My Event');
      expect(result).toBe('notey-My_Event-abc123-photos.zip');
    });

    it('creates filename without title', () => {
      const result = createZipFilename('abc123-def456-ghi789');
      expect(result).toBe('notey-event-abc123-photos.zip');
    });

    it('sanitizes title', () => {
      const result = createZipFilename('abc123-def456-ghi789', 'Event/With:Invalid*Chars');
      expect(result).toBe('notey-Event_With_Invalid_Chars-abc123-photos.zip');
    });
  });
});