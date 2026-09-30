export const EDIT_STORAGE_KEY = 'kyoto-osaka-trip-map:edits:v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeHttpsUrl(value, label) {
  const text = cleanText(value);
  if (!text) return '';
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:') throw new Error(`${label}必须使用 https://`);
    return url.toString();
  } catch {
    if (!text.startsWith('https://')) throw new Error(`${label}必须使用 https://`);
    throw new Error(`${label}格式不正确`);
  }
}

function coordinatesFromDraft(draft) {
  const latitudeText = cleanText(draft.latitude);
  const longitudeText = cleanText(draft.longitude);
  if (!latitudeText && !longitudeText) return undefined;
  if (!latitudeText || !longitudeText) throw new Error('纬度和经度需要同时填写');

  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('请输入有效的纬度和经度');
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('纬度或经度超出有效范围');
  }
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

  for (const [key, label] of [['officialUrl', '官方信息链接'], ['navigationUrl', '自定义导航链接']]) {
    const url = safeHttpsUrl(draft[key], label);
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

function isSafeHttpsValue(value) {
  if (value === undefined) return true;
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function hasValidCoordinates(value) {
  return Array.isArray(value)
    && value.length === 2
    && value.every(Number.isFinite)
    && value[0] >= -90
    && value[0] <= 90
    && value[1] >= -180
    && value[1] <= 180;
}

function hasValidStatus(value) {
  return value === undefined || (
    value
    && typeof value === 'object'
    && typeof value.tone === 'string'
    && typeof value.label === 'string'
  );
}

function isValidStop(stop) {
  if (!stop || typeof stop !== 'object' || Array.isArray(stop)) return false;
  if (typeof stop.id !== 'string' || !stop.id || typeof stop.name !== 'string' || !stop.name) return false;
  for (const key of ['time', 'type', 'summary', 'detail']) {
    if (stop[key] !== undefined && typeof stop[key] !== 'string') return false;
  }
  if (stop.coordinates !== undefined && !hasValidCoordinates(stop.coordinates)) return false;
  if (!hasValidStatus(stop.status)) return false;
  return ['officialUrl', 'ticketUrl', 'navigationUrl'].every((key) => isSafeHttpsValue(stop[key]));
}

function isValidDay(day) {
  if (!day || typeof day !== 'object' || Array.isArray(day)) return false;
  if (typeof day.id !== 'string' || typeof day.date !== 'string' || typeof day.title !== 'string') return false;
  for (const key of ['weekday', 'city', 'eyebrow', 'summary']) {
    if (day[key] !== undefined && typeof day[key] !== 'string') return false;
  }
  if (!hasValidStatus(day.status) || !Array.isArray(day.stops) || !Array.isArray(day.route)) return false;
  if (!day.stops.every(isValidStop) || !day.route.every((id) => typeof id === 'string')) return false;

  const stopIds = day.stops.map((stop) => stop.id);
  const uniqueStopIds = new Set(stopIds);
  const uniqueRouteIds = new Set(day.route);
  if (uniqueStopIds.size !== stopIds.length || uniqueRouteIds.size !== day.route.length) return false;
  if (day.route.length !== stopIds.length) return false;
  if (day.route.some((id) => !uniqueStopIds.has(id))) return false;

  if (day.map !== undefined) {
    if (!day.map || typeof day.map !== 'object') return false;
    if (day.map.center !== undefined && !hasValidCoordinates(day.map.center)) return false;
    if (day.map.zoom !== undefined && !Number.isFinite(day.map.zoom)) return false;
  }
  return true;
}

export function loadSavedItinerary(raw, fallbackDays) {
  const fallback = clone(fallbackDays);
  if (!raw) return { days: fallback, valid: false };

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed.days)) return { days: fallback, valid: false };
    if (parsed.days.length !== fallbackDays.length) return { days: fallback, valid: false };
    const expectedIds = fallbackDays.map((day) => day.id);
    const actualIds = parsed.days.map((day) => day?.id);
    if (expectedIds.some((id, index) => id !== actualIds[index])) return { days: fallback, valid: false };
    if (!parsed.days.every(isValidDay)) return { days: fallback, valid: false };
    return { days: clone(parsed.days), valid: true };
  } catch {
    return { days: fallback, valid: false };
  }
}

export function parseSavedItinerary(raw, fallbackDays) {
  return loadSavedItinerary(raw, fallbackDays).days;
}

export function saveItineraryToStorage(storage, days) {
  try {
    storage.setItem(EDIT_STORAGE_KEY, serializeItinerary(days));
    return true;
  } catch {
    return false;
  }
}
