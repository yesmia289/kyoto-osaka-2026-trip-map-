import { ITINERARY_DAYS } from './itinerary-data.js';
import {
  buildDayView,
  createInitialState,
  getDayById,
  selectDay,
  selectStop,
  setSheetExpanded,
} from './trip-model.js';
import { captureInteractiveFocus, restoreInteractiveFocus } from './focus-management.js';

const elements = {
  currentDayNumber: document.querySelector('#current-day-number'),
  dayTabs: document.querySelector('#day-tabs'),
  dayMeta: document.querySelector('#day-meta'),
  dayTitle: document.querySelector('#day-title'),
  dayStatus: document.querySelector('#day-status'),
  daySummary: document.querySelector('#day-summary'),
  dayRoute: document.querySelector('#day-route'),
  timeline: document.querySelector('#timeline'),
  sheet: document.querySelector('#itinerary-sheet'),
  sheetHandle: document.querySelector('#sheet-handle'),
  mapFallback: document.querySelector('#map-fallback'),
  leafletScript: document.querySelector('#leaflet-script'),
};

let state = createInitialState(ITINERARY_DAYS);

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function externalLink(url, label, primary = false) {
  if (!url) return '';
  const className = primary ? 'stop-link stop-link--primary' : 'stop-link';
  return `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} <span aria-hidden="true">↗</span></a>`;
}

function renderDayTabs() {
  elements.dayTabs.innerHTML = state.days.map((day, index) => `
    <button
      class="day-tab"
      type="button"
      data-day-id="${escapeHtml(day.id)}"
      aria-current="${day.id === state.dayId ? 'date' : 'false'}"
    >
      <strong>D${index + 1}</strong>
      <span>${escapeHtml(day.date.replace('月', '/').replace('日', ''))}</span>
    </button>
  `).join('');
}

function renderTimeline(day) {
  elements.timeline.innerHTML = day.stops.map((stop) => {
    const selected = stop.id === state.stopId;
    const status = stop.status
      ? `<span class="status-badge" data-tone="${escapeHtml(stop.status.tone)}">${escapeHtml(stop.status.label)}</span>`
      : '';
    const details = selected ? `
      <div class="stop-detail">
        <p>${escapeHtml(stop.detail || stop.summary || '')}</p>
        ${status}
        <div class="stop-actions">
          ${externalLink(stop.navigationUrl, '打开导航', true)}
          ${externalLink(stop.officialUrl, '官方信息')}
          ${externalLink(stop.ticketUrl, '门票信息')}
        </div>
      </div>
    ` : '';

    return `
      <li class="timeline-item${selected ? ' is-selected' : ''}" data-stop-id="${escapeHtml(stop.id)}">
        <span class="timeline-marker" aria-hidden="true">${stop.sequence}</span>
        <div class="timeline-card">
          <button class="timeline-button" type="button" aria-expanded="${selected}">
            <span class="timeline-time">${escapeHtml(stop.time || '弹性')}</span>
            <span class="timeline-title">${escapeHtml(stop.name)}</span>
            <span class="timeline-summary">${escapeHtml(stop.summary || '')}</span>
          </button>
          ${details}
        </div>
      </li>
    `;
  }).join('');
}

function render() {
  const day = buildDayView(getDayById(state.dayId, state.days));
  if (!day) return;
  const focusToken = captureInteractiveFocus(document.activeElement, elements.dayTabs, elements.timeline);

  const dayIndex = state.days.findIndex((candidate) => candidate.id === day.id);
  elements.currentDayNumber.textContent = String(dayIndex + 1);
  elements.dayMeta.textContent = `${day.date} · ${day.weekday || ''} · ${day.city || ''}`;
  elements.dayTitle.textContent = day.title;
  elements.daySummary.textContent = day.summary;
  elements.dayRoute.textContent = day.eyebrow;
  elements.sheet.classList.toggle('is-expanded', state.sheetExpanded);
  elements.sheetHandle.setAttribute('aria-expanded', String(state.sheetExpanded));
  elements.sheetHandle.setAttribute('aria-label', state.sheetExpanded ? '收起当天行程' : '展开当天行程');

  if (day.status) {
    elements.dayStatus.hidden = false;
    elements.dayStatus.textContent = day.status.label;
    elements.dayStatus.dataset.tone = day.status.tone;
  } else {
    elements.dayStatus.hidden = true;
    elements.dayStatus.textContent = '';
    delete elements.dayStatus.dataset.tone;
  }

  renderDayTabs();
  renderTimeline(day);
  renderMap(day);
  restoreInteractiveFocus(focusToken, elements.dayTabs, elements.timeline);
}

