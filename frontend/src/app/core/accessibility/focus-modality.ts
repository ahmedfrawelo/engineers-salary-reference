const KEYBOARD_NAVIGATION_KEYS = new Set([
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Enter',
  ' ',
  'Escape',
  'F6'
]);

const MODIFIER_AND_CAPTURE_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'AltGraph',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'PrintScreen'
]);

const POINTER_FOCUS_TARGET = [
  'a[href]',
  'button',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export function isKeyboardNavigationKey(event: KeyboardEvent): boolean {
  if (!KEYBOARD_NAVIGATION_KEYS.has(event.key)) {
    return false;
  }

  // Shift+Tab is navigation. Other Ctrl/Alt/Meta combinations are shortcuts,
  // not a reason to expose a stale pointer focus ring.
  return !event.ctrlKey && !event.altKey && !event.metaKey;
}

export function isModifierOrCaptureKey(event: KeyboardEvent): boolean {
  return MODIFIER_AND_CAPTURE_KEYS.has(event.key) || event.ctrlKey || event.altKey || event.metaKey;
}

export function isPointerFocusableControl(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement) || !element.matches(POINTER_FOCUS_TARGET)) {
    return false;
  }

  return !element.matches('input, textarea, select, [contenteditable="true"]');
}

export function installFocusModality(documentRef: Document): () => void {
  const root = documentRef.documentElement;
  let keyboardNavigation = false;

  const setKeyboardNavigation = (enabled: boolean): void => {
    keyboardNavigation = enabled;
    root.classList.toggle('keyboard-navigation', enabled);
  };

  const setPointerHoverSuppressed = (suppressed: boolean): void => {
    root.classList.toggle('suppress-pointer-hover', suppressed);
  };

  const onPointerActivity = (): void => {
    setKeyboardNavigation(false);
    setPointerHoverSuppressed(false);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (isKeyboardNavigationKey(event)) {
      setKeyboardNavigation(true);
      setPointerHoverSuppressed(false);
      return;
    }

    if (isModifierOrCaptureKey(event)) {
      setPointerHoverSuppressed(true);
      if (!keyboardNavigation && isPointerFocusableControl(documentRef.activeElement)) {
        documentRef.activeElement.blur();
      }
    }
  };

  documentRef.addEventListener('pointerdown', onPointerActivity, true);
  documentRef.addEventListener('pointermove', onPointerActivity, true);
  documentRef.addEventListener('keydown', onKeyDown, true);

  return () => {
    documentRef.removeEventListener('pointerdown', onPointerActivity, true);
    documentRef.removeEventListener('pointermove', onPointerActivity, true);
    documentRef.removeEventListener('keydown', onKeyDown, true);
    root.classList.remove('keyboard-navigation');
    root.classList.remove('suppress-pointer-hover');
  };
}
