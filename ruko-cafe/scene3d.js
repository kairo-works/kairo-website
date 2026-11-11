/* Ruko Cafe — one persistent, lightweight Three.js layer behind the page.
 * Follows open-3d-skills/threejs-scene (procedural lathe geometry, ACES tone
 * mapping, DPR caps, FOV 38, reduced-motion) and the Kairo homepage-3d
 * reference (fixed canvas + CSS fallback, visibility pause, quality governor).
 * Enhancement layer only: no DOM, copy, layout, menu, price or form
 * behaviour is touched. The existing interactions live in script.js.
 *
 * Scene: a stylised coffee cup on a saucer (lathe + torus handle, terracotta
 * band, three coffee beans, soft steam) in the page palette — warm cream,
 * coffee brown, terracotta, gold — with a warm morning-glow behind it and
 * drifting gold dust. The cup sits right of the hero words; scrolling drifts
 * it away and fades the canvas out, so the rest of the page stays clean cream.
 */
import * as THREE from 'three';

const canvas = document.getElementById('webgl');
const hero = document.querySelector('.hero');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const isMobile = () => window.innerWidth < 760;

/* Palette — the page palette: warm cream, coffee brown, terracotta, gold. */
const CREAM = 0xf6ead9;
const COFFEE = 0x4a2c17;
const BEAN = 0x5a3a22;
const TERRA = 0xb5502a;

/* Cup home position (world units, camera at z 7.4, FOV 38):
   right side, low — behind the hero words, clear of the hero photo.
   On mobile the view is much narrower, so the cup sits closer in. */
const CUP_X_DESKTOP = 2.3;
const CUP_X_MOBILE = 0.95;
const cupBaseX = () => (isMobile() ? CUP_X_MOBILE : CUP_X_DESKTOP);
const CUP_Y = -0.35;

/* ------------------------------------------------------------------ */
/* Renderer (threejs-scene: ACES tone mapping, DPR capped, FOV ~38)   */
/* ------------------------------------------------------------------ */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (err) {
  // No WebGL: the CSS fallback gradient stays visible, DOM content is intact.
  canvas.style.display = 'none';
}
if (!renderer) throw new Error('WebGL unavailable — static fallback in use.');

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0); // transparent: page cream shows through
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.classList.add('webgl-on');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xfbf7f0, 0.028); // distant dust fades to page cream

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.0, 7.4);
if (isMobile()) {
  camera.fov = 46;
  camera.position.z = 9.2;
  camera.updateProjectionMatrix();
}

/* ------------------------------------------------------------------ */
/* Light — warm morning key, soft fill, cream hemisphere. No shadows:  */
/* the cup floats on the page cream, so there is no ground to catch one.*/
/* ------------------------------------------------------------------ */
scene.add(new THREE.HemisphereLight(0xfffaf0, 0x8a6f5c, 0.75));

const key = new THREE.DirectionalLight(0xffe3b3, 1.5);
key.position.set(4, 6, 5);
scene.add(key);

const fill = new THREE.DirectionalLight(0xf3e9dc, 0.5);
fill.position.set(-5, 2, 4);
scene.add(fill);

/* ------------------------------------------------------------------ */
/* Helpers: radial-gradient sprite textures drawn in code (no files).  */
/* ------------------------------------------------------------------ */
function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([offset, colour]) => g.addColorStop(offset, colour));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

const softDot = radialTexture([
  [0, 'rgba(255,255,255,0.9)'],
  [0.5, 'rgba(255,255,255,0.35)'],
  [1, 'rgba(255,255,255,0)'],
]);

/* ------------------------------------------------------------------ */
/* The cup — procedural lathe geometry (threejs-scene: round things    */
/* are lathes). Origin at the saucer base; cup body, coffee surface,   */
/* terracotta band, torus handle, three beans on the saucer.           */
/* ------------------------------------------------------------------ */
const cupMat = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.45, metalness: 0, side: THREE.DoubleSide });
const terraMat = new THREE.MeshStandardMaterial({ color: TERRA, roughness: 0.5, metalness: 0, side: THREE.DoubleSide });
const coffeeMat = new THREE.MeshStandardMaterial({ color: COFFEE, roughness: 0.18, metalness: 0 });
const beanMat = new THREE.MeshStandardMaterial({ color: BEAN, roughness: 0.55, metalness: 0 });

function lathe(profile, material) {
  const points = profile.map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.Mesh(new THREE.LatheGeometry(points, 48), material);
}

const cupGroup = new THREE.Group();

/* Saucer — shallow disc with a raised rim. */
cupGroup.add(lathe([
  [0.00, 0.00], [0.55, 0.00], [0.74, 0.02], [0.80, 0.05],
  [0.76, 0.07], [0.58, 0.06], [0.50, 0.075], [0.00, 0.075],
], cupMat));

