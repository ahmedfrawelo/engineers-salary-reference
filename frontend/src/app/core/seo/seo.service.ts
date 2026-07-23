import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

type LooseValue = ReturnType<typeof JSON.parse>;
export interface SeoConfig {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
}

/**
 * SEO Service
 *
 * خدمة تحسين محركات البحث (SEO)
 * تدير Meta Tags, Open Graph, Twitter Cards, Structured Data
 *
 * @example
 * ```typescript
 * constructor(private seo: SeoService) {
 *   this.seo.updateTags({
 *     title: 'عنوان الصفحة',
 *     description: 'وصف الصفحة',
 *     keywords: 'كلمات, مفتاحية'
 *   });
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);

  private readonly defaultConfig: SeoConfig = {
    title: 'ENGINEERS_SALARY_REFERENCE Portal - نظام إدارة المشاريع',
    description: 'نظام شامل لإدارة المشاريع والمناقصات والمشتريات والمخازن',
    keywords: 'إدارة مشاريع, مناقصات, مشتريات, مخازن, ENGINEERS_SALARY_REFERENCE',
    image: '/assets/images/og-image.jpg',
    type: 'website',
    author: 'ENGINEERS_SALARY_REFERENCE'
  };

  constructor() {
    // تحديث SEO عند تغيير الصفحة
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => {
      // يمكن تحديث SEO بناءً على الروت
      // this.updateTagsFromRoute();
    });
  }

  /**
   * Update all SEO tags
   */
  updateTags(config: SeoConfig): void {
    const seoConfig = { ...this.defaultConfig, ...config };

    // Update Title
    if (seoConfig.title) {
      this.title.setTitle(seoConfig.title);
    }

    // Update Standard Meta Tags
    this.updateStandardTags(seoConfig);

    // Update Open Graph Tags
    this.updateOpenGraphTags(seoConfig);

    // Update Twitter Card Tags
    this.updateTwitterCardTags(seoConfig);

    // Update Structured Data
    this.updateStructuredData(seoConfig);
  }

  /**
   * Update standard meta tags
   */
  private updateStandardTags(config: SeoConfig): void {
    const tags = [
      { name: 'description', content: config.description },
      { name: 'keywords', content: config.keywords },
      { name: 'author', content: config.author },
      { name: 'robots', content: 'index, follow' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { 'http-equiv': 'Content-Type', content: 'text/html; charset=utf-8' }
    ];

    tags.forEach(tag => {
      if (typeof tag.content === 'string' && tag.content.trim()) {
        this.meta.updateTag(tag as LooseValue);
      }
    });
  }

  /**
   * Update Open Graph tags (Facebook, LinkedIn, etc.)
   */
  private updateOpenGraphTags(config: SeoConfig): void {
    const url = config.url || window.location.href;

    const ogTags = [
      { property: 'og:title', content: config.title },
      { property: 'og:description', content: config.description },
      { property: 'og:image', content: config.image },
      { property: 'og:url', content: url },
      { property: 'og:type', content: config.type },
      { property: 'og:site_name', content: 'ENGINEERS_SALARY_REFERENCE Portal' },
      { property: 'og:locale', content: 'ar_SA' },
      { property: 'og:locale:alternate', content: 'en_US' }
    ];

    if (config.publishedTime) {
      ogTags.push({ property: 'article:published_time', content: config.publishedTime });
    }

    if (config.modifiedTime) {
      ogTags.push({ property: 'article:modified_time', content: config.modifiedTime });
    }

    ogTags.forEach(tag => {
      const content = tag.content;
      if (typeof content === 'string' && content.trim()) {
        this.meta.updateTag({ ...tag, content });
      }
    });
  }

  /**
   * Update Twitter Card tags
   */
  private updateTwitterCardTags(config: SeoConfig): void {
    const twitterTags = [
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: config.title },
      { name: 'twitter:description', content: config.description },
      { name: 'twitter:image', content: config.image },
      { name: 'twitter:site', content: '@ENGINEERS_SALARY_REFERENCE' }
    ];

    twitterTags.forEach(tag => {
      const content = tag.content;
      if (typeof content === 'string' && content.trim()) {
        this.meta.updateTag({ ...tag, content });
      }
    });
  }

  /**
   * Update Structured Data (JSON-LD)
   */
  private updateStructuredData(config: SeoConfig): void {
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'ENGINEERS_SALARY_REFERENCE Portal',
      description: config.description,
      url: config.url || window.location.href,
      logo: config.image,
      sameAs: [
        // أضف روابط Social Media هنا
      ]
    };

    // إزالة script القديم إن وجد
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    // إضافة script جديد
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }

  /**
   * Set canonical URL
   */
  setCanonicalUrl(url?: string): void {
    const canonicalUrl = url || window.location.href;

    let link: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');

    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }

    link.setAttribute('href', canonicalUrl);
  }

  /**
   * Generate sitemap entry (للاستخدام في sitemap.xml)
   */
  generateSitemapEntry(url: string, priority: number = 0.5, changefreq: string = 'weekly'): string {
    return `
  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }
}
