/* Fold Canggu — the hero 3D object is a REAL model, not procedural geometry.
 *
 * Model: croissant.glb — a photogrammetry scan of a real croissant by
 * Greg Zaal & Dario Barresi, Poly Haven, CC0 1.0 (see model-credits.md).
 * 1,988 triangles, 1 mesh, 3 embedded 1K PBR textures, real-world scale
 * (20.0 x 6.2 x 7.6 cm). Loaded with Three.js GLTFLoader. There is NO
 * TorusGeometry / lathe / primitive-built hero geometry in this file —
 * the only 3D content is the loaded .glb. Lights are lights, not objects.
 *
 * Staging (the anti-overlap guarantee): the canvas lives INSIDE
 * .hero-stage, an in-flow box below the hero text with overflow:hidden.
 * The renderer is transparent (alpha:true, no scene background) so the
 * stage's REAL PHOTO background (bright café interior, Unsplash, set in
 * styles.css) shows through behind the model. fitCamera() measures the
 * loaded model's tilted bounding box and places the camera so the whole
 * croissant — at any turntable angle — fits inside the stage with a
 * margin, at desktop and mobile widths. The model only ROTATES; it never
 * translates, so it can never drift over text or out of the stage.
 * If WebGL or the model fails to load, body.no-webgl shows the real
 * croissant photo fallback inside the stage instead.
 *
 * Three.js 0.169.0 via the jsDelivr import map in index.html.
 * DPR capped 2 desktop / 1.5 mobile; pause when tab hidden or the stage
 * is off-screen; static single frame under prefers-reduced-motion.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const stage = document.getElementById('croissant-stage');
const canvas = document.getElementById('croissant-canvas');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const isMobile = () => window.innerWidth < 760;

function showFallback() {
  document.body.classList.add('no-webgl');
  if (canvas) canvas.style.display = 'none';
}

/* ------------------------------------------------------------------ */
/* Renderer — transparent, so the stage's real-photo background shows   */
/* through behind the model. ACES tone mapping, DPR capped.            */
/* ------------------------------------------------------------------ */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (err) {
  showFallback();
  throw new Error('WebGL unavailable — photo fallback in use.');
}
if (!renderer) { showFallback(); throw new Error('WebGL unavailable — photo fallback in use.'); }

function applyPixelRatio() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
}
function sizeRenderer() {
  if (!stage) return;
  renderer.setSize(stage.clientWidth, stage.clientHeight, false);
}
applyPixelRatio();
sizeRenderer();
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene(); // no background: the photo behind shows through

const camera = new THREE.PerspectiveCamera(isMobile() ? 46 : 38, 1, 0.1, 100);

/* ------------------------------------------------------------------ */
/* Light — warm key from the upper right, soft cream fill, a whisper   */
/* of jade from the left (the green-tiled house).                      */
/* ------------------------------------------------------------------ */
scene.add(new THREE.HemisphereLight(0xfffdf6, 0xe3d5c3, 0.9));

const key = new THREE.DirectionalLight(0xfff1dd, 1.6);
key.position.set(4, 6, 5);
scene.add(key);

const jadeFill = new THREE.PointLight(0x1e5b44, 5, 10, 1.8);
jadeFill.position.set(-3.5, 0.5, 2.5);
scene.add(jadeFill);

/* ------------------------------------------------------------------ */
/* The croissant — real GLB, centred on its own middle, tilted to a    */
/* natural three-quarter product angle.                                */
/* ------------------------------------------------------------------ */
const TILT_X = -0.30; // tip the flat scan toward the camera: reads taller.
  // -0.30 (not -0.42) was chosen from the load-test: same worst-case fit
  // at every width, but a bigger hero (57% of stage width on desktop).
const rig = new THREE.Group(); // tilt + turntable rotation live here
scene.add(rig);
let modelLoaded = false;

const loader = new GLTFLoader();
loader.load(
  './croissant.glb',
  (gltf) => {
    const model = gltf.scene;
    // Centre the model on its own bounding-box middle so it spins in place.
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    rig.add(model);
    rig.rotation.x = TILT_X;
    modelLoaded = true;
    fitCamera();
    // The model made it: clear any fallback the safety timers may have set
    // on a slow connection, so the canvas (not the fallback photo) shows.
    document.body.classList.remove('no-webgl');
    document.body.classList.add('webgl-on');
    if (reduceMotion) renderOnce();
    else startLoop();
  },
  undefined,
  () => { showFallback(); }
);

/* Fit the camera to the TILTED model so the whole croissant fits the
 * stage at any turntable angle, with a margin — never clipped by the
 * stage or viewport edges, at desktop or mobile widths.
 * The model's height changes as it spins (the long axis tips up when
 * turned sideways), so the fit samples the bounding box at several spin
 * angles and uses the WORST width and WORST height across all of them.
 * The larger required distance wins. */
