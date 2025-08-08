/**
 * Download utility functions
 */

/**
 * Download a file from URL with proper filename
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    // Try fetch first
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup blob URL
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
  } catch (error) {
    console.warn('Fetch download failed, trying direct link method:', error);
    
    // Fallback: direct link download (works for public URLs)
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (fallbackError) {
      console.error('All download methods failed:', fallbackError);
      throw new Error('Failed to download file. The file might not be publicly accessible.');
    }
  }
}

/**
 * Get file extension from URL or content-type
 */
export function getFileExtension(url: string, contentType?: string): string {
  // Try to get extension from URL
  const urlExtension = url.split('.').pop()?.toLowerCase();
  if (urlExtension && ['webm', 'wav', 'mp3', 'mp4', 'jpg', 'jpeg', 'png', 'webp'].includes(urlExtension)) {
    return urlExtension;
  }
  
  // Fallback to content-type mapping
  if (contentType) {
    const typeMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/wav': 'wav',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };
    return typeMap[contentType.toLowerCase()] || 'bin';
  }
  
  return 'bin';
}

/**
 * Generate a safe filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Create a ZIP filename for an event
 */
export function createZipFilename(eventId: string, title?: string): string {
  const sanitizedTitle = title ? sanitizeFilename(title) : 'event';
  const shortId = eventId.split('-')[0];
  return `notey-${sanitizedTitle}-${shortId}-photos.zip`;
}

/**
 * Fetch blob with progress callback (for large files)
 */
export async function fetchWithProgress(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  
  if (!response.body || !onProgress || !total) {
    return response.blob();
  }
  
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, total);
  }
  
  return new Blob(chunks);
}

/**
 * Check if browser supports download attribute
 */
export function supportsDownload(): boolean {
  const link = document.createElement('a');
  return 'download' in link;
}