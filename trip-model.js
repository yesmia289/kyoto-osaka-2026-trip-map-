import { ITINERARY_DAYS } from './itinerary-data.js';

export function getDayById(dayId, days = ITINERARY_DAYS) {
  return days.find((day) => day.id === dayId);
}

export function getMappableStops(day) {
  if (!day || !Array.isArray(day.stops)) return [];

  return day.stops.filter((stop) => (
    Array.isArray(stop.coordinates)
    && stop.coordinates.length === 2
    && stop.coordinates.every(Number.isFinite)
  ));
}

function hasCoordinates(stop) {
  if (!Array.isArray(stop?.coordinates) || stop.coordinates.length !== 2) return false;
  const [latitude, longitude] = stop.coordinates;
  return (
    Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
  );
}

function amapPosition(stop) {
  const [latitude, longitude] = stop.coordinates;
  return `${longitude},${latitude}`;
}

export function buildNavigationUrl(stop) {
  if (stop?.navigationUrl) {
    try {
      const url = new URL(stop.navigationUrl);
      if (url.protocol === 'https:') return url.toString();
    } catch {
      return '';
    }
  }

  if (hasCoordinates(stop)) {
    const url = new URL('https://uri.amap.com/marker');
    url.search = new URLSearchParams({
      position: amapPosition(stop),
      name: stop.name || '行程地点',
      src: 'kyoto-osaka-2026-trip-map',
      coordinate: 'wgs84',
      callnative: '1',
    }).toString();
    return url.toString();
  }

  return '';
}

export function buildAmapRouteUrl(from, to, mode = 'bus') {
  if (!hasCoordinates(from) || !hasCoordinates(to)) return '';
  const travelMode = new Set(['car', 'bus', 'walk', 'ride']).has(mode) ? mode : 'bus';
  const url = new URL('https://uri.amap.com/navigation');
  url.search = new URLSearchParams({
    from: `${amapPosition(from)},${from.name || '起点'}`,
    to: `${amapPosition(to)},${to.name || '终点'}`,
    mode: travelMode,
    policy: '0',
    src: 'kyoto-osaka-2026-trip-map',
    callnative: '1',
  }).toString();
  return url.toString();
}

export function buildDayView(day) {
  if (!day) return undefined;

  const routeOrder = new Map((day.route ?? []).map((id, index) => [id, index]));
  const stops = [...(day.stops ?? [])].sort((left, right) => {
    const leftIndex = routeOrder.has(left.id) ? routeOrder.get(left.id) : Number.MAX_SAFE_INTEGER;
    const rightIndex = routeOrder.has(right.id) ? routeOrder.get(right.id) : Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });

  const numberedStops = stops.map((stop, index) => ({
      ...stop,
      sequence: index + 1,
      navigationUrl: buildNavigationUrl(stop),
    }));
  const renderedStops = numberedStops.map((stop, index) => {
    const nextStop = numberedStops[index + 1];
    if (!nextStop) return stop;
    const busUrl = buildAmapRouteUrl(stop, nextStop, 'bus');
    return {
      ...stop,
      nextLeg: {
        fromName: stop.name,
        toName: nextStop.name,
        available: Boolean(busUrl),
        busUrl,
        walkUrl: buildAmapRouteUrl(stop, nextStop, 'walk'),
      },
    };
  });

  return {
    ...day,
    stops: renderedStops,
    mappableStops: getMappableStops({ ...day, stops: renderedStops }),
  };
}

export function createInitialState(days = ITINERARY_DAYS) {
  const firstDay = days[0];
  return {
    days,
    dayId: firstDay?.id ?? '',
    stopId: firstDay?.stops?.[0]?.id ?? '',
    sheetExpanded: false,
  };
}

export function selectDay(state, dayId) {
  const nextDay = getDayById(dayId, state.days);
  if (!nextDay) return state;

  return {
    ...state,
    dayId: nextDay.id,
    stopId: nextDay.stops?.[0]?.id ?? '',
  };
}

export function selectStop(state, stopId) {
  const day = getDayById(state.dayId, state.days);
  if (!day?.stops?.some((stop) => stop.id === stopId)) return state;

  return { ...state, stopId };
}

export function setSheetExpanded(state, sheetExpanded) {
  return { ...state, sheetExpanded: Boolean(sheetExpanded) };
}