function fitCamera() {
  if (!modelLoaded || !stage || stage.clientWidth === 0) return;
  const fov = isMobile() ? 46 : 38;
  const aspect = stage.clientWidth / stage.clientHeight;
  const halfTan = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  let worstW = 0;
  let worstH = 0;
  const probe = new THREE.Box3();
  const probeSize = new THREE.Vector3();
  for (const ry of [0, Math.PI / 4, Math.PI / 2]) {
    rig.rotation.y = ry;
    rig.updateMatrixWorld(true);
    probe.setFromObject(rig);
    probe.getSize(probeSize);
    worstW = Math.max(worstW, probeSize.x);
    worstH = Math.max(worstH, probeSize.y);
  }
  rig.rotation.y = 0;
  const distH = (worstW / 2) / (halfTan * aspect);
  const distV = (worstH / 2) / halfTan;
  const dist = Math.max(distH, distV) * 1.22; // 18% margin on every side
  camera.aspect = aspect;
  camera.fov = fov;
  camera.position.set(0, 0, dist);
  camera.near = dist * 0.05;
  camera.far = dist * 20;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);
}

/* ------------------------------------------------------------------ */
/* Scroll + pointer — rotation ONLY. No translation, so the model can   */
/* never leave its fitted framing.                                     */
/* ------------------------------------------------------------------ */
const hero = document.querySelector('.hero');
let heroSpan = 900;
function measure() {
  if (!hero) { heroSpan = 900; return; }
  const rect = hero.getBoundingClientRect();
  heroSpan = Math.max(rect.bottom + window.scrollY, 600);
}
measure();

function scrollProgress() {
  return THREE.MathUtils.clamp(window.scrollY / heroSpan, 0, 1);
}

const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
if (!coarsePointer && !reduceMotion) {
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
}

/* ------------------------------------------------------------------ */
/* Frame loop — quality governor drops DPR before deleting anything;    */
/* paused when the tab is hidden or the stage is off-screen.           */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
let smoothP = scrollProgress();
let frameAvg = 16;
let governorStep = 0;
let tabVisible = true;
let stageVisible = true;
let rafId = 0;
let loopRunning = false;

const BASE_ROT_Y = -0.5;

function applyFrame(dt, t, p) {
  if (!modelLoaded) return;
  rig.rotation.y = BASE_ROT_Y + p * 1.4 + (reduceMotion ? 0 : t * 0.12) + pointer.x * 0.1;
  rig.rotation.x = TILT_X + pointer.y * 0.05;
}

function tick() {
  rafId = requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const t = clock.elapsedTime;

  const target = scrollProgress();
  smoothP = reduceMotion ? target : smoothP + (target - smoothP) * (1 - Math.exp(-5.2 * dt));
  pointer.x += (pointer.tx - pointer.x) * 0.04;
  pointer.y += (pointer.ty - pointer.y) * 0.04;
  applyFrame(dt, t, smoothP);

  renderer.render(scene, camera);

  // Quality governor: sustained slow frames lower DPR first.
  frameAvg = frameAvg * 0.95 + (dt * 1000) * 0.05;
  if (frameAvg > 26 && governorStep < 2 && t > 3) {
    governorStep += 1;
    renderer.setPixelRatio(governorStep === 1 ? 1.25 : 1);
    sizeRenderer();
  }
}

function renderOnce() {
  if (!modelLoaded) return;
  applyFrame(0, 0, scrollProgress());
  renderer.render(scene, camera);
}

function startLoop() {
  if (loopRunning || !tabVisible || !stageVisible || !modelLoaded) return;
  loopRunning = true;
  cancelAnimationFrame(rafId);
  clock.getDelta();
  tick();
}
function stopLoop() {
  loopRunning = false;
  cancelAnimationFrame(rafId);
}

document.addEventListener('visibilitychange', () => {
  tabVisible = !document.hidden;
  if (tabVisible) startLoop();
  else stopLoop();
});

if ('IntersectionObserver' in window && stage) {
  new IntersectionObserver((entries) => {
    stageVisible = entries[0].isIntersecting;
    if (stageVisible) startLoop();
    else stopLoop();
  }, { threshold: 0 }).observe(stage);
}

window.addEventListener('resize', () => {
  camera.aspect = stage ? stage.clientWidth / Math.max(stage.clientHeight, 1) : 1;
  applyPixelRatio();
  sizeRenderer();
  fitCamera();
  measure();
  if (reduceMotion) renderOnce();
});

window.addEventListener('load', () => { measure(); fitCamera(); if (reduceMotion) renderOnce(); });

/* Safety net: if the CDN/module or the model never reports in, show the
   real-photo fallback instead of an empty stage. (The module failing to
   load at all is covered by the inline timeout in index.html.) */
setTimeout(() => {
  if (!modelLoaded && !document.body.classList.contains('no-webgl')) showFallback();
}, 12000);
