import { describe, expect, it } from 'vitest';

import { resolveOverlayCloseEvent, type OverlayCloseEventState } from './overlay-panel-close.util';

describe('resolveOverlayCloseEvent', () => {
  it('closes on primary pointerdown and suppresses the following click', () => {
    let state: OverlayCloseEventState = { handledByPointer: false };

    const pointerResult = resolveOverlayCloseEvent(state, 'pointerdown', 0);
    state = pointerResult.state;
    const clickResult = resolveOverlayCloseEvent(state, 'click');

    expect(pointerResult.emitClose).toBe(true);
    expect(clickResult.emitClose).toBe(false);
    expect(clickResult.state.handledByPointer).toBe(false);
  });

  it('keeps click close behavior when pointerdown did not handle the close', () => {
    const state: OverlayCloseEventState = { handledByPointer: false };

    const clickResult = resolveOverlayCloseEvent(state, 'click');

    expect(clickResult.emitClose).toBe(true);
    expect(clickResult.state.handledByPointer).toBe(false);
  });

  it('ignores non-primary pointerdown', () => {
    const state: OverlayCloseEventState = { handledByPointer: false };

    const pointerResult = resolveOverlayCloseEvent(state, 'pointerdown', 2);

    expect(pointerResult.emitClose).toBe(false);
    expect(pointerResult.state).toBe(state);
  });
});
