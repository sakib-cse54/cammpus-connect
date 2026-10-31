import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Active trap stack to properly handle nested dialogs/drawers. */
const activeTrapStack: HTMLElement[] = [];

function isVisible(el: HTMLElement): boolean {
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({ checkVisibilityCSS: true });
  }
  return el.offsetParent !== null || (typeof window !== 'undefined' && window.getComputedStyle(el).display !== 'none');
}

/**
 * While active: moves focus into the container, keeps Tab/Shift+Tab inside it,
 * calls onEscape on Escape, and restores focus to the previously focused element on exit.
 * Manages an active trap stack so nested dialogs close in reverse order without interference.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void): void {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    activeTrapStack.push(container);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const items = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => isVisible(el) || el === document.activeElement
      );

    const first = items()[0];
    (first ?? container).focus();

    const onKey = (e: KeyboardEvent) => {
      // Only the topmost active trap handles keyboard events
      if (activeTrapStack[activeTrapStack.length - 1] !== container) return;

      if (e.key === 'Escape' && onEscapeRef.current) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onEscapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === firstEl || !container.contains(document.activeElement))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const idx = activeTrapStack.lastIndexOf(container);
      if (idx !== -1) activeTrapStack.splice(idx, 1);
      if (previous && document.contains(previous)) previous.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ref]);
}
