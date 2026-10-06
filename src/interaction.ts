// Closing a saved form must not send the next rapid tap into the list beneath it.
export function guardSaveClickThrough(rect: DOMRect) {
  const stop = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (event.detail > 1 && target?.closest('main, .sidebar, .mobile-nav, .mobile-add') && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  document.addEventListener('click', stop, true);
  window.setTimeout(() => document.removeEventListener('click', stop, true), 350);
}

