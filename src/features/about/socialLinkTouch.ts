// Safari can consume the compatibility click when a tap reveals the linked
// portrait highlight. Activate completed taps directly, keeping the visual
// pointer handlers and the anchor's normal keyboard/mouse behavior intact.
export function bindSocialLinkTouch(link: HTMLAnchorElement) {
  let tap: { id: number; x: number; y: number; started: number } | null = null;
  const cancel = () => {
    tap = null;
  };
  const start = (event: TouchEvent) => {
    cancel();
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    tap = {
      id: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      started: event.timeStamp,
    };
  };
  const move = (event: TouchEvent) => {
    if (!tap) return;
    const touch = Array.from(event.touches).find(
      (t) => t.identifier === tap?.id
    );
    if (
      event.touches.length !== 1 ||
      !touch ||
      Math.hypot(touch.clientX - tap.x, touch.clientY - tap.y) > 10
    ) {
      cancel();
    }
  };
  const end = (event: TouchEvent) => {
    const completed = tap;
    cancel();
    if (!completed || event.touches.length || !event.cancelable) return;
    const touch = Array.from(event.changedTouches).find(
      (t) => t.identifier === completed.id
    );
    if (
      !touch ||
      event.timeStamp - completed.started > 500 ||
      Math.hypot(touch.clientX - completed.x, touch.clientY - completed.y) > 10
    ) {
      return;
    }
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target || !link.contains(target)) return;
    // A non-passive native listener is required: React delegates touchend
    // passively. Suppress the compatibility click to avoid opening two tabs.
    event.preventDefault();
    link.click();
  };
  link.addEventListener('touchstart', start, { passive: true });
  link.addEventListener('touchmove', move, { passive: true });
  link.addEventListener('touchend', end, { passive: false });
  link.addEventListener('touchcancel', cancel);
  link.addEventListener('contextmenu', cancel);
  return () => {
    link.removeEventListener('touchstart', start);
    link.removeEventListener('touchmove', move);
    link.removeEventListener('touchend', end);
    link.removeEventListener('touchcancel', cancel);
    link.removeEventListener('contextmenu', cancel);
  };
}
