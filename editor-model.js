export const EDIT_STORAGE_KEY = 'kyoto-osaka-trip-map:edits:v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeHttpsUrl(value) {
  const text = cleanText(value);
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function coordinatesFromDraft(draft) {
  const latitudeText = cleanText(draft.latitude);
  const longitudeText = cleanText(draft.longitude);
  if (!latitudeText || !longitudeText) return undefined;

  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return undefined;
  return [latitude, longitude];
}

function applyDraft(base, draft, id) {
  const name = cleanText(draft.name);
  if (!name) throw new Error('请输入地点或项目名称');

  const stop = {
    ...base,
    id,
    time: cleanText(draft.time),
    name,
    type: base.type || 'custom',
    summary: cleanText(draft.summary),
    detail: cleanText(draft.detail),
  };

  const coordinates = coordinatesFromDraft(draft);
  if (coordinates) stop.coordinates = coordinates;
  else delete stop.coordinates;

  for (const key of ['officialUrl', 'navigationUrl']) {
    const url = safeHttpsUrl(draft[key]);
    if (url) stop[key] = url;
    else delete stop[key];
  }

  return stop;
}

function mutateDay(days, dayId, callback) {
  const next = clone(days);
  const day = next.find((candidate) => candidate.id === dayId);
  if (!day) return next;
  callback(day);
  return next;
}

export function insertStopAfter(days, dayId, afterStopId, draft, requestedId) {
  return mutateDay(days, dayId, (day) => {
    const existingIds = new Set(day.stops.map((stop) => stop.id));
    let id = requestedId || `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    while (existingIds.has(id)) id = `${id}-new`;

    const stop = applyDraft({}, draft, id);
    const stopIndex = day.stops.findIndex((candidate) => candidate.id === afterStopId);
    const routeIndex = day.route.indexOf(afterStopId);
    day.stops.splice(stopIndex >= 0 ? stopIndex + 1 : day.stops.length, 0, stop);
    day.route.splice(routeIndex >= 0 ? routeIndex + 1 : day.route.length, 0, id);
  });
}

export function updateStop(days, dayId, stopId, draft) {
  return mutateDay(days, dayId, (day) => {
    const index = day.stops.findIndex((stop) => stop.id === stopId);
    if (index < 0) return;
    day.stops[index] = applyDraft(day.stops[index], draft, stopId);
  });
}

export function deleteStop(days, dayId, stopId) {
  return mutateDay(days, dayId, (day) => {
    day.stops = day.stops.filter((stop) => stop.id !== stopId);
    day.route = day.route.filter((id) => id !== stopId);
  });
}

export function serializeItinerary(days, updatedAt = new Date().toISOString()) {
  return JSON.stringify({ version: 1, updatedAt, days }, null, 2);
}

export function parseSavedItinerary(raw, fallbackDays) {
  const fallback = clone(fallbackDays);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed.days)) return fallback;
    if (parsed.days.length !== fallbackDays.length) return fallback;
    const expectedIds = fallbackDays.map((day) => day.id);
    const actualIds = parsed.days.map((day) => day?.id);
    if (expectedIds.some((id, index) => id !== actualIds[index])) return fallback;
    if (parsed.days.some((day) => !Array.isArray(day.stops) || !Array.isArray(day.route))) return fallback;
    return clone(parsed.days);
  } catch {
    return fallback;
  }
}
