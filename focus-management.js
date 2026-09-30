export function captureInteractiveFocus(activeElement, dayTabs, timeline) {
  if (!activeElement?.closest) return null;

  const dayButton = activeElement.closest('[data-day-id]');
  if (dayButton && dayTabs.contains(dayButton)) {
    return { kind: 'day', id: dayButton.dataset.dayId };
  }

  const stopItem = activeElement.closest('[data-stop-id]');
  if (stopItem && timeline.contains(stopItem)) {
    return { kind: 'stop', id: stopItem.dataset.stopId };
  }

  return null;
}

export function restoreInteractiveFocus(token, dayTabs, timeline) {
  if (!token) return false;

  const root = token.kind === 'day' ? dayTabs : timeline;
  const attribute = token.kind === 'day' ? 'data-day-id' : 'data-stop-id';
  const suffix = token.kind === 'stop' ? ' .timeline-button' : '';
  const control = root.querySelector(`[${attribute}="${token.id}"]${suffix}`);
  if (!control?.focus) return false;

  control.focus({ preventScroll: true });
  return true;
}
