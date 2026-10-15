/** Framework-independent chart components. See README.md for the dashboard API. */
export const BOROUGH_STYLES = Object.freeze({
  Bronx: { color: '#e9e7e1', dash: '', marker: 'circle' },
  Brooklyn: { color: '#bdbbb3', dash: '10 4', marker: 'square' },
  Manhattan: { color: '#9d9b93', dash: '3 4', marker: 'diamond' },
  Queens: { color: '#84827b', dash: '10 4 2 4', marker: 'triangle' },
  'Staten Island': { color: '#706e68', dash: '14 4 4 4', marker: 'cross' },
});
const defaultDataUrl = new URL('../data/rat-summary.json', import.meta.url);
const requests = new Map();
const format = new Intl.NumberFormat('en-US');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const display = value => value == null ? 'NULL' : format.format(value);
let nextId = 0;

function validate(data) {
  if (!data || !Array.isArray(data.years) || !Array.isArray(data.series) || data.series.length !== 5) throw new Error('Expected five borough series.');
  if (data.years.length !== 8 || data.years.some((year, i) => year !== 2010 + i)) throw new Error('Expected years 2010 through 2017.');
  const names = new Set();
  for (const item of data.series) {
    if (!BOROUGH_STYLES[item.borough] || names.has(item.borough)) throw new Error('Unknown or duplicate borough.');
    names.add(item.borough);
    const isCount = value => value === null || (Number.isSafeInteger(value) && value >= 0);
    if (!isCount(item.total) || !Array.isArray(item.annual) || item.annual.length !== 8 || !item.annual.every(isCount)) throw new Error('Invalid report counts.');
    if (item.annual.reduce((sum, n) => sum + (n ?? 0), 0) !== (item.total ?? 0)) throw new Error('Annual counts do not match the borough total.');
  }
  return data;
}

function marker(shape, x, y, color, size = 5) {
  const common = `fill="${color}" stroke="${color}" stroke-width="1.5"`;
  switch (shape) {
    case 'square': return `<rect x="${x-size}" y="${y-size}" width="${size*2}" height="${size*2}" ${common}/>`;
    case 'diamond': return `<path d="M${x} ${y-size-1} L${x+size+1} ${y} L${x} ${y+size+1} L${x-size-1} ${y} Z" ${common}/>`;
    case 'triangle': return `<path d="M${x} ${y-size-1} L${x+size+1} ${y+size} L${x-size-1} ${y+size} Z" ${common}/>`;
    case 'cross': return `<path d="M${x-size} ${y-size} L${x+size} ${y+size} M${x-size} ${y+size} L${x+size} ${y-size}" fill="none" stroke="${color}" stroke-width="3"/>`;
    default: return `<circle cx="${x}" cy="${y}" r="${size}" ${common}/>`;
  }
}

