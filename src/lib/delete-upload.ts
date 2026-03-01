import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Extracts the bare filename from any of the URL formats we use:
 *   /api/files/1234-abc.jpg   → 1234-abc.jpg
 *   /upload/1234-abc.jpg      → 1234-abc.jpg  (legacy)
 *   1234-abc.jpg              → 1234-abc.jpg  (bare)
 */
function extractFilename(url: string): string | null {
  if (!url) return null;

  if (url.startsWith('/api/files/')) return url.replace('/api/files/', '');
  if (url.startsWith('/upload/')) return url.replace('/upload/', '');

  // Bare filename (no slashes)
  if (!url.includes('/')) return url;

  return null;
}

/**
 * Deletes an uploaded image file from the /uploads directory.
 * Silently succeeds if the file does not exist or the URL is not a local upload.
 */
export async function deleteUploadedFile(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl) return;

  // Skip external URLs (http/https) — those are not stored locally
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return;

  const filename = extractFilename(imageUrl);
  if (!filename) return;

  // Guard against path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return;

  const filePath = join(process.cwd(), 'uploads', filename);

  if (existsSync(filePath)) {
    try {
      await unlink(filePath);
    } catch (err) {
      console.error('[deleteUploadedFile] Failed to delete file:', filePath, err);
    }
  }
}
