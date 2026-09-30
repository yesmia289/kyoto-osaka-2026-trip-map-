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

export function buildNavigationUrl(stop) {
  if (stop?.navigationUrl) {
    try {
      const url = new URL(stop.navigationUrl);
      if (url.protocol === 'https:') return url.toString();
    } catch {
      return '';
    }
  }

  if (Array.isArray(stop?.coordinates) && stop.coordinates.length === 2) {
    const query = encodeURIComponent(stop.coordinates.join(','));
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  return '';
}

export function buildDayView(day) {
  if (!day) return undefined;

  const routeOrder = new Map((day.route ?? []).map((id, index) => [id, index]));
  const stops = [...(day.stops ?? [])].sort((left, right) => {
    const leftIndex = routeOrder.has(left.id) ? routeOrder.get(left.id) : Number.MAX_SAFE_INTEGER;
    const rightIndex = routeOrder.has(right.id) ? routeOrder.get(right.id) : Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });

  return {
    ...day,
    stops: stops.map((stop, index) => ({
      ...stop,
      sequence: index + 1,
      navigationUrl: buildNavigationUrl(stop),
    })),
    mappableStops: getMappableStops({ ...day, stops }),
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
