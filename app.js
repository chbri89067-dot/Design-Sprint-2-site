import './components/rat-charts.js?v=20261015-2';
import { initMap } from './components/report-map.js?v=20261015-2';

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
const rat = document.querySelector('.running-rat');
let manuallyPaused = false;
const motionPaused = () => manuallyPaused || reduced.matches;
function updateRat() {
  rat.querySelector('svg')?.classList.toggle('paused', motionPaused());
}
function updateMotion() {
  document.body.classList.toggle('motion-paused', motionPaused());
  motionButton.textContent = reduced.matches ? 'Reduced motion' : manuallyPaused ? 'Resume motion' : 'Pause motion';
  motionButton.setAttribute('aria-pressed', String(motionPaused()));
  motionButton.disabled = reduced.matches;
  updateRat();
  if (motionPaused()) document.querySelectorAll('video').forEach(video => video.pause());
}
motionButton.addEventListener('click', () => { manuallyPaused = !manuallyPaused; updateMotion(); });
fetch(new URL('./assets/rat-running.svg', import.meta.url)).then(response => {
  if (!response.ok) throw Error('Rat asset unavailable');
  return response.text();
}).then(source => {
  const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  svg.setAttribute('aria-hidden', 'true');
  rat.append(document.importNode(svg, true));
  updateRat();
}).catch(() => { rat.hidden = true; });
reduced.addEventListener('change', updateMotion);
updateMotion();

// Seek only after scrolling, and only for visible films. Native playback stays usable.
const films = [...document.querySelectorAll('.film-track')].map(track => ({
  track, video: document.getElementById(track.dataset.video), progress: track.querySelector('progress'),
  pendingTarget: null,
}));
let frame = 0;
function scrubFilms() {
  frame = 0;
  if (motionPaused()) return;
  for (const film of films) {
    const { track, video, progress } = film;
    const rect = track.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight || !Number.isFinite(video.duration) || !video.paused) continue;
    const distance = rect.height - innerHeight;
    if (distance <= 0) continue;
    const amount = Math.max(0, Math.min(1, -rect.top / distance));
    progress.value = amount;
    const target = amount * Math.max(0, video.duration - .04);
    if (video.seeking) film.pendingTarget = target;
    else if (Math.abs(video.currentTime - target) > .08) { film.pendingTarget = null; video.currentTime = target; }
  }
}
function scheduleScrub() { if (!frame) frame = requestAnimationFrame(scrubFilms); }
window.addEventListener('scroll', scheduleScrub, { passive: true });
window.addEventListener('resize', scheduleScrub, { passive: true });
films.forEach(film => {
  const { video, progress } = film;
  video.addEventListener('loadedmetadata', scheduleScrub);
  video.addEventListener('seeked', () => {
    const target = film.pendingTarget;
    film.pendingTarget = null;
    if (target !== null && video.paused && !motionPaused() && Math.abs(video.currentTime - target) > .08) video.currentTime = target;
  });
  video.addEventListener('play', () => { film.pendingTarget = null; });
  video.addEventListener('timeupdate', () => { if (!video.paused && video.duration) progress.value = video.currentTime / video.duration; });
  video.addEventListener('error', () => {
    const message = document.createElement('p');
    message.className = 'fine-print';
    message.textContent = 'The film could not load. Try opening the film directly.';
    const link = document.createElement('a'); link.href = video.getAttribute('src'); link.textContent = 'Open this film';
    message.append(' ', link); video.after(message);
  }, { once: true });
});