const css = `
  :host { display: block; color: #e9e7e1; font-family: "Segoe UI Light", "Segoe UI", Arial, sans-serif; font-weight: 300; min-width: 0; height: 100%; }
  * { box-sizing: border-box; }
  figure { margin: 0; padding: 28px; background: #080808; border: 1px solid #65655d; border-radius: 0; height: 100%; }
  .chart-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; min-height: 90px; }
  h2 { margin: 0 0 10px; font-size: 28px; font-weight: 300; line-height: 1.35; letter-spacing: -.015em; max-width: 670px; }
  .subtitle { font-size: 18px; color: #c5c3ba; margin: 0; line-height: 1.6; }
  button { font: inherit; font-size: 12px; color: #e9e7e1; background: #080808; border: 1px solid #8e8d83; padding: 10px 12px; border-radius: 0; cursor: pointer; min-height: 44px; white-space: nowrap; }
  button:hover { background: #242422; }
  button:focus-visible, summary:focus-visible { outline: 3px solid #e9e7e1; outline-offset: 3px; }
  .plot { width: 100%; min-height: 350px; }
  svg { display: block; width: 100%; overflow: visible; }
  svg text { font-family: inherit; fill: #c5c3ba; }
  .datum { cursor: default; }
  .datum:focus { outline: none; }
  .bar:focus { stroke: #e9e7e1; stroke-width: 4px; }
  .point .halo { fill: transparent; stroke: transparent; stroke-width: 3px; }
  .point:focus .halo { stroke: #e9e7e1; }
  .point:hover .halo { stroke: #8e8d83; stroke-width: 1px; }
  .readout { min-height: 44px; margin: 12px 0; padding: 10px 12px; border: 1px solid #393936; border-radius: 0; font-size: 13px; color: #c5c3ba; background: #111110; line-height: 1.5; }
  .legend { display: flex; gap: 10px 18px; flex-wrap: wrap; margin: 0 0 12px; padding: 0; list-style: none; }
  .legend li { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .legend svg { width: 46px; height: 18px; flex: none; }
  .note { font-size: 16px; line-height: 1.65; color: #c5c3ba; margin: 12px 0; }
  details { margin-top: 18px; border-top: 1px solid #393936; padding-top: 12px; }
  summary { font-size: 13px; font-weight: 650; cursor: pointer; padding: 8px 0; min-height: 44px; }
  .table-wrap { overflow: auto; margin-top: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  caption { text-align: left; font-size: 12px; color: #aaa89f; padding-bottom: 10px; }
  th, td { padding: 10px 12px; border-bottom: 1px solid #30302d; text-align: right; white-space: nowrap; }
  thead th { background: #242422; color: #e9e7e1; font-size: 12px; }
  th:first-child { text-align: left; }
  tfoot th, tfoot td { border-top: 2px solid #8e8d83; font-weight: 700; }
  .empty { padding: 80px 20px; text-align: center; line-height: 1.6; }
  .error { border: 1px solid #b9b7ab; color: #e9e7e1; padding: 16px; }
  @media (max-width: 600px) { figure { padding: 16px 12px; } .subtitle { font-size: 17px; } h2 { font-size: 23px; } .chart-heading { display: block; min-height: 0; margin-bottom: 16px; } button { margin-top: 12px; } }
  @media (forced-colors: active) { .bar { stroke: CanvasText; fill: CanvasText; } .series { stroke: CanvasText; fill: none; } .point .halo { fill: transparent; } }
  @media print { button { display: none; } figure { border: 1px solid #8e8d83; } }
`;

