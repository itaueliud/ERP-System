/**
 * Image optimization utilities (Req 37.10).
 *
 * These helpers run entirely in the browser using the Canvas API so no
 * server-side processing is required for client-uploaded images.
 */

export interface OptimizeOptions {
  /** Maximum width in pixels (aspect ratio preserved) */
  maxWidth?: number;
  /** Maximum height in pixels (aspect ratio preserved) */
  maxHeight?: number;
  /** JPEG/WebP quality 0–1 (default 0.8) */
  quality?: number;
  /** Output MIME type (default image/webp when supported, else image/jpeg) */
  format?: 'image/webp' | 'image/jpeg' | 'image/png';
}

/** Returns true when the browser can encode WebP via canvas */
export function supportsWebP(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

/**
 * Resize and compress a File/Blob to a smaller Blob.
 * Returns the original file unchanged if it is already small enough.
 */
export async function optimizeImage(
  file: File | Blob,
  options: OptimizeOptions = {}
): Promise<Blob> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    format = supportsWebP() ? 'image/webp' : 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down while preserving aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // fallback — return original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          // Only use the optimized version if it is actually smaller
          resolve(blob.size < file.size ? blob : file);
        },
        format,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for optimization'));
    };

    img.src = url;
  });
}

/**
 * Generate a thumbnail Blob from a File/Blob.
 * Default size matches the PlotConnect spec (300×200, Req 11.6).
 */
export async function generateThumbnail(
  file: File | Blob,
  width = 300,
  height = 200,
  quality = 0.75
): Promise<Blob> {
  return optimizeImage(file, {
    maxWidth: width,
    maxHeight: height,
    quality,
    format: supportsWebP() ? 'image/webp' : 'image/jpeg',
  });
}

/**
 * Build a CDN URL for a given asset path.
 * Falls back to the relative path when no CDN base is configured.
 */
export function cdnUrl(path: string, cdnBase?: string): string {
  // import.meta.env is only available in Vite-bundled code; guard for tests
  const envBase =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_CDN_BASE_URL as string | undefined) ?? ''
      : '';
  const base = cdnBase ?? envBase;
  if (!base) return path;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
