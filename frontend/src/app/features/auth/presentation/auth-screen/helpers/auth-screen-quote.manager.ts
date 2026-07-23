import { WritableSignal, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

type LooseValue = ReturnType<typeof JSON.parse>;
type QuoteLanguage = 'ar' | 'en';

export class AuthScreenQuoteManager {
  readonly displayQuote: WritableSignal<string> = signal('');
  readonly quoteVisible: WritableSignal<boolean> = signal(true);

  private readonly maxLength = 220;
  private readonly fallbackQuotesEn = [
    'Excellence is a system, not a mood.',
    'Build once, reuse everywhere.',
    'Secure by default, fast by design.',
    'Quality is a habit.',
    'Small steady steps beat big stalled plans.'
  ];
  private readonly fallbackQuotesAr = [
    'نعمل بالممكن ولا ننسى الطموح.',
    'الجودة عادة يومية وليست وعدا مؤجلا.',
    'من ضبط التفاصيل امتلك النتيجة.',
    'الثقة تبنى بالوضوح والانضباط.',
    'كل نظام قوي يبدأ من قرار صغير صحيح.'
  ];
  private localQuotesEn = [...this.fallbackQuotesEn];
  private localQuotesAr = [...this.fallbackQuotesAr];
  private localQuoteIdxEn = Math.floor(Math.random() * this.localQuotesEn.length);
  private localQuoteIdxAr = Math.floor(Math.random() * this.localQuotesAr.length);
  private quoteCooldownUntil = 0;
  private quoteInFlight = false;
  private nextLang: QuoteLanguage = Math.random() < 0.5 ? 'ar' : 'en';
  private typeTimer?: number;
  private cycleTimer?: number;

  constructor(private readonly translate: TranslateService) {}

  async init(): Promise<void> {
    await this.loadLocalQuotes();
    await this.refresh();
    this.startCycle();
  }

  destroy(): void {
    if (this.typeTimer) {
      clearInterval(this.typeTimer);
    }
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
    }
  }

  private startCycle(): void {
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
    }

    this.cycleTimer = window.setInterval(() => {
      void this.refresh();
    }, 13_000);
  }

  private async refresh(): Promise<void> {
    const now = Date.now();
    if (this.quoteInFlight || now < this.quoteCooldownUntil) {
      return;
    }

    this.quoteInFlight = true;
    try {
      const lang = this.nextLang;
      this.nextLang = lang === 'ar' ? 'en' : 'ar';

      let text = await this.resolveQuote(lang);
      if (!text) {
        const fallbackLang = lang === 'ar' ? 'en' : 'ar';
        text = await this.resolveQuote(fallbackLang);
      }
      if (!text) {
        return;
      }

      this.quoteVisible.set(false);
      setTimeout(() => {
        this.typewrite(text);
        this.quoteVisible.set(true);
      }, 220);
    } finally {
      this.quoteInFlight = false;
    }
  }

  private typewrite(fullText: string): void {
    if (this.typeTimer) {
      clearInterval(this.typeTimer);
    }

    this.displayQuote.set('');
    const chars = [...fullText];
    let index = 0;

    const step = () => {
      const delay = Math.max(12, 26 - Math.min(chars.length, 140) / 8);
      this.displayQuote.update(value => value + chars[index]);
      index += 1;

      if (index >= chars.length) {
        if (this.typeTimer) {
          clearInterval(this.typeTimer);
          this.typeTimer = undefined;
        }
        return;
      }

      this.typeTimer = window.setInterval(() => {
        if (this.typeTimer) {
          clearInterval(this.typeTimer);
        }
        step();
      }, delay);
    };

    step();
  }

  private async resolveQuote(lang: QuoteLanguage): Promise<string | null> {
    const remote = await this.fetchRemote(lang);
    if (remote) {
      return this.sanitizeQuote(remote);
    }

    return this.pickLocalQuote(lang);
  }

  private async fetchRemote(lang: QuoteLanguage): Promise<string | null> {
    try {
      const payload = await this.safeFetchJson(`/api/Quotes/random?language=${lang}`);
      const quote = payload?.data ?? payload?.payload ?? payload?.result ?? payload;
      const text = typeof quote?.text === 'string' ? quote.text : quote?.quote;
      const author = typeof quote?.author === 'string' ? quote.author : '';
      if (typeof text !== 'string' || !text.trim()) {
        return null;
      }

      return author ? `${text.trim()} - ${author.trim()}` : text.trim();
    } catch {
      return null;
    }
  }

  private pickLocalQuote(lang: QuoteLanguage): string | null {
    const list = lang === 'ar' ? this.localQuotesAr : this.localQuotesEn;
    if (!list.length) {
      return null;
    }

    if (lang === 'ar') {
      const quote = list[this.localQuoteIdxAr % list.length];
      this.localQuoteIdxAr += 1;
      return this.sanitizeQuote(quote);
    }

    const quote = list[this.localQuoteIdxEn % list.length];
    this.localQuoteIdxEn += 1;
    return this.sanitizeQuote(quote);
  }

  private sanitizeQuote(value: string): string {
    let text = (value ?? '')
      .replace(/<[^>]*>/g, '')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim();

    if (text.length > this.maxLength) {
      text = `${text.slice(0, this.maxLength - 1)}...`;
    }

    return text;
  }

  private async loadLocalQuotes(): Promise<void> {
    try {
      if (!this.translate.currentLoader?.getTranslation) {
        return;
      }

      const [english, arabic] = await Promise.all([
        firstValueFrom(this.translate.currentLoader.getTranslation('en')),
        firstValueFrom(this.translate.currentLoader.getTranslation('ar'))
      ]);

      const englishQuotes = this.readQuotes(english);
      const arabicQuotes = this.readQuotes(arabic);

      if (englishQuotes.length) {
        this.localQuotesEn = englishQuotes;
      }
      if (arabicQuotes.length) {
        this.localQuotesAr = arabicQuotes;
      }
    } catch {
      this.localQuotesEn = this.fallbackQuotesEn;
      this.localQuotesAr = this.fallbackQuotesAr;
    }
  }

  private readQuotes(source: unknown): string[] {
    const auth = (source as { auth?: { quotes?: unknown } })?.auth;
    const quotes = auth?.quotes;
    if (!Array.isArray(quotes)) {
      return [];
    }

    return quotes.map(quote => String(quote).trim()).filter(Boolean);
  }

  private async safeFetchJson(url: string, timeoutMs = 6000): Promise<LooseValue> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) {
        const error: LooseValue = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return response.json();
    } finally {
      clearTimeout(timer);
    }
  }
}
