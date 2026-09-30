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
import {
  EDIT_STORAGE_KEY,
  deleteStop,
  insertStopAfter,
  parseSavedItinerary,
  serializeItinerary,
  updateStop,
} from './editor-model.js';

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
  editStatus: document.querySelector('#edit-status'),
  editToggle: document.querySelector('#edit-toggle'),
  editorToolbar: document.querySelector('#editor-toolbar'),
  addStop: document.querySelector('#add-stop'),
  editStop: document.querySelector('#edit-stop'),
  deleteStop: document.querySelector('#delete-stop'),
  exportEdits: document.querySelector('#export-edits'),
  resetEdits: document.querySelector('#reset-edits'),
  editorDialog: document.querySelector('#stop-editor'),
  editorForm: document.querySelector('#stop-editor-form'),
  editorTitle: document.querySelector('#editor-title'),
  editorDayLabel: document.querySelector('#editor-day-label'),
  editorMode: document.querySelector('#editor-mode'),
  editorTime: document.querySelector('#editor-time'),
  editorName: document.querySelector('#editor-name'),
  editorSummary: document.querySelector('#editor-summary'),
  editorDetail: document.querySelector('#editor-detail'),
  editorLatitude: document.querySelector('#editor-latitude'),
  editorLongitude: document.querySelector('#editor-longitude'),
  editorOfficialUrl: document.querySelector('#editor-official-url'),
  editorNavigationUrl: document.querySelector('#editor-navigation-url'),
  editorError: document.querySelector('#editor-error'),
  closeEditor: document.querySelector('#close-editor'),
  cancelEditor: document.querySelector('#cancel-editor'),
  editToast: document.querySelector('#edit-toast'),
};

let savedItinerary = '';
try {
  savedItinerary = window.localStorage.getItem(EDIT_STORAGE_KEY) || '';
} catch {
  savedItinerary = '';
}

let state = createInitialState(parseSavedItinerary(savedItinerary, ITINERARY_DAYS));
let editMode = false;
let hasLocalEdits = Boolean(savedItinerary);
let toastTimer;

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
  elements.editorToolbar.hidden = !editMode;
  elements.editToggle.textContent = editMode ? '完成编辑' : '编辑行程';
  elements.editToggle.setAttribute('aria-pressed', String(editMode));
  elements.editStatus.textContent = editMode
    ? '编辑模式 · 自动保存到此设备'
    : hasLocalEdits ? '此设备有本地修改' : '公开行程';
  const selectedStopExists = day.stops.some((stop) => stop.id === state.stopId);
  elements.editStop.disabled = !selectedStopExists;
  elements.deleteStop.disabled = !selectedStopExists;

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

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.editToast.textContent = message;
  elements.editToast.hidden = false;
  toastTimer = window.setTimeout(() => {
    elements.editToast.hidden = true;
  }, 2600);
}

function persistDays(days) {
  try {
    window.localStorage.setItem(EDIT_STORAGE_KEY, serializeItinerary(days));
    hasLocalEdits = true;
    return true;
  } catch {
    showToast('浏览器无法保存修改，请先导出备份。');
    return false;
  }
}

function closeEditor() {
  if (typeof elements.editorDialog.close === 'function') elements.editorDialog.close();
  else elements.editorDialog.removeAttribute('open');
}

