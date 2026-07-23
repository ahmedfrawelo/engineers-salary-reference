import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingOutlineLabelDirective } from './floating-outline-label.directive';

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(): void {
    this.callback([], this as unknown as ResizeObserver);
  }

  disconnect(): void {}

  unobserve(): void {}
}

@Component({
  standalone: true,
  imports: [FloatingOutlineLabelDirective],
  template: `
    <div floatingOutlineLabel class="field">
      <label class="field-legend">Email</label>
    </div>
  `
})
class FloatingOutlineLabelDirectiveHostComponent {}

describe('FloatingOutlineLabelDirective', () => {
  let fixture: ComponentFixture<FloatingOutlineLabelDirectiveHostComponent>;
  let previousResizeObserver: typeof ResizeObserver | undefined;

  beforeEach(async () => {
    previousResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

    await TestBed.configureTestingModule({
      imports: [FloatingOutlineLabelDirectiveHostComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FloatingOutlineLabelDirectiveHostComponent);
  });

  it('publishes label metrics for the outline notch', () => {
    const host = fixture.nativeElement.querySelector('.field') as HTMLElement;
    const label = fixture.nativeElement.querySelector('.field-legend') as HTMLElement;

    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(
      createDomRect({ left: 10, width: 180, height: 56 })
    );
    vi.spyOn(label, 'getBoundingClientRect').mockReturnValue(
      createDomRect({ left: 34, width: 44, height: 16 })
    );

    fixture.detectChanges();

    expect(host.style.getPropertyValue('--label-x')).toBe('24px');
    expect(host.style.getPropertyValue('--label-w')).toBe('56px');
  });

  afterEach(() => {
    globalThis.ResizeObserver = previousResizeObserver as typeof ResizeObserver;
  });
});

function createDomRect({
  left = 0,
  top = 0,
  width = 0,
  height = 0
}: Partial<DOMRect> = {}): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({})
  } as DOMRect;
}
