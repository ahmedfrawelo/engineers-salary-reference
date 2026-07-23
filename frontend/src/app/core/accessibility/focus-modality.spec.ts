import { afterEach, describe, expect, it } from 'vitest';
import {
  installFocusModality,
  isKeyboardNavigationKey,
  isModifierOrCaptureKey
} from './focus-modality';

describe('focus modality', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    document.body.replaceChildren();
  });

  it('treats navigation keys as keyboard intent but ignores capture shortcuts', () => {
    expect(isKeyboardNavigationKey(new KeyboardEvent('keydown', { key: 'Tab' }))).toBe(true);
    expect(
      isKeyboardNavigationKey(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))
    ).toBe(true);
    expect(isKeyboardNavigationKey(new KeyboardEvent('keydown', { key: 'Shift' }))).toBe(false);
    expect(
      isKeyboardNavigationKey(
        new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true })
      )
    ).toBe(false);
    expect(isModifierOrCaptureKey(new KeyboardEvent('keydown', { key: 'PrintScreen' }))).toBe(true);
  });

  it('clears stale pointer focus when Shift, Control, or PrintScreen is pressed', () => {
    cleanup = installFocusModality(document);
    const button = document.createElement('button');
    document.body.append(button);

    for (const event of [
      new KeyboardEvent('keydown', { key: 'Shift' }),
      new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }),
      new KeyboardEvent('keydown', { key: 'PrintScreen' })
    ]) {
      button.focus();
      document.dispatchEvent(event);
      expect(document.activeElement).toBe(document.body);
      expect(document.documentElement.classList.contains('suppress-pointer-hover')).toBe(true);
      document.dispatchEvent(new PointerEvent('pointermove'));
    }
  });

  it('suppresses stale hover until the next pointer action', () => {
    cleanup = installFocusModality(document);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    expect(document.documentElement.classList.contains('suppress-pointer-hover')).toBe(true);

    document.dispatchEvent(new PointerEvent('pointermove'));
    expect(document.documentElement.classList.contains('suppress-pointer-hover')).toBe(false);
  });

  it('preserves focus after genuine keyboard navigation', () => {
    cleanup = installFocusModality(document);
    const button = document.createElement('button');
    document.body.append(button);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    button.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));

    expect(document.documentElement.classList.contains('keyboard-navigation')).toBe(true);
    expect(document.documentElement.classList.contains('suppress-pointer-hover')).toBe(true);
    expect(document.activeElement).toBe(button);
  });

  it('never blurs editable controls while a modifier is used', () => {
    cleanup = installFocusModality(document);
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));

    expect(document.activeElement).toBe(input);
  });
});