function openEditor(mode) {
  const day = getDayById(state.dayId, state.days);
  const stop = day?.stops.find((candidate) => candidate.id === state.stopId);
  if (!day || (mode === 'edit' && !stop)) return;

  elements.editorForm.reset();
  elements.editorMode.value = mode;
  elements.editorTitle.textContent = mode === 'add' ? '新增行程项目' : '编辑行程项目';
  elements.editorDayLabel.textContent = `${day.date} · ${day.title}`;
  elements.editorError.hidden = true;
  elements.editorError.textContent = '';

  if (stop && mode === 'edit') {
    elements.editorTime.value = stop.time || '';
    elements.editorName.value = stop.name || '';
    elements.editorSummary.value = stop.summary || '';
    elements.editorDetail.value = stop.detail || '';
    elements.editorLatitude.value = stop.coordinates?.[0] ?? '';
    elements.editorLongitude.value = stop.coordinates?.[1] ?? '';
    elements.editorOfficialUrl.value = stop.officialUrl || '';
    elements.editorNavigationUrl.value = stop.navigationUrl || '';
  }

  if (typeof elements.editorDialog.showModal === 'function') elements.editorDialog.showModal();
  else elements.editorDialog.setAttribute('open', '');
  window.setTimeout(() => elements.editorName.focus(), 0);
}

function formDraft() {
  return {
    time: elements.editorTime.value,
    name: elements.editorName.value,
    summary: elements.editorSummary.value,
    detail: elements.editorDetail.value,
    latitude: elements.editorLatitude.value,
    longitude: elements.editorLongitude.value,
    officialUrl: elements.editorOfficialUrl.value,
    navigationUrl: elements.editorNavigationUrl.value,
  };
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

elements.editToggle.addEventListener('click', () => {
  editMode = !editMode;
  if (editMode) state = setSheetExpanded(state, true);
  render();
});

elements.addStop.addEventListener('click', () => openEditor('add'));
elements.editStop.addEventListener('click', () => openEditor('edit'));
elements.closeEditor.addEventListener('click', closeEditor);
elements.cancelEditor.addEventListener('click', closeEditor);

elements.editorDialog.addEventListener('click', (event) => {
  if (event.target === elements.editorDialog) closeEditor();
});

elements.editorForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const mode = elements.editorMode.value;
  try {
    if (mode === 'add') {
      const newId = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const days = insertStopAfter(state.days, state.dayId, state.stopId, formDraft(), newId);
      state = { ...state, days, stopId: newId };
    } else {
      const days = updateStop(state.days, state.dayId, state.stopId, formDraft());
      state = { ...state, days };
    }
    persistDays(state.days);
    closeEditor();
    render();
    showToast(mode === 'add' ? '已新增并保存到此设备' : '修改已保存到此设备');
  } catch (error) {
    elements.editorError.textContent = error instanceof Error ? error.message : '无法保存，请检查输入。';
    elements.editorError.hidden = false;
  }
});

elements.deleteStop.addEventListener('click', () => {
  const day = getDayById(state.dayId, state.days);
  const index = day?.stops.findIndex((stop) => stop.id === state.stopId) ?? -1;
  if (!day || index < 0) return;
  const stop = day.stops[index];
  if (!window.confirm(`确定删除“${stop.name}”吗？可用“恢复公开版”撤销全部本地修改。`)) return;

  const nextStopId = day.stops[index + 1]?.id || day.stops[index - 1]?.id || '';
  const days = deleteStop(state.days, state.dayId, state.stopId);
  state = { ...state, days, stopId: nextStopId };
  persistDays(days);
  render();
  showToast('项目已从此设备删除');
});

elements.exportEdits.addEventListener('click', () => {
  const blob = new Blob([serializeItinerary(state.days)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `kyoto-osaka-trip-edits-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast('修改文件已导出');
});

elements.resetEdits.addEventListener('click', () => {
  if (!window.confirm('确定清除这台设备上的全部修改，恢复公开版本吗？')) return;
  try {
    window.localStorage.removeItem(EDIT_STORAGE_KEY);
  } catch {
    showToast('浏览器无法清除本地修改。');
    return;
  }
  state = createInitialState(parseSavedItinerary('', ITINERARY_DAYS));
  hasLocalEdits = false;
  editMode = false;
  render();
  showToast('已恢复公开版本');
});

render();

elements.leafletScript?.addEventListener('load', () => {
  const day = buildDayView(getDayById(state.dayId, state.days));
  if (day) renderMap(day);
});