let map;
let routeLayer;

function markerIcon(sequence, selected) {
  return window.L.divIcon({
    className: 'trip-marker-shell',
    html: `<span class="trip-marker${selected ? ' is-selected' : ''}"><b>${sequence}</b></span>`,
    iconSize: [38, 42],
    iconAnchor: [19, 38],
    popupAnchor: [0, -34],
  });
}

function renderMap(day) {
  if (!window.L) {
    elements.mapFallback.hidden = false;
    return;
  }

  elements.mapFallback.hidden = true;
  if (!map) {
    map = window.L.map('map', { zoomControl: true, attributionControl: true });
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    routeLayer = window.L.layerGroup().addTo(map);
  }

  routeLayer.clearLayers();
  const locations = day.mappableStops;

  for (const stop of locations) {
    const marker = window.L.marker(stop.coordinates, {
      alt: `${stop.sequence}. ${stop.name}`,
      icon: markerIcon(stop.sequence, stop.id === state.stopId),
      keyboard: true,
      riseOnHover: true,
    });
    marker.bindTooltip(`${stop.sequence}. ${stop.name}`, { direction: 'top', offset: [0, -30] });
    marker.on('click', () => {
      state = selectStop(state, stop.id);
      render();
      document.querySelector(`[data-stop-id="${CSS.escape(stop.id)}"]`)?.scrollIntoView({ block: 'nearest' });
    });
    marker.addTo(routeLayer);
  }

  if (locations.length >= 2) {
    window.L.polyline(locations.map((stop) => stop.coordinates), {
      color: '#e45d3c',
      weight: 4,
      opacity: 0.9,
      lineJoin: 'round',
      dashArray: '1 10',
    }).addTo(routeLayer);
  }

  if (locations.length) {
    const bounds = window.L.latLngBounds(locations.map((stop) => stop.coordinates));
    if (locations.length === 1) {
      map.setView(locations[0].coordinates, day.map?.zoom ?? 14);
    } else {
      map.fitBounds(bounds, { paddingTopLeft: [34, 228], paddingBottomRight: [34, 390], maxZoom: 14 });
    }
  } else {
    map.setView(day.map?.center ?? [35.0116, 135.7681], day.map?.zoom ?? 12);
  }

  window.setTimeout(() => map.invalidateSize({ pan: false }), 0);
}

elements.dayTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-day-id]');
  if (!button) return;
  state = selectDay(state, button.dataset.dayId);
  elements.sheet.scrollTo({ top: 0, behavior: 'smooth' });
  render();
});

elements.timeline.addEventListener('click', (event) => {
  const item = event.target.closest('[data-stop-id]');
  if (!item) return;
  state = selectStop(state, item.dataset.stopId);
  render();
  document.querySelector(`[data-stop-id="${CSS.escape(item.dataset.stopId)}"]`)?.scrollIntoView({ block: 'nearest' });
});

elements.sheetHandle.addEventListener('click', () => {
  if (dragHandled) {
    dragHandled = false;
    return;
  }
  state = setSheetExpanded(state, !state.sheetExpanded);
  render();
});

let dragStartY;
let dragHandled = false;
elements.sheetHandle.addEventListener('pointerdown', (event) => {
  dragStartY = event.clientY;
  elements.sheetHandle.setPointerCapture(event.pointerId);
});

elements.sheetHandle.addEventListener('pointerup', (event) => {
  if (dragStartY === undefined) return;
  const movement = event.clientY - dragStartY;
  if (Math.abs(movement) > 24) {
    dragHandled = true;
    state = setSheetExpanded(state, movement < 0);
    render();
  }
  dragStartY = undefined;
});

elements.sheetHandle.addEventListener('pointercancel', () => {
  dragStartY = undefined;
  dragHandled = false;
});

render();

elements.leafletScript?.addEventListener('load', () => {
  const day = buildDayView(getDayById(state.dayId, state.days));
  if (day) renderMap(day);
});
