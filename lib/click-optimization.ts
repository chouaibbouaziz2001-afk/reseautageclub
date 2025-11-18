export function optimizeClick(callback: () => void) {
  return () => {
    requestAnimationFrame(() => {
      callback();
    });
  };
}

export function optimizeAsyncClick(callback: () => Promise<void>) {
  return async () => {
    await callback();
  };
}

export function preventDoubleClick(callback: () => void, delay: number = 300) {
  let lastClick = 0;
  return () => {
    const now = Date.now();
    if (now - lastClick > delay) {
      lastClick = now;
      callback();
    }
  };
}

export function addClickFeedback(element: HTMLElement) {
  element.style.transition = 'transform 0.05s ease-out, opacity 0.05s ease-out';

  const handleDown = () => {
    element.style.transform = 'scale(0.97)';
    element.style.opacity = '0.9';
  };

  const handleUp = () => {
    element.style.transform = 'scale(1)';
    element.style.opacity = '1';
  };

  element.addEventListener('mousedown', handleDown);
  element.addEventListener('mouseup', handleUp);
  element.addEventListener('mouseleave', handleUp);
  element.addEventListener('touchstart', handleDown, { passive: true });
  element.addEventListener('touchend', handleUp, { passive: true });
  element.addEventListener('touchcancel', handleUp, { passive: true });

  return () => {
    element.removeEventListener('mousedown', handleDown);
    element.removeEventListener('mouseup', handleUp);
    element.removeEventListener('mouseleave', handleUp);
    element.removeEventListener('touchstart', handleDown);
    element.removeEventListener('touchend', handleUp);
    element.removeEventListener('touchcancel', handleUp);
  };
}

export function disableIOSDoubleTapZoom() {
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
}
