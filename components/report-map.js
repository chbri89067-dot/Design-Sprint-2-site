/** Static, dependency-free adaptation of the report filter in Daniela's dotmap.R. */
const format = new Intl.NumberFormat('en-US');
const labels = {
  'Bronx': [-73.86,40.875], 'Brooklyn': [-73.96,40.615],
  'Manhattan': [-74.03,40.79], 'Queens': [-73.79,40.735], 'Staten Island': [-74.155,40.57],
};

export async function initMap() {
  const stage = document.querySelector('#map-stage');
  const canvas = document.querySelector('#report-map');
  const svg = document.querySelector('#borough-map');
  const status = document.querySelector('#map-status');
  const buttons = [...document.querySelectorAll('[data-year]')];
  const outlines = document.querySelector('#outlines');
  let data, boundaries;
  try {
    [data, boundaries] = await Promise.all([
      fetch(new URL('../data/rat-map.json', import.meta.url)).then(r => { if (!r.ok) throw Error(); return r.json(); }),
      fetch(new URL('../data/boroughs.geojson', import.meta.url)).then(r => { if (!r.ok) throw Error(); return r.json(); }),
    ]);
    if (!data.years || !boundaries.features?.length) throw Error();
  } catch {
    status.textContent = 'The map could not load. Refresh the page or view the source dataset linked in Sources.';
    [...buttons, outlines].forEach(b => b.disabled = true);
    return;
  }
  status.hidden = true;
  let year = 'all', zoom = 1, panX = 0, panY = 0, frame = 0;
  // Equirectangular projection corrected for longitude scale at NYC's latitude.
  const xFactor = Math.cos(40.7 * Math.PI/180);
  const allCoordinates = boundaries.features.flatMap(f => f.geometry.coordinates.flat(2));
  const xs = allCoordinates.map(p => p[0]*xFactor), ys = allCoordinates.map(p => -p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  function geometry(width, height) {
    const scale = Math.min((width-36)/(maxX-minX), (height-45)/(maxY-minY));
    const cx = (minX+maxX)/2, cy = (minY+maxY)/2;
    return (lon,lat) => [((lon*xFactor-cx)*scale)*zoom + width/2 + panX, ((-lat-cy)*scale)*zoom + height/2 + panY];
  }
  function draw() {
    frame = 0;
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width*ratio); canvas.height = Math.round(height*ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio,0,0,ratio,0,0);
    const project = geometry(width,height);
    ctx.fillStyle = '#e2e0d7'; ctx.globalAlpha = year === 'all' ? .3 : .55;
    const radius = Math.min(1.6, .7 + zoom*.18);
    const groups = year === 'all' ? Object.values(data.years) : [data.years[year]];
    for (const points of groups) {
      ctx.beginPath();
      for (let i=0;i<points.length;i+=3) {
        const [x,y] = project(points[i],points[i+1]);
        if (x < -2 || y < -2 || x > width+2 || y > height+2) continue;
        ctx.moveTo(x+radius,y); ctx.arc(x,y,radius,0,Math.PI*2);
      }
      ctx.fill();
    }
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = outlines.checked ? boundaries.features.map(f => {
      const path = f.geometry.coordinates.flatMap(polygon => polygon.map(ring => ring.map((p,i) => `${i ? 'L' : 'M'}${project(p[0],p[1]).map(v=>v.toFixed(2)).join(' ')}`).join('')+'Z')).join('');
      const [lx,ly] = project(...labels[f.properties.name]);
      const name = f.properties.name;
      return `<path class="borough-fill" d="${path}"/><text class="borough-label" x="${lx}" y="${ly}">${name.toUpperCase()}</text>`;
    }).join('') : '';
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
  function update() {
    const counts = {};
    const selected = year === 'all' ? Object.values(data.counts) : [data.counts[year]];
    selected.forEach(group => Object.entries(group).forEach(([b,n]) => { counts[b] = (counts[b] || 0)+n; }));
    const total = Object.values(counts).reduce((a,b)=>a+b,0);
    const period = year === 'all' ? '2010–2017' : year === '2017' ? '2017 · through Sep 16' : year;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.year === year)));
    stage.setAttribute('aria-label', `NYC map, ${format.format(total)} reports, ${period}. Use the mouse wheel or plus and minus keys to zoom. Drag or use arrow keys to pan. Press Home to reset. Counts are in the data table below.`);
    document.querySelector('#map-data-table').innerHTML = `<table><caption>Mapped reports, ${period}. Counts exclude unusable or missing coordinates.</caption><thead><tr><th scope="col">Borough</th><th scope="col">Mapped reports</th></tr></thead><tbody>${data.boroughs.map(b=>`<tr><th scope="row">${b}</th><td>${format.format(counts[b] || 0)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">Total</th><td>${format.format(total)}</td></tr></tfoot></table>`;
    schedule();
  }
  let guidanceTimer, wasVisible = false, pointerMoved = false;
  function hideGuidance() {
    clearTimeout(guidanceTimer);
    stage.classList.remove('show-guidance');
  }
  const guidanceObserver = new IntersectionObserver(([entry]) => {
    if (entry.intersectionRatio >= .35 && !wasVisible) {
      wasVisible = true;
      stage.classList.add('show-guidance');
      guidanceTimer = setTimeout(hideGuidance, 3200);
    } else if (entry.intersectionRatio < .1) {
      wasVisible = false;
      pointerMoved = false;
      hideGuidance();
    }
  }, { threshold: [0, .1, .35] });
  guidanceObserver.observe(stage);
  function setZoom(value, anchor) {
    const next = Math.max(1, Math.min(6, value));
    const factor = next / zoom;
    const x = anchor?.[0] ?? 0, y = anchor?.[1] ?? 0;
    panX = x - (x - panX) * factor;
    panY = y - (y - panY) * factor;
    zoom = next;
    if (zoom === 1) { panX = 0; panY = 0; }
    stage.classList.toggle('is-zoomed', zoom > 1);
    schedule();
  }
  function anchorAt(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    return [clientX - rect.left - rect.width / 2, clientY - rect.top - rect.height / 2];
  }
  buttons.forEach(b => b.addEventListener('click', () => { year = b.dataset.year; update(); }));
  outlines.addEventListener('change', schedule);
  // Moving the pointer or focusing the map expresses intent to interact.
  // Scrolling the page into this section alone must not capture the wheel.
  stage.addEventListener('wheel', e => {
    if (!pointerMoved && document.activeElement !== stage && !e.ctrlKey) return;
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? stage.clientHeight : 1);
    if (!delta || (zoom === 1 && delta > 0) || (zoom === 6 && delta < 0)) return;
    e.preventDefault();
    hideGuidance();
    setZoom(zoom * Math.exp(-Math.max(-240, Math.min(240, delta)) * .0025), anchorAt(e.clientX, e.clientY));
  }, { passive: false });
  stage.addEventListener('keydown', e => {
    const delta = { ArrowLeft:[40,0], ArrowRight:[-40,0], ArrowUp:[0,40], ArrowDown:[0,-40] }[e.key];
    if (delta) { e.preventDefault(); hideGuidance(); panX += delta[0]; panY += delta[1]; schedule(); }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); hideGuidance(); setZoom(zoom * 1.5); }
    if (e.key === '-') { e.preventDefault(); hideGuidance(); setZoom(zoom / 1.5); }
    if (e.key === 'Home') { e.preventDefault(); hideGuidance(); setZoom(1); }
  });
  let drag;
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    hideGuidance();
    drag = [e.clientX, e.clientY, panX, panY];
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove', e => {
    if (e.pointerType !== 'touch') pointerMoved = true;
    if (!drag) return;
    panX = drag[2] + e.clientX - drag[0]; panY = drag[3] + e.clientY - drag[1]; schedule();
  });
  stage.addEventListener('pointerleave', () => { pointerMoved = false; });
  const stop = () => { drag = null; stage.classList.remove('dragging'); };
  stage.addEventListener('pointerup', stop); stage.addEventListener('pointercancel', stop);
  let pinch;
  const touchPair = touches => {
    const [a, b] = touches;
    return { distance: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY), x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  };
  stage.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      e.preventDefault(); hideGuidance();
      const pair = touchPair(e.touches);
      pinch = { ...pair, zoom };
      drag = null;
    } else if (e.touches.length === 1 && zoom > 1) {
      hideGuidance();
      drag = [e.touches[0].clientX, e.touches[0].clientY, panX, panY];
    }
  }, { passive: false });
  stage.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && pinch) {
      e.preventDefault();
      const pair = touchPair(e.touches);
      if (pinch.distance > 0) setZoom(pinch.zoom * pair.distance / pinch.distance, anchorAt(pair.x, pair.y));
      if (zoom > 1) { panX += pair.x - pinch.x; panY += pair.y - pinch.y; }
      pinch.x = pair.x; pinch.y = pair.y;
      schedule();
    } else if (e.touches.length === 1 && drag && zoom > 1) {
      e.preventDefault();
      panX = drag[2] + e.touches[0].clientX - drag[0]; panY = drag[3] + e.touches[0].clientY - drag[1]; schedule();
    }
  }, { passive: false });
  const stopTouch = () => { pinch = null; stop(); };
  stage.addEventListener('touchend', stopTouch); stage.addEventListener('touchcancel', stopTouch);
  new ResizeObserver(schedule).observe(stage);
  setZoom(1); update();
}
