import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

@Directive({
  selector: '[floatingOutlineLabel]',
  standalone: true
})
export class FloatingOutlineLabelDirective implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly host = this.elementRef.nativeElement;
  private readonly observer =
    typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.updateMetrics()) : null;

  ngAfterViewInit(): void {
    this.updateMetrics();
    this.observer?.observe(this.host);
    const label = this.getLabel();
    if (label) {
      this.observer?.observe(label);
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private updateMetrics(): void {
    const label = this.getLabel();
    if (!label) {
      return;
    }

    const rect = label.getBoundingClientRect();
    const hostRect = this.host.getBoundingClientRect();
    const left = Math.max(0, rect.left - hostRect.left);
    const width = Math.max(0, rect.width + 12);

    this.host.style.setProperty('--label-x', `${left}px`);
    this.host.style.setProperty('--label-w', `${width}px`);
  }

  private getLabel(): HTMLElement | null {
    return this.host.querySelector('.field-legend') as HTMLElement | null;
  }
}