/* Cup body — gently tapered, open top. */
const cup = lathe([
  [0.00, 0.02], [0.30, 0.02], [0.44, 0.04], [0.50, 0.10],
  [0.54, 0.30], [0.56, 0.55], [0.57, 0.72], [0.56, 0.78],
], cupMat);
cup.position.y = 0.07;
cupGroup.add(cup);

/* Coffee surface. */
const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), coffeeMat);
coffee.rotation.x = -Math.PI / 2;
coffee.position.y = 0.79;
cupGroup.add(coffee);

/* Terracotta band around the cup — the page accent colour. */
const band = new THREE.Mesh(new THREE.CylinderGeometry(0.575, 0.555, 0.14, 48, 1, true), terraMat);
band.position.y = 0.52;
cupGroup.add(band);

/* Handle — torus ring half-embedded in the cup wall. */
const handle = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 12, 32), cupMat);
handle.position.set(0.58, 0.49, 0);
handle.rotation.y = 0.12;
cupGroup.add(handle);

/* Three coffee beans resting on the saucer. */
const beanGeo = new THREE.SphereGeometry(0.13, 24, 16);
[[0.62, 0.25, 0.4], [-0.35, 0.62, 1.2], [0.10, -0.68, 2.1]].forEach(([x, z, rotY]) => {
  const bean = new THREE.Mesh(beanGeo, beanMat);
  bean.scale.set(1, 0.62, 0.8);
  bean.position.set(x, 0.15, z);
  bean.rotation.y = rotY;
  cupGroup.add(bean);
});

cupGroup.scale.setScalar(1.15);
cupGroup.position.set(CUP_X_DESKTOP, CUP_Y, 0);
cupGroup.rotation.y = 0.35;
scene.add(cupGroup);

/* Warm morning glow behind the cup, so the cream cup reads on cream. */
const glow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: radialTexture([
    [0, 'rgba(232,195,122,0.85)'],
    [0.5, 'rgba(232,195,122,0.28)'],
    [1, 'rgba(232,195,122,0)'],
  ]),
  transparent: true, opacity: 0.6, depthWrite: false,
}));
function fitGlow() {
  const s = isMobile() ? 3.0 : 4.6;
  glow.scale.set(s, s, 1);
}
fitGlow();
glow.position.set(CUP_X_DESKTOP, 0.15, -0.8);
scene.add(glow);

/* ------------------------------------------------------------------ */
/* Steam — soft sprites rising from the coffee, recycling in place.    */
/* (Child of the cup group, so it follows the cup as it drifts.)       */
/* ------------------------------------------------------------------ */
const STEAM_COUNT = 26;
const steamGeo = new THREE.BufferGeometry();
const sPos = new Float32Array(STEAM_COUNT * 3);
const sSeed = new Float32Array(STEAM_COUNT);
const sBaseX = new Float32Array(STEAM_COUNT);
for (let i = 0; i < STEAM_COUNT; i++) {
  sBaseX[i] = (Math.random() - 0.5) * 0.3;
  sPos[i * 3] = sBaseX[i];
  sPos[i * 3 + 1] = 0.9 + Math.random() * 1.2;
  sPos[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  sSeed[i] = Math.random() * Math.PI * 2;
}
steamGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({
  size: 0.22, map: softDot, transparent: true, opacity: 0.32,
  color: 0xead9bd, depthWrite: false, sizeAttenuation: true,
}));
cupGroup.add(steam);

/* ------------------------------------------------------------------ */
/* Gold dust — restrained ambient layer, like morning light in the air.*/
/* ------------------------------------------------------------------ */
const DUST_COUNT = isMobile() ? 170 : 320;
const dustGeo = new THREE.BufferGeometry();
const dPos = new Float32Array(DUST_COUNT * 3);
const dCol = new Float32Array(DUST_COUNT * 3);
const dSeed = new Float32Array(DUST_COUNT);
const goldCol = new THREE.Color(0xd9a441);
const paleCol = new THREE.Color(0xfff3dd);
for (let i = 0; i < DUST_COUNT; i++) {
  dPos[i * 3] = (Math.random() - 0.5) * 13;
  dPos[i * 3 + 1] = -2 + Math.random() * 7;
  dPos[i * 3 + 2] = -4 + Math.random() * 5.5;
  const c = Math.random() < 0.7 ? goldCol : paleCol;
  dCol[i * 3] = c.r; dCol[i * 3 + 1] = c.g; dCol[i * 3 + 2] = c.b;
  dSeed[i] = Math.random() * Math.PI * 2;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
dustGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  size: 0.05, vertexColors: true, transparent: true, opacity: 0.55,
  depthWrite: false, sizeAttenuation: true,
}));
scene.add(dust);

