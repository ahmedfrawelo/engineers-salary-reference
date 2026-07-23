import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * SEO Configuration per Route
 */
export interface RouteSeoConfig {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
}

/**
 * Advanced SEO Service
 *
 * Features:
 * - Dynamic meta tags per route
 * - Open Graph tags
 * - Twitter Cards
 * - Structured Data (JSON-LD)
 * - Sitemap generation
 * - Canonical URLs
 *
 * @example
 * ```typescript
 * constructor(private seo: AdvancedSeoService) {}
 *
 * ngOnInit() {
 *   this.seo.updateRouteMeta({
 *     title: 'Suppliers - ENGINEERS_SALARY_REFERENCE Portal',
 *     description: 'Manage your suppliers efficiently',
 *     keywords: 'suppliers, procurement, ENGINEERS_SALARY_REFERENCE',
 *     image: 'https://engineers-salary-reference.sa/images/suppliers.jpg'
 *   });
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class AdvancedSeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private router = inject(Router);

  private readonly baseUrl = 'https://engineers-salary-reference.sa'; // ⚠️ Update with your domain
  private readonly siteName = 'ENGINEERS_SALARY_REFERENCE Portal';
  private readonly defaultImage = 'https://engineers-salary-reference.sa/images/og-default.jpg'; // ⚠️ Add default image

  constructor() {
    this.initRouteChangeTracking();
  }

  /**
   * Update meta tags for current route
   */
  updateRouteMeta(config: RouteSeoConfig): void {
    const fullUrl = config.url || this.getFullUrl();
    const image = config.image || this.defaultImage;

    // Update title
    this.title.setTitle(config.title);

    // Update standard meta tags
    this.meta.updateTag({ name: 'description', content: config.description });
    if (config.keywords) {
      this.meta.updateTag({ name: 'keywords', content: config.keywords });
    }
    if (config.author) {
      this.meta.updateTag({ name: 'author', content: config.author });
    }

    // Update Open Graph tags
    this.meta.updateTag({ property: 'og:title', content: config.title });
    this.meta.updateTag({ property: 'og:description', content: config.description });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:url', content: fullUrl });
    this.meta.updateTag({ property: 'og:type', content: config.type || 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: this.siteName });

    // Update Twitter Card tags
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: config.title });
    this.meta.updateTag({ name: 'twitter:description', content: config.description });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    // Article-specific tags
    if (config.type === 'article') {
      if (config.publishedTime) {
        this.meta.updateTag({ property: 'article:published_time', content: config.publishedTime });
      }
      if (config.modifiedTime) {
        this.meta.updateTag({ property: 'article:modified_time', content: config.modifiedTime });
      }
      if (config.section) {
        this.meta.updateTag({ property: 'article:section', content: config.section });
      }
      if (config.tags) {
        config.tags.forEach(tag => {
          this.meta.addTag({ property: 'article:tag', content: tag });
        });
      }
    }

    // Update canonical URL
    this.updateCanonicalUrl(fullUrl);

    // Update structured data
    this.updateStructuredData(config);
  }

  /**
   * Update canonical URL
   */
  private updateCanonicalUrl(url: string): void {
    let link: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');

    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }

    link.setAttribute('href', url);
  }

  /**
   * Get full URL for current route
   */
  private getFullUrl(): string {
    return `${this.baseUrl}${this.router.url}`;
  }

  /**
   * Update structured data (JSON-LD)
   */
  private updateStructuredData(config: RouteSeoConfig): void {
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': config.type === 'article' ? 'Article' : 'WebPage',
      name: config.title,
      description: config.description,
      url: config.url || this.getFullUrl(),
      image: config.image || this.defaultImage,
      publisher: {
        '@type': 'Organization',
        name: this.siteName,
        url: this.baseUrl
      }
    };

    // Add article-specific fields
    if (config.type === 'article') {
      Object.assign(structuredData, {
        headline: config.title,
        datePublished: config.publishedTime,
        dateModified: config.modifiedTime,
        author: {
          '@type': 'Person',
          name: config.author || 'ENGINEERS_SALARY_REFERENCE Team'
        }
      });
    }

    this.insertStructuredData(structuredData);
  }

  /**
   * Insert structured data script tag
   */
  private insertStructuredData(data: LooseValue): void {
    // Remove existing structured data
    const existing = document.querySelector('script[type="application/ld+json"]');
    if (existing) {
      existing.remove();
    }

    // Create new structured data script
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    document.head.appendChild(script);
  }

  /**
   * Initialize route change tracking
   */
  private initRouteChangeTracking(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => this.router.url)
      )
      .subscribe(url => {
        // Update meta tags based on route data
        this.updateMetaFromRoute();
      });
  }

  /**
   * Update meta tags from route data
   */
  private updateMetaFromRoute(): void {
    // This would read from route.data.seo if configured
    // For now, components should call updateRouteMeta manually
  }

  /**
   * Generate sitemap (for server-side generation)
   */
  generateSitemap(routes: { path: string; priority: number; changefreq: string }[]): string {
    const urlset = routes
      .map(
        route => `
  <url>
    <loc>${this.baseUrl}${route.path}</loc>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
    <lastmod>${new Date().toISOString()}</lastmod>
  </url>`
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlset}
</urlset>`;
  }

  /**
   * Set language meta tag
   */
  setLanguage(lang: 'ar' | 'en'): void {
    this.meta.updateTag({ name: 'language', content: lang });
    this.meta.updateTag({ property: 'og:locale', content: lang === 'ar' ? 'ar_SA' : 'en_US' });
  }

  /**
   * Set robots meta tag
   */
  setRobots(index: boolean, follow: boolean): void {
    const content = `${index ? 'index' : 'noindex'}, ${follow ? 'follow' : 'nofollow'}`;
    this.meta.updateTag({ name: 'robots', content });
  }
}