class RatChart extends HTMLElement {
  static observedAttributes = ['data-url'];
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._id = `rat-chart-${++nextId}`;
    this._data = null;
    this._selected = null;
    this._request = 0;
    this._observer = new ResizeObserver(() => this._draw());
  }
  connectedCallback() {
    if (this._data) this._render(); else this._load();
  }
  disconnectedCallback() { this._observer.disconnect(); this._request++; }
  attributeChangedCallback() { if (this.isConnected) this._load(); }
  set data(value) {
    this._request++;
    this._data = validate(value);
    if (this.isConnected) this._render();
  }
  get data() { return this._data; }
  set selectedBoroughs(value) {
    if (value !== null && (!Array.isArray(value) || value.some(b => !BOROUGH_STYLES[b]))) throw new Error('Use borough names or null to show all boroughs.');
    this._selected = value === null ? null : [...new Set(value)];
    if (this._data && this.isConnected) this._render();
  }
  get selectedBoroughs() { return this._selected === null ? Object.keys(BOROUGH_STYLES) : [...this._selected]; }
  get items() { return this._data.series.filter(item => this._selected === null || this._selected.includes(item.borough)); }
  async _load() {
    const request = ++this._request;
    const url = this.hasAttribute('data-url') ? new URL(this.getAttribute('data-url'), document.baseURI) : defaultDataUrl;
    this.shadowRoot.innerHTML = `<style>${css}</style><figure><p role="status">Loading chart data…</p></figure>`;
    try {
      if (!requests.has(url.href)) requests.set(url.href, fetch(url).then(response => {
        if (!response.ok) throw new Error(`Data request failed (${response.status}).`);
        return response.json();
      }).catch(error => { requests.delete(url.href); throw error; }));
      const data = validate(await requests.get(url.href));
      if (request !== this._request || !this.isConnected) return;
      this._data = data;
      this._render();
      this.dispatchEvent(new CustomEvent('chart-ready', { bubbles: true, composed: true }));
    } catch (error) {
      if (request !== this._request || !this.isConnected) return;
      this.shadowRoot.innerHTML = `<style>${css}</style><figure><h2>${escape(this.heading)}</h2><p class="error" role="alert">The chart data could not be loaded. ${escape(error.message)}</p></figure>`;
      this.dispatchEvent(new CustomEvent('chart-error', { detail: { message: error.message }, bubbles: true, composed: true }));
    }
  }
  _render() {
    const open = this.shadowRoot.querySelector('details')?.open ?? false;
    this._observer.disconnect();
    this.shadowRoot.innerHTML = `<style>${css}</style>
      <figure aria-labelledby="${this._id}-heading">
        <div class="chart-heading"><div><h2 id="${this._id}-heading">${escape(this.heading)}</h2><p class="subtitle">${escape(this.subtitle)}</p></div><button type="button" aria-label="Download ${this.kind === 'totals' ? 'borough totals' : 'annual trend'} chart as SVG">Save SVG</button></div>
        <div class="plot"></div>
        ${this.kind === 'trend' ? this._legend() : ''}
        <p class="readout" role="status" aria-live="polite" aria-atomic="true">Focus or hover over a ${this.kind === 'totals' ? 'bar' : 'marker'} to read its exact count.</p>
        <p class="note">2017 includes reports through September 16, so it is a partial year. Reports with an unspecified borough are excluded.</p>
        <details ${open ? 'open' : ''}><summary>View the data table</summary><div class="table-wrap" tabindex="0" role="region" aria-label="Scrollable ${this.kind === 'totals' ? 'borough totals' : 'annual counts'} table">${this._table()}</div></details>
      </figure>`;
    const plot = this.shadowRoot.querySelector('.plot');
    this._observer.observe(plot);
    this.shadowRoot.querySelector('button').addEventListener('click', () => this._download());
    this._draw();
  }
  _legend() {
    return `<ul class="legend" aria-label="Borough gray tones, line patterns and marker shapes">${this.items.map(item => {
      const style = BOROUGH_STYLES[item.borough];
      return `<li><svg viewBox="0 0 46 18" aria-hidden="true"><path d="M1 9 H45" stroke="${style.color}" stroke-width="2.5" stroke-dasharray="${style.dash}"/>${marker(style.marker, 23, 9, style.color, 4)}</svg><span>${escape(item.borough)}</span></li>`;
    }).join('')}</ul>`;
  }
  _table() {
    const total = this.items.reduce((sum, item) => sum + (item.total ?? 0), 0);
    if (this.kind === 'totals') {
      return `<table><caption>Reported sightings, 2010–2017. 2017 is partial.</caption><thead><tr><th scope="col">Borough</th><th scope="col">Reports</th></tr></thead><tbody>${this.items.map(item => `<tr><th scope="row">${escape(item.borough)}</th><td>${display(item.total)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">${this.items.length === 5 ? 'Five-borough total' : 'Selected boroughs total'}</th><td>${display(total)}</td></tr></tfoot></table>`;
    }
    return `<table><caption>Annual reported sightings. 2017 is partial. NULL means no matching reports.</caption><thead><tr><th scope="col">Year</th>${this.items.map(item => `<th scope="col">${escape(item.borough)}</th>`).join('')}<th scope="col">Total</th></tr></thead><tbody>${this._data.years.map((year, i) => `<tr><th scope="row">${year}${year === 2017 ? ' (partial)' : ''}</th>${this.items.map(item => `<td>${display(item.annual[i])}</td>`).join('')}<td>${display(this.items.reduce((sum, item) => sum + (item.annual[i] ?? 0), 0))}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">2010–2017</th>${this.items.map(item => `<td>${display(item.total)}</td>`).join('')}<td>${display(total)}</td></tr></tfoot></table>`;
  }
  _svgStart(width, height, description) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" height="${height}" role="group" aria-labelledby="${this._id}-title ${this._id}-desc"><title id="${this._id}-title">${escape(this.heading)}</title><desc id="${this._id}-desc">${escape(description)}</desc><rect width="${width}" height="${height}" fill="#080808"/>`;
  }
  _axes(width, height, margins, maximum, step, xLabel) {
    const bottom = height - margins.bottom;
    const y = value => bottom - value / maximum * (bottom - margins.top);
    let svg = '';
    for (let value = 0; value <= maximum; value += step) {
      svg += `<line x1="${margins.left}" x2="${width-margins.right}" y1="${y(value)}" y2="${y(value)}" stroke="${value === 0 ? '#8e8d83' : '#30302d'}"/><text x="${margins.left-9}" y="${y(value)+4}" text-anchor="end" font-size="12">${value === 0 ? '0' : `${value/1000}k`}</text>`;
    }
    svg += `<text transform="translate(14 ${(margins.top+bottom)/2}) rotate(-90)" text-anchor="middle" font-size="12">Reported rat sightings</text><text x="${(margins.left+width-margins.right)/2}" y="${height-4}" text-anchor="middle" font-size="12">${xLabel}</text>`;
    return { svg, y, bottom };
  }
  _draw() {
    const plot = this.shadowRoot.querySelector('.plot');
    if (!plot || !this._data) return;
    if (!this.items.length) {
      plot.innerHTML = '<p class="empty">Select at least one borough to display the chart.</p>';
      return;
    }
    const width = Math.max(280, Math.round(plot.getBoundingClientRect().width));
    plot.innerHTML = this.kind === 'totals' ? this._bars(width) : this._lines(width);
    plot.querySelectorAll('.datum').forEach(element => {
      const announce = () => {
        this.shadowRoot.querySelector('.readout').textContent = element.getAttribute('aria-label');
        this.dispatchEvent(new CustomEvent('rat-datum-focus', {
          detail: { borough: element.dataset.borough, year: element.dataset.year ? Number(element.dataset.year) : null, value: Number(element.dataset.value) }, bubbles: true, composed: true,
        }));
      };
      element.addEventListener('focus', announce);
      element.addEventListener('pointerenter', announce);
      element.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        const points = [...plot.querySelectorAll('.datum')];
        const i = points.indexOf(element);
        const offset = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
        const target = event.key === 'Home' ? 0 : event.key === 'End' ? points.length-1 : (i+offset+points.length) % points.length;
        event.preventDefault();
        points[target].focus();
      });
    });
  }
  _bars(width) {
    const height = 360;
    const margins = { left: 57, right: 14, top: 28, bottom: 59 };
    const axis = this._axes(width, height, margins, 40000, 10000, 'Borough');
    let svg = this._svgStart(width, height, 'Vertical bar chart. Borough on the x-axis and report count on the y-axis starting at zero. Exact counts appear above the bars and in the data table. 2017 is partial.');
    svg += `<g aria-hidden="true">${axis.svg}</g>`;
    const step = (width - margins.left - margins.right) / this.items.length;
    for (const [i, item] of this.items.entries()) {
      const x = margins.left + step * (i+.5);
      const y = axis.y(item.total ?? 0);
      const style = BOROUGH_STYLES[item.borough];
      if (item.total !== null) {
        const label = `${item.borough}: ${display(item.total)} reported rat sightings, 2010–2017 (2017 partial).`;
        svg += `<rect class="datum bar" tabindex="0" role="img" aria-label="${escape(label)}" data-borough="${escape(item.borough)}" data-value="${item.total}" x="${x-step*.3}" y="${y}" width="${step*.6}" height="${axis.bottom-y}" rx="0" fill="${style.color}"><title>${escape(label)}</title></rect>`;
      }
      svg += `<g aria-hidden="true"><text x="${x}" y="${y-9}" text-anchor="middle" font-size="${width < 400 ? 11 : 13}" font-weight="650">${display(item.total)}</text><text x="${x}" y="${axis.bottom+20}" text-anchor="middle" font-size="${width < 400 ? 10 : 12}">${item.borough === 'Staten Island' ? `<tspan x="${x}">Staten</tspan><tspan x="${x}" dy="14">Island</tspan>` : escape(item.borough)}</text></g>`;
    }
    return svg + '</svg>';
  }
  _lines(width) {
    const height = 360;
    const labels = width >= 700;
    const margins = { left: 48, right: labels ? 122 : 18, top: 28, bottom: 44 };
    const axis = this._axes(width, height, margins, 6000, 1000, 'Year');
    const step = (width - margins.left - margins.right) / 7;
    const x = i => margins.left + step*i;
    let svg = this._svgStart(width, height, 'Line chart with one series per borough. Years 2010–2017 on the x-axis and annual report counts on the y-axis starting at zero. Color, line pattern and marker shape distinguish boroughs. The shaded 2017 region represents a partial year through September 16. Exact counts are available at each marker and in the data table.');
    svg += `<g aria-hidden="true"><rect x="${x(6)+step/2}" y="${margins.top}" width="${step/2}" height="${axis.bottom-margins.top}" fill="#20201e"/>${axis.svg}`;
    this._data.years.forEach((year, i) => { svg += `<text x="${x(i)}" y="${axis.bottom+21}" text-anchor="middle" font-size="${width < 400 ? 10 : 12}">${year}${year === 2017 ? '*' : ''}</text>`; });
    svg += '</g>';
    for (const item of this.items) {
      const style = BOROUGH_STYLES[item.borough];
      let path = '', continuing = false;
      item.annual.forEach((value, i) => {
        if (value === null) { continuing = false; return; }
        path += `${continuing ? ' L' : ' M'}${x(i)} ${axis.y(value)}`;
        continuing = true;
      });
      svg += `<path class="series" d="${path}" fill="none" stroke="${style.color}" stroke-width="2.5" stroke-dasharray="${style.dash}" aria-hidden="true"/>`;
      item.annual.forEach((value, i) => {
        if (value === null) return;
        const px = x(i), py = axis.y(value);
        const label = `${item.borough}, ${this._data.years[i]}${i === 7 ? ' (partial year through September 16)' : ''}: ${display(value)} reported rat sightings.`;
        svg += `<g class="datum point" tabindex="0" role="img" aria-label="${escape(label)}" data-borough="${escape(item.borough)}" data-year="${this._data.years[i]}" data-value="${value}"><title>${escape(label)}</title><circle class="halo" cx="${px}" cy="${py}" r="12"/>${marker(style.marker, px, py, style.color)}</g>`;
      });
      const last = item.annual[7];
      if (labels && last !== null) svg += `<text x="${x(7)+13}" y="${axis.y(last)+4}" font-size="12" aria-hidden="true">${escape(item.borough)}</text>`;
    }
    return svg + '</svg>';
  }
  _download() {
    const svg = this.shadowRoot.querySelector('.plot svg');
    if (!svg) {
      this.shadowRoot.querySelector('.readout').textContent = 'Select at least one borough before saving a chart.';
      return;
    }
    // Export the title, complete legend, and coverage note as well as the plot.
    // A fixed export width keeps labels readable even when saved from a phone.
    const width = 900;
    const titleLines = [];
    for (const word of this.heading.split(' ')) {
      const last = titleLines.length - 1;
      if (last < 0 || titleLines[last].length + word.length > 80) titleLines.push(word);
      else titleLines[last] += ` ${word}`;
    }
    const plotTop = 20 + titleLines.length * 25;
    const legendTop = plotTop + 390;
    const height = legendTop + (this.kind === 'trend' ? 78 : 43);
    const plotMarkup = this.kind === 'totals' ? this._bars(width) : this._lines(width);
    const legend = this.kind === 'trend' ? this.items.map((item, i) => {
      const style = BOROUGH_STYLES[item.borough];
      const x = 24 + i * 174;
      return `<path d="M${x} ${legendTop} h40" fill="none" stroke="${style.color}" stroke-width="2.5" stroke-dasharray="${style.dash}"/>${marker(style.marker, x+20, legendTop, style.color, 4)}<text x="${x+48}" y="${legendTop+4}" font-size="12">${escape(item.borough)}</text>`;
    }).join('') : '';
    const noteY = legendTop + (this.kind === 'trend' ? 38 : 0);
    const output = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="group" aria-label="${escape(this.heading)}"><style>text { font-family: Segoe UI, Arial, sans-serif; fill: #c5c3ba; } .halo { fill: transparent; stroke: transparent; }</style><rect width="${width}" height="${height}" fill="#080808"/>${titleLines.map((line, i) => `<text x="24" y="${30+i*25}" font-size="20" font-weight="700">${escape(line)}</text>`).join('')}<g transform="translate(0,${plotTop})">${plotMarkup}</g>${legend}<text x="24" y="${noteY}" font-size="12">2017 is partial through September 16. One unspecified-borough report is excluded.</text></svg>`;
    const url = URL.createObjectURL(new Blob([output], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `rat-sightings-${this.kind}-2010-2017.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export class RatTotalsChart extends RatChart {
  kind = 'totals';
  heading = 'Total reports by borough';
  subtitle = 'Total reports across the recorded period. Each bar represents one borough.';
}
export class RatTrendChart extends RatChart {
  kind = 'trend';
  heading = 'How the reports changed';
  subtitle = 'Annual report counts, 2010–2017. Match each gray tone, line pattern, and marker to its borough.';
}
customElements.define('rat-totals-chart', RatTotalsChart);
customElements.define('rat-trend-chart', RatTrendChart);