/* ------------------------------------------------------------------ */
/* Scroll — one progress value for the hero: 0 at the top, 1 once the  */
/* hero has scrolled away. The cup drifts right and turns away, the    */
/* camera rises slightly, and the canvas fades out so the rest of the  */
/* page stays exactly as it was.                                       */
/* ------------------------------------------------------------------ */
let heroH = 1;
let scrollTarget = 0;
let scrollSmooth = 0;
let scrollE = 0; // eased progress, shared with the frame loop

function measureHero() {
  heroH = hero ? hero.offsetHeight : window.innerHeight;
}
measureHero();

function readScrollTarget() {
  scrollTarget = THREE.MathUtils.clamp((window.scrollY || 0) / Math.max(heroH * 0.8, 1), 0, 1);
}

function applyScroll(p) {
  scrollE = p * p * (3 - 2 * p); // smoothstep
  cupGroup.position.x = cupBaseX() + scrollE * 1.6;
  glow.position.x = cupGroup.position.x;
  camera.position.y = 1.0 + scrollE * 0.5;
  canvas.style.opacity = String(1 - scrollE);
}

/* ------------------------------------------------------------------ */
/* Pointer parallax — restrained, clamped, off on coarse pointers.    */
/* ------------------------------------------------------------------ */
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
if (!coarsePointer && !reduceMotion) {
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
}

/* ------------------------------------------------------------------ */
/* Frame loop — quality governor drops DPR before deleting anything.   */
/* Rendering is skipped once the canvas has faded out past the hero.   */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
let frameAvg = 16;
let governorStep = 0;
let visible = true;
let rafId = 0;

function tick() {
  rafId = requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const t = clock.elapsedTime;

  readScrollTarget();
  scrollSmooth += (scrollTarget - scrollSmooth) * (1 - Math.exp(-6 * dt));
  applyScroll(scrollSmooth);

  // Damped pointer parallax plus a gentle idle sway (absolute, not accumulated).
  pointer.x += (pointer.tx - pointer.x) * 0.04;
  pointer.y += (pointer.ty - pointer.y) * 0.04;
  cupGroup.rotation.y = 0.35 + scrollE * 1.1 + Math.sin(t * 0.3) * 0.05 + pointer.x * 0.08;
  cupGroup.rotation.x = pointer.y * 0.05;
  cupGroup.position.y = CUP_Y + Math.sin(t * 0.6) * 0.03; // gentle float

  // Steam rises and recycles; dust drifts upward and recycles.
  const sArr = steamGeo.attributes.position.array;
  for (let i = 0; i < STEAM_COUNT; i++) {
    sArr[i * 3 + 1] += dt * 0.22;
    sArr[i * 3] = sBaseX[i] + Math.sin(t * 0.8 + sSeed[i]) * 0.07;
    if (sArr[i * 3 + 1] > 2.1) sArr[i * 3 + 1] = 0.9;
  }
  steamGeo.attributes.position.needsUpdate = true;

  const dArr = dustGeo.attributes.position.array;
  for (let i = 0; i < DUST_COUNT; i++) {
    dArr[i * 3 + 1] += dt * 0.1;
    dArr[i * 3] += Math.sin(t * 0.5 + dSeed[i]) * dt * 0.04;
    if (dArr[i * 3 + 1] > 5) dArr[i * 3 + 1] = -2;
  }
  dustGeo.attributes.position.needsUpdate = true;

  if (scrollSmooth < 0.995) renderer.render(scene, camera);

  // Quality governor: sustained slow frames lower DPR first.
  frameAvg = frameAvg * 0.95 + (dt * 1000) * 0.05;
  if (frameAvg > 26 && governorStep < 2 && t > 3) {
    governorStep += 1;
    renderer.setPixelRatio(governorStep === 1 ? 1.25 : 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

function startLoop() {
  if (!visible) return;
  cancelAnimationFrame(rafId);
  clock.getDelta();
  tick();
}

document.addEventListener('visibilitychange', () => {
  visible = !document.hidden;
  if (reduceMotion) return;
  if (visible) startLoop();
  else cancelAnimationFrame(rafId);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = isMobile() ? 46 : 38;
  camera.position.z = isMobile() ? 9.2 : 7.4;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  fitGlow();
  measureHero();
  if (reduceMotion) renderOnce();
});

window.addEventListener('load', measureHero);

/* Reduced motion: one static frame, re-rendered only when scroll/resize
   moves the cup — no idle animation, no loop. */
function renderOnce() {
  readScrollTarget();
  applyScroll(scrollTarget);
  cupGroup.rotation.y = 0.35 + scrollE * 1.1;
  renderer.render(scene, camera);
}

if (reduceMotion) {
  renderOnce();
  window.addEventListener('scroll', renderOnce, { passive: true });
} else {
  startLoop();
}
