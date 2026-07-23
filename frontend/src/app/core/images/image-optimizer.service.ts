import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Image Format
 */
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif';

/**
 * Image Optimization Options
 */
export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  format?: ImageFormat;
  maintainAspectRatio?: boolean;
}

/**
 * Optimized Image Result
 */
export interface OptimizedImage {
  dataUrl: string;
  blob: Blob;
  size: number;
  width: number;
  height: number;
  format: ImageFormat;
  compressionRatio: number;
}

/**
 * Image Metadata
 */
export interface ImageMetadata {
  width: number;
  height: number;
  size: number;
  type: string;
  aspectRatio: number;
}

/**
 * Image Optimizer Service
 *
 * Advanced image optimization pipeline
 *
 * Features:
 * - Client-side image compression
 * - Format conversion (JPEG, PNG, WebP, AVIF)
 * - Automatic resizing
 * - Lazy loading support
 * - Responsive image generation
 *
 * @example
 * ```typescript
 * // Optimize image
 * const optimized = await this.imageOptimizer.optimizeImage(file, {
 *   maxWidth: 1920,
 *   quality: 0.8,
 *   format: 'webp'
 * });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class ImageOptimizerService {
  private readonly DEFAULT_QUALITY = 0.85;
  private readonly DEFAULT_MAX_WIDTH = 1920;
  private readonly DEFAULT_MAX_HEIGHT = 1080;

  /**
   * Optimize image file
   */
  async optimizeImage(file: File, options: ImageOptimizationOptions = {}): Promise<OptimizedImage> {
    const {
      maxWidth = this.DEFAULT_MAX_WIDTH,
      maxHeight = this.DEFAULT_MAX_HEIGHT,
      quality = this.DEFAULT_QUALITY,
      format = 'webp',
      maintainAspectRatio = true
    } = options;

    // Load image
    const img = await this.loadImage(file);

    // Calculate new dimensions
    const { width, height } = this.calculateDimensions(
      img.width,
      img.height,
      maxWidth,
      maxHeight,
      maintainAspectRatio
    );

    // Create canvas and draw resized image
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    // Use high-quality image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to desired format
    const mimeType = this.getMimeType(format);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        },
        mimeType,
        quality
      );
    });

    const dataUrl = canvas.toDataURL(mimeType, quality);
    const compressionRatio = (1 - blob.size / file.size) * 100;

    return {
      dataUrl,
      blob,
      size: blob.size,
      width,
      height,
      format,
      compressionRatio
    };
  }

  /**
   * Generate responsive image set
   */
  async generateResponsiveImages(
    file: File,
    widths: number[] = [320, 640, 1024, 1920]
  ): Promise<OptimizedImage[]> {
    const results: OptimizedImage[] = [];

    for (const width of widths) {
      const optimized = await this.optimizeImage(file, {
        maxWidth: width,
        quality: 0.85,
        format: 'webp'
      });
      results.push(optimized);
    }

    return results;
  }

  /**
   * Get image metadata
   */
  async getImageMetadata(file: File): Promise<ImageMetadata> {
    const img = await this.loadImage(file);

    return {
      width: img.width,
      height: img.height,
      size: file.size,
      type: file.type,
      aspectRatio: img.width / img.height
    };
  }

  /**
   * Check if image needs optimization
   */
  async shouldOptimize(file: File, maxSize: number = 500 * 1024): Promise<boolean> {
    if (file.size <= maxSize) return false;

    const metadata = await this.getImageMetadata(file);
    return metadata.width > 1920 || metadata.height > 1080;
  }

  /**
   * Compress image to target size
   */
  async compressToSize(file: File, targetSizeKB: number): Promise<OptimizedImage> {
    let quality = 0.9;
    let optimized = await this.optimizeImage(file, { quality });

    // Binary search for optimal quality
    let minQuality = 0.1;
    let maxQuality = 1.0;
    const targetSize = targetSizeKB * 1024;
    const tolerance = 0.05; // 5% tolerance

    while (Math.abs(optimized.size - targetSize) / targetSize > tolerance) {
      if (optimized.size > targetSize) {
        maxQuality = quality;
      } else {
        minQuality = quality;
      }

      quality = (minQuality + maxQuality) / 2;

      if (maxQuality - minQuality < 0.01) break; // Stop if range too small

      optimized = await this.optimizeImage(file, { quality });
    }

    return optimized;
  }

  /**
   * Convert image format
   */
  async convertFormat(file: File, format: ImageFormat): Promise<OptimizedImage> {
    return this.optimizeImage(file, { format });
  }

  /**
   * Generate thumbnail
   */
  async generateThumbnail(file: File, size: number = 200): Promise<OptimizedImage> {
    return this.optimizeImage(file, {
      maxWidth: size,
      maxHeight: size,
      quality: 0.8,
      format: 'jpeg'
    });
  }

  /**
   * Create image placeholder (BlurHash or low-quality preview)
   */
  async createPlaceholder(file: File): Promise<string> {
    const thumbnail = await this.optimizeImage(file, {
      maxWidth: 20,
      maxHeight: 20,
      quality: 0.3,
      format: 'jpeg'
    });

    return thumbnail.dataUrl;
  }

  /**
   * Load image from file
   */
  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * Calculate new dimensions maintaining aspect ratio
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number,
    maintainAspectRatio: boolean
  ): { width: number; height: number } {
    if (!maintainAspectRatio) {
      return {
        width: Math.min(originalWidth, maxWidth),
        height: Math.min(originalHeight, maxHeight)
      };
    }

    const aspectRatio = originalWidth / originalHeight;

    let width = originalWidth;
    let height = originalHeight;

    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  /**
   * Get MIME type for format
   */
  private getMimeType(format: ImageFormat): string {
    const mimeTypes: Record<ImageFormat, string> = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      avif: 'image/avif'
    };

    return mimeTypes[format] || 'image/jpeg';
  }

  /**
   * Check WebP support
   */
  supportsWebP(): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  }

  /**
   * Check AVIF support
   */
  async supportsAVIF(): Promise<boolean> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src =
        'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
    });
  }

  /**
   * Get best supported format
   */
  async getBestFormat(): Promise<ImageFormat> {
    if (await this.supportsAVIF()) return 'avif';
    if (this.supportsWebP()) return 'webp';
    return 'jpeg';
  }
}
