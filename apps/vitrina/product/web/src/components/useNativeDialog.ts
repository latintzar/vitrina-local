import { useEffect, useRef } from 'react';

// Multiple sheets can stack (basket → clear confirmation). Keep their shared
// scroll container locked until the last native modal has closed.
const locks = new Set<HTMLDialogElement>();
let scrollState: { element: HTMLElement; overflow: string } | null = null;

export function useNativeDialog(open: boolean, returnFocusSelector?: string) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!locks.size) {
      const element = document.getElementById('root') || document.documentElement;
      scrollState = { element, overflow: element.style.overflow };
      element.style.overflow = 'hidden';
    }
    locks.add(dialog);
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-dialog-initial]')?.focus();
    const wrapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented ||
          !(event.target instanceof Element) || event.target.closest('dialog') !== dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex],iframe,video[controls]',
      )].filter((element) => element.tabIndex >= 0 && element.getClientRects().length &&
        getComputedStyle(element).visibility !== 'hidden' && element.closest('dialog') === dialog);
      const target = event.shiftKey && document.activeElement === controls[0] ? controls.at(-1)
        : !event.shiftKey && document.activeElement === controls.at(-1) ? controls[0] : null;
      if (target) { event.preventDefault(); target.focus(); }
    };
    dialog.addEventListener('keydown', wrapFocus);
    return () => {
      dialog.removeEventListener('keydown', wrapFocus);
      if (dialog.open) dialog.close();
      locks.delete(dialog);
      if (!locks.size && scrollState) {
        scrollState.element.style.overflow = scrollState.overflow;
        scrollState = null;
      }
      const target = opener?.isConnected && !dialog.contains(opener) ? opener : returnFocusSelector
        ? document.querySelector<HTMLElement>(returnFocusSelector) : null;
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
  }, [open, returnFocusSelector]);
  return ref;
}
