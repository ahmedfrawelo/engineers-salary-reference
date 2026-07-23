type PointerPosition = { x: number; y: number };

export class AuthScreenVisualsManager {
  private targetX = 50;
  private targetY = 40;
  private currentX = 50;
  private currentY = 40;
  private parallaxId = 0;
  private snowId = 0;
  private windX = 0;
  private windTimer?: number;
  private visualsPaused = false;
  private back?: CanvasRenderingContext2D;
  private front?: CanvasRenderingContext2D;
  private flakesBack: Array<{ x: number; y: number; r: number; s: number; a: number }> = [];
  private flakesFront: Array<{ x: number; y: number; r: number; s: number; a: number }> = [];

  constructor(
    private readonly host: HTMLElement,
    private readonly isLightTheme: () => boolean,
    private readonly prefersReducedMotion: () => boolean
  ) {}

  start(): void {
    if (this.prefersReducedMotion()) {
      this.visualsPaused = true;
      return;
    }

    this.parallaxId = requestAnimationFrame(this.tickParallax);
    this.setupCanvas();
    window.addEventListener('resize', this.onResize);
    this.snowId = requestAnimationFrame(this.tickSnow);
    this.windTimer = window.setInterval(() => {
      if (this.shouldPause()) {
        return;
      }
      this.windX = (Math.random() * 2 - 1) * 0.06;
    }, 6000);
  }

  destroy(): void {
    cancelAnimationFrame(this.parallaxId);
    cancelAnimationFrame(this.snowId);
    window.removeEventListener('resize', this.onResize);
    if (this.windTimer) {
      clearInterval(this.windTimer);
    }
  }

  updatePointer(position: PointerPosition): void {
    this.targetX = position.x;
    this.targetY = position.y;
  }

  setPaused(paused: boolean): void {
    this.visualsPaused = paused;
  }

  onThemeChange(): void {
    this.setupCanvas();
  }

  private shouldPause(): boolean {
    return this.visualsPaused || this.prefersReducedMotion();
  }

  private readonly onResize = () => this.setupCanvas();

  private readonly tickParallax = () => {
    if (this.shouldPause()) {
      this.parallaxId = requestAnimationFrame(this.tickParallax);
      return;
    }

    this.currentX += (this.targetX - this.currentX) * 0.07;
    this.currentY += (this.targetY - this.currentY) * 0.07;
    this.host.style.setProperty('--mx', `${this.currentX.toFixed(1)}%`);
    this.host.style.setProperty('--my', `${this.currentY.toFixed(1)}%`);
    this.parallaxId = requestAnimationFrame(this.tickParallax);
  };

  private readonly tickSnow = () => {
    if (this.shouldPause()) {
      this.snowId = requestAnimationFrame(this.tickSnow);
      return;
    }

    if (this.back) {
      this.drawLayer(this.back, this.flakesBack);
    }
    if (this.front) {
      this.drawLayer(this.front, this.flakesFront);
    }

    this.snowId = requestAnimationFrame(this.tickSnow);
  };

  private setupCanvas(): void {
    const backCanvas = this.host.querySelector('canvas.snow.back') as HTMLCanvasElement | null;
    const frontCanvas = this.host.querySelector('canvas.snow.front') as HTMLCanvasElement | null;
    if (!backCanvas || !frontCanvas) {
      return;
    }

    const rect = this.host.getBoundingClientRect();
    const width = Math.round(rect.width || window.innerWidth);
    const height = Math.round(rect.height || window.innerHeight);

    backCanvas.width = frontCanvas.width = width;
    backCanvas.height = frontCanvas.height = height;

    this.back = backCanvas.getContext('2d') ?? undefined;
    this.front = frontCanvas.getContext('2d') ?? undefined;
    if (!this.back || !this.front) {
      return;
    }

    const pixels = width * height;
    const isLight = this.isLightTheme();
    const backCount = Math.min(220, Math.round(pixels * (isLight ? 0.00009 : 0.00007)));
    const frontCount = Math.min(340, Math.round(pixels * (isLight ? 0.00014 : 0.00011)));

    const createFlake = (speed: number, radiusBase: number, radiusRange: number) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: radiusBase + Math.random() * radiusRange,
      s: speed * (0.6 + Math.random() * 0.8),
      a: Math.random() * Math.PI * 2
    });

    this.flakesBack = Array.from({ length: backCount }).map(() => createFlake(0.28, 0.55, 1.4));
    this.flakesFront = Array.from({ length: frontCount }).map(() => createFlake(0.42, 0.85, 1.9));
  }

  private drawLayer(
    ctx: CanvasRenderingContext2D,
    flakes: Array<{ x: number; y: number; r: number; s: number; a: number }>
  ): void {
    const { width, height } = ctx.canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = this.isLightTheme() ? 'source-over' : 'lighter';

    for (const flake of flakes) {
      flake.a += 0.006;
      flake.y += flake.s;
      flake.x += Math.cos(flake.a) * 0.18 + this.windX;

      if (flake.y > height + 10) {
        flake.y = -10;
        flake.x = Math.random() * width;
      }
      if (flake.x > width + 10) {
        flake.x = -10;
      } else if (flake.x < -10) {
        flake.x = width + 10;
      }

      const inner = this.isLightTheme() ? 'rgba(48,63,84,.75)' : 'rgba(255,255,255,.95)';
      const outer = this.isLightTheme() ? 'rgba(48,63,84,0)' : 'rgba(255,255,255,0)';

      const gradient = ctx.createRadialGradient(flake.x, flake.y, 0, flake.x, flake.y, flake.r * 3);
      gradient.addColorStop(0, inner);
      gradient.addColorStop(1, outer);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.r * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
