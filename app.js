import './components/rat-charts.js?v=20261015-3';
import { initMap } from './components/report-map.js?v=20261015-3';

const charts = [...document.querySelectorAll('rat-totals-chart, rat-trend-chart')];
const controls = [...document.querySelectorAll('.filters input')];
function updateBoroughs() {
  const selected = controls.filter(input => input.checked).map(input => input.value);
  charts.forEach(chart => { chart.selectedBoroughs = selected; });
}
controls.forEach(input => input.addEventListener('change', updateBoroughs));
updateBoroughs();

document.documentElement.classList.add('js');
initMap();

const reveals = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) { entry.target.classList.add('is-visible'); reveals.unobserve(entry.target); }
}), { threshold: .12 });
document.querySelectorAll('.reveal').forEach(element => reveals.observe(element));

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const motionButton = document.querySelector('.motion-toggle');
const ratArt = [
  { host: document.querySelector('.running-rat'), path: './assets/rat-running.svg' },
  { host: document.querySelector('.hero-rat-face'), path: './assets/rat-face.svg' },
].filter(({ host }) => host);
let manuallyPaused = false;
const motionPaused = () => manuallyPaused || reduced.matches;
function updateRat() {
  ratArt.forEach(({ host }) => host.querySelector('svg')?.classList.toggle('paused', motionPaused()));
}
function updateMotion() {
  document.body.classList.toggle('motion-paused', motionPaused());
  motionButton.textContent = reduced.matches ? 'Reduced motion' : manuallyPaused ? 'Resume motion' : 'Pause motion';
  motionButton.setAttribute('aria-pressed', String(motionPaused()));
  motionButton.disabled = reduced.matches;
  updateRat();
}
motionButton.addEventListener('click', () => { manuallyPaused = !manuallyPaused; updateMotion(); });
ratArt.forEach(({ host, path }) => {
  fetch(new URL(path, import.meta.url)).then(response => {
    if (!response.ok) throw Error('Rat asset unavailable');
    return response.text();
  }).then(source => {
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
    svg.setAttribute('aria-hidden', 'true');
    host.append(document.importNode(svg, true));
    updateRat();
  }).catch(() => { host.hidden = true; });
});
reduced.addEventListener('change', updateMotion);
updateMotion();

// Films use their native controls; page scrolling never changes playback.
document.querySelectorAll('video').forEach(video => {
  video.addEventListener('error', () => {
    const message = document.createElement('p');
    message.className = 'fine-print';
    message.textContent = 'The film could not load. Try opening the film directly.';
    const link = document.createElement('a'); link.href = video.getAttribute('src'); link.textContent = 'Open this film';
    message.append(' ', link); video.after(message);
  }, { once: true });
});
