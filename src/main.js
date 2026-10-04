import { Film } from './film.js';
import { Audio } from './audio.js';
import { buildFilm } from './script.js';

const $ = (id) => document.getElementById(id);
const dom = {
  root: $('root'), stage: $('stage'), canvas: $('c'), fade: $('fade'), flash: $('flash'), chapter: $('chapter'), title: $('title'), loc: $('loc'), lower: $('lower'),
  sub: $('sub'), time: $('time'), seek: $('seek'), clock: $('clock'),
};
const params = new URLSearchParams(location.search);
const QUALITY = {
  saver: { fps: 30, scale: 0.7, dpr: 0, adaptive: true },
  balanced: { fps: 30, scale: 0.9, dpr: 0, adaptive: true },
  high: { fps: 60, scale: 1.0, dpr: 1.5, adaptive: true },
};

let film = null;
async function init(qname) {
  dom.preserve = params.has('debug');
  film = new Film(dom, QUALITY[qname] || QUALITY.balanced);
  window.__film = film;
  const tick = () => new Promise((r) => setTimeout(r, 0));
  await buildFilm(film, async (p) => { $('loadbar').style.width = (p * 100).toFixed(0) + '%'; await tick(); });
  film.audio = new Audio(film);
  film.start();
  film.frame(0);
}

function wireUI() {
  const root = dom.root;
  let hideT;
  const showHud = () => { root.classList.add('hud'); clearTimeout(hideT); hideT = setTimeout(() => { if (film && film.playing) root.classList.remove('hud'); }, 2600); };
  addEventListener('mousemove', showHud); addEventListener('touchstart', showHud);
  $('bplay').onclick = () => film.toggle();
  $('bcc').onclick = () => { film.captions = film.captions === false; film._renderedSub = null; film.dirty(); };
  $('bmute').onclick = () => { film.muted = !film.muted; film.audio && film.audio.setMute(film.muted); $('bmute').textContent = film.muted ? '🔇' : '🔊'; };
  const fs = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); };
  $('bfs').onclick = fs;
  dom.seek.addEventListener('input', () => { film._scrubbing = true; film.seek((dom.seek.value / 1000) * film.total); film.dirty(); });
  dom.seek.addEventListener('change', () => { film._scrubbing = false; });
  $('replay').onclick = () => { $('endcard').style.display = 'none'; film.seek(0); film.play(); };
  addEventListener('keydown', (e) => {
    if (!film) return;
    if (e.code === 'Space') { e.preventDefault(); film.toggle(); }
    else if (e.key === 'ArrowRight') { film.seek(film.T + 10); film.dirty(); }
    else if (e.key === 'ArrowLeft') { film.seek(film.T - 10); film.dirty(); }
    else if (e.key === 'f' || e.key === 'F') fs();
    else if (e.key === 'm' || e.key === 'M') $('bmute').click();
    else if (e.key === 'c' || e.key === 'C') $('bcc').click();
    showHud();
  });
}

(async () => {
  wireUI();
  const q = $('q'); if (params.get('q')) q.value = params.get('q');
  await init(q.value);
  $('play').textContent = 'PLAY'; $('play').disabled = false;
  film.onEnd = () => { $('endcard').style.display = 'flex'; };
  const go = () => {
    film.quality.speech = $('tts').checked;
    film.audio.start(film.quality.speech);
    $('start').style.opacity = 0; setTimeout(() => ($('start').style.display = 'none'), 650);
    film.play();
  };
  $('play').onclick = go;
  q.onchange = () => { const Q = { saver: { fps: 30, scale: 0.7, dpr: 0, adaptive: true }, balanced: { fps: 30, scale: 0.9, dpr: 0, adaptive: true }, high: { fps: 60, scale: 1, dpr: 1.5, adaptive: true } }[q.value]; film.quality = Q; film.scale = Q.scale; film.applyScale(); };
  if (params.has('debug')) { $('start').style.display = 'none'; dom.root.classList.toggle('hud', !params.has('nohud')); if (params.get('t')) { film.seek(+params.get('t')); } }
})();
