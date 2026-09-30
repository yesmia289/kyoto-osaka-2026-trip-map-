import { ITINERARY_DAYS } from './itinerary-data.js';
import {
  buildDayView,
  createInitialState,
  getDayById,
  selectDay,
  selectStop,
  setSheetExpanded,
} from './trip-model.js';

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
      role="tab"
      data-day-id="${escapeHtml(day.id)}"
      aria-selected="${day.id === state.dayId}"
      aria-controls="itinerary-sheet"
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
}

let map;
let routeLayer;

function renderMap() {
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
  }

  if (routeLayer) routeLayer.clearLayers();
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
  state = setSheetExpanded(state, !state.sheetExpanded);
  render();
});

let dragStartY;
elements.sheetHandle.addEventListener('pointerdown', (event) => {
  dragStartY = event.clientY;
  elements.sheetHandle.setPointerCapture(event.pointerId);
});

elements.sheetHandle.addEventListener('pointerup', (event) => {
  if (dragStartY === undefined) return;
  const movement = event.clientY - dragStartY;
  if (Math.abs(movement) > 24) {
    state = setSheetExpanded(state, movement < 0);
    render();
  }
  dragStartY = undefined;
});

render();
