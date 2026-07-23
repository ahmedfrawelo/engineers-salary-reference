export type OverlayCloseEventKind = 'pointerdown' | 'click';

export type OverlayCloseEventState = {
  handledByPointer: boolean;
};

export type OverlayCloseEventResult = {
  emitClose: boolean;
  state: OverlayCloseEventState;
};

export function resolveOverlayCloseEvent(
  state: OverlayCloseEventState,
  kind: OverlayCloseEventKind,
  button = 0
): OverlayCloseEventResult {
  if (kind === 'pointerdown') {
    if (button !== 0) {
      return { emitClose: false, state };
    }

    return {
      emitClose: true,
      state: { handledByPointer: true }
    };
  }

  if (state.handledByPointer) {
    return {
      emitClose: false,
      state: { handledByPointer: false }
    };
  }

  return {
    emitClose: true,
    state: { handledByPointer: false }
  };
}
