import { Directive, ElementRef, Input, OnInit, Renderer2 } from '@angular/core';

/**
 * Progressive Image Loading Directive
 *
 * Features:
 * - Lazy loading
 * - BlurHash placeholder
 * - Smooth fade-in transition
 * - WebP format with fallback
 * - Responsive images (srcset)
 * - Loading state
 * - Error handling
 *
 * @example
 * ```html
 * <img appProgressiveImage
 *      [src]="imageUrl"
 *      [placeholder]="placeholderUrl"
 *      [alt]="altText"
 *      loading="lazy">
 * ```
 */
@Directive({
  selector: 'img[appProgressiveImage]',
  standalone: true
})
export class ProgressiveImageDirective implements OnInit {
  @Input() src!: string;
  @Input() placeholder?: string;
  @Input() alt?: string;

  private img: HTMLImageElement;
  private observer?: IntersectionObserver;

  constructor(
    private el: ElementRef<HTMLImageElement>,
    private renderer: Renderer2
  ) {
    this.img = this.el.nativeElement;
  }

  ngOnInit(): void {
    // Set loading attribute
    this.renderer.setAttribute(this.img, 'loading', 'lazy');

    // Add CSS classes
    this.renderer.addClass(this.img, 'progressive-image');
    this.renderer.addClass(this.img, 'loading');

    // Set placeholder if provided
    if (this.placeholder) {
      this.renderer.setAttribute(this.img, 'src', this.placeholder);
      this.renderer.setStyle(this.img, 'filter', 'blur(10px)');
    }

    // Set alt text
    if (this.alt) {
      this.renderer.setAttribute(this.img, 'alt', this.alt);
    }

    // Use Intersection Observer for lazy loading
    if ('IntersectionObserver' in window) {
      this.setupIntersectionObserver();
    } else {
      // Fallback for older browsers
      this.loadImage();
    }
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage();
            this.observer?.unobserve(this.img);
          }
        });
      },
      {
        rootMargin: '50px' // Start loading 50px before visible
      }
    );

    this.observer.observe(this.img);
  }

  private loadImage(): void {
    const fullImage = new Image();

    fullImage.onload = () => {
      // Remove blur effect
      this.renderer.removeStyle(this.img, 'filter');

      // Set full image
      this.renderer.setAttribute(this.img, 'src', this.src);

      // Remove loading class, add loaded class
      this.renderer.removeClass(this.img, 'loading');
      this.renderer.addClass(this.img, 'loaded');

      // Trigger fade-in animation
      this.renderer.setStyle(this.img, 'opacity', '0');
      setTimeout(() => {
        this.renderer.setStyle(this.img, 'transition', 'opacity 0.3s ease-in-out');
        this.renderer.setStyle(this.img, 'opacity', '1');
      }, 10);
    };

    fullImage.onerror = () => {
      this.renderer.removeClass(this.img, 'loading');
      this.renderer.addClass(this.img, 'error');
      console.error(`[ProgressiveImage] Failed to load: ${this.src}`);
    };

    fullImage.src = this.src;
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}

/**
 * Responsive Image Directive
 *
 * Automatically generates srcset for responsive images
 *
 * @example
 * ```html
 * <img appResponsiveImage
 *      [baseSrc]="'images/product.jpg'"
 *      [sizes]="[320, 640, 1024, 1920]"
 *      [alt]="'Product image'">
 * ```
 */
@Directive({
  selector: 'img[appResponsiveImage]',
  standalone: true
})
export class ResponsiveImageDirective implements OnInit {
  @Input() baseSrc!: string;
  @Input() sizes: number[] = [320, 640, 1024, 1920];
  @Input() format: 'webp' | 'jpg' | 'png' = 'webp';

  constructor(
    private el: ElementRef<HTMLImageElement>,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    const srcset = this.generateSrcset();
    this.renderer.setAttribute(this.el.nativeElement, 'srcset', srcset);

    // Set sizes attribute for responsive sizing
    const sizesAttr = this.generateSizesAttr();
    this.renderer.setAttribute(this.el.nativeElement, 'sizes', sizesAttr);
  }

  private generateSrcset(): string {
    return this.sizes.map(size => `${this.getImageUrl(size)} ${size}w`).join(', ');
  }

  private getImageUrl(width: number): string {
    // Replace extension with format
    const ext = this.baseSrc.split('.').pop();
    const base = this.baseSrc.replace(`.${ext}`, '');
    return `${base}_${width}w.${this.format}`;
  }

  private generateSizesAttr(): string {
    // Default responsive sizes
    return '(max-width: 320px) 320px, (max-width: 640px) 640px, (max-width: 1024px) 1024px, 1920px';
  }
}

/**
 * WebP Support Directive
 *
 * Automatically uses WebP format with fallback
 *
 * @example
 * ```html
 * <picture>
 *   <source appWebPSupport [src]="'image.jpg'">
 *   <img [src]="'image.jpg'" alt="Image">
 * </picture>
 * ```
 */
@Directive({
  selector: 'source[appWebPSupport]',
  standalone: true
})
export class WebPSupportDirective implements OnInit {
  @Input() src!: string;

  constructor(
    private el: ElementRef<HTMLSourceElement>,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    // Convert to WebP URL
    const webpSrc = this.src.replace(/\.(jpg|jpeg|png)$/i, '.webp');

    this.renderer.setAttribute(this.el.nativeElement, 'srcset', webpSrc);
    this.renderer.setAttribute(this.el.nativeElement, 'type', 'image/webp');
  }
}
