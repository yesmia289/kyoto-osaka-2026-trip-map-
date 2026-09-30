import { escapeHtml } from './html-utils.js';

function externalLink(url, label, primary = false) {
  if (!url) return '';
  const className = primary ? 'stop-link stop-link--primary' : 'stop-link';
  return `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} <span aria-hidden="true">↗</span></a>`;
}

export function renderTimelineHtml(day, selectedStopId) {
  return day.stops.map((stop) => {
    const selected = stop.id === selectedStopId;
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
    const routeLeg = stop.nextLeg ? `
      <section class="route-leg${stop.nextLeg.available ? '' : ' is-unavailable'}" aria-label="${escapeHtml(stop.name)}前往${escapeHtml(stop.nextLeg.toName)}">
        <span class="route-leg__icon" aria-hidden="true">↓</span>
        <div class="route-leg__body">
          <span class="route-leg__eyebrow">前往下一站</span>
          <strong>${escapeHtml(stop.name)} <span aria-hidden="true">→</span> ${escapeHtml(stop.nextLeg.toName)}</strong>
          ${stop.nextLeg.available ? `
            <span class="route-leg__actions">
              ${externalLink(stop.nextLeg.busUrl, '公交导航', true)}
              ${externalLink(stop.nextLeg.walkUrl, '步行导航')}
            </span>
          ` : '<span class="route-leg__hint">补充起点和终点坐标后可导航</span>'}
        </div>
      </section>
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
        ${routeLeg}
      </li>
    `;
  }).join('');
}

export function isTimelineLinkTarget(target) {
  return Boolean(target?.closest?.('a'));
}
