/* Ember landing page — 3D hero layer.
 *
 * The hero object is a REAL 3D model file, not code-drawn geometry:
 * "Fire Pit 1" by CircuitZ (CC0, via Poly Pizza), fire-pit-1.glb in this
 * folder, loaded with Three.js GLTFLoader. See model-credit.md.
 * No LatheGeometry / torus / primitive-built shapes are used for the
 * hero object. The only other 3D elements are light and a small field
 * of rising ember sparks (atmosphere, not an object), plus the flicker
 * of the ember light inside the pit.
 *
 * The canvas lives ONLY inside .flame-stage (the stage band below the
 * headline). It is stage-sized, never viewport-sized, so the model can
 * never cover headline, subtitle or buttons — that separation is
 * structural. Behind the canvas is a real campfire photograph.
 *
 * Three.js 0.169.0 via jsDelivr import map, ACES tone mapping, DPR
 * capped (2 desktop / 1.5 mobile), pause when hidden or scrolled past,
 * static under prefers-reduced-motion. If WebGL, the CDN or the model
 * fails, the module fails silently and the page shows the real campfire
 * photograph — fully readable, booking form untouched.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('webgl');
const stage = document.getElementById('flame-stage');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const isMobile = () => window.innerWidth < 760;

function fail() {
  document.body.classList.add('no-webgl');
  if (canvas) canvas.style.display = 'none';
}

if (!canvas || !stage) throw new Error('3D stage missing — static page in use.');

/* ------------------------------------------------------------------ */
/* Renderer (ACES, DPR capped, alpha canvas over the real photo)       */
/* ------------------------------------------------------------------ */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (err) {
  fail();
  throw new Error('WebGL unavailable — static page in use.');
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
renderer.setClearColor(0x000000, 0); // transparent: the campfire photo shows through
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

/* ------------------------------------------------------------------ */
/* Light — warm key, flickering ember light inside the pit, soft fill. */
/* ------------------------------------------------------------------ */
scene.add(new THREE.HemisphereLight(0xfaf6ef, 0x241b14, 0.55));

const key = new THREE.DirectionalLight(0xfff1dd, 1.3);
key.position.set(4, 6, 6);
scene.add(key);

const emberLight = new THREE.PointLight(0xe0452a, 14, 7, 1.8);

/* ------------------------------------------------------------------ */
/* The hero: the real fire-pit model, centred and scaled to the stage. */
/* Model units are metres (~0.98 wide, ~0.38 tall); it is re-centred so */
/* its base sits at y = 0 and its centre at x = z = 0, then scaled up   */
/* so it fills the stage as a big central object.                       */
/* ------------------------------------------------------------------ */
const pitGroup = new THREE.Group();
scene.add(pitGroup);
emberLight.position.set(0, 0.5, 0.3);
pitGroup.add(emberLight);

let modelLoaded = false;
const MODEL_SCALE = { desktop: 3.0, tablet: 2.6, mobile: 2.2 };

new GLTFLoader().load('fire-pit-1.glb', (gltf) => {
  const model = gltf.scene;
  // Re-centre: base on y = 0, centre on x = z = 0.
  const box = new THREE.Box3().setFromObject(model);
  const centre = new THREE.Vector3();
  box.getCenter(centre);
  model.position.set(-centre.x, -box.min.y, -centre.z);
  pitGroup.add(model);
  modelLoaded = true;
  layout();
  document.body.classList.add('webgl-on');
  startLoop();
}, undefined, () => {
  // Model missing or unparsable: photo fallback.
  fail();
});

/* ------------------------------------------------------------------ */
/* Ember sparks — small rising-particle atmosphere above the pit only. */
/* Not the hero object; the pit is the object.                         */
/* ------------------------------------------------------------------ */
const PARTICLE_COUNT = isMobile() ? 120 : 220;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PARTICLE_COUNT * 3);
const pCol = new Float32Array(PARTICLE_COUNT * 3);
const pSpeed = new Float32Array(PARTICLE_COUNT);
const pSeed = new Float32Array(PARTICLE_COUNT);
const emberCol = new THREE.Color(0xe0452a);
const goldCol = new THREE.Color(0xd9a441);
const paleCol = new THREE.Color(0xfaf6ef);
let PARTICLE_TOP = 1.1;
function spawnParticle(i, randomY) {
  pPos[i * 3] = (Math.random() - 0.5) * 2.0;
  pPos[i * 3 + 1] = randomY ? Math.random() * PARTICLE_TOP : 0;
  pPos[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
  const r = Math.random();
  const c = r < 0.6 ? emberCol : r < 0.85 ? goldCol : paleCol;
  pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
  pSpeed[i] = 0.25 + Math.random() * 0.3;
  pSeed[i] = Math.random() * Math.PI * 2;
}
for (let i = 0; i < PARTICLE_COUNT; i++) spawnParticle(i, true);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: 0.05, vertexColors: true, transparent: true, opacity: 0.85,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
}));
scene.add(particles);

/* ------------------------------------------------------------------ */
/* Layout — frame the pit inside the STAGE (not the viewport) on any   */
/* screen. Desktop: pit large, camera level. Mobile: pit smaller,      */
/* camera further back. Framing math: at fov 38 / z 3.6 the visible    */
/* half-height at the pit is ~1.24 units; the pit at scale 3 is 1.13   */
/* tall, so it fills ~45% of the stage height with clear margins top   */
/* and bottom — it can never touch the stage edges, let alone text.    */
/* ------------------------------------------------------------------ */
const layoutState = { scale: 3.0, baseY: -0.45, camY: 0.75, camZ: 3.6, lookY: 0.05 };

function layout() {
  const w = stage.clientWidth || window.innerWidth;
  const h = stage.clientHeight || 480;
  camera.aspect = w / h;
  if (isMobile()) {
    camera.fov = 44;
    layoutState.scale = MODEL_SCALE.mobile;
    layoutState.baseY = -0.35;
    layoutState.camY = 0.7;
    layoutState.camZ = 3.8;
    layoutState.lookY = 0.0;
    PARTICLE_TOP = 0.95;
  } else if (window.innerWidth < 1024) {
    camera.fov = 40;
    layoutState.scale = MODEL_SCALE.tablet;
    layoutState.baseY = -0.4;
    layoutState.camY = 0.75;
    layoutState.camZ = 3.6;
    layoutState.lookY = 0.05;
    PARTICLE_TOP = 1.05;
  } else {
    camera.fov = 38;
    layoutState.scale = MODEL_SCALE.desktop;
    layoutState.baseY = -0.45;
    layoutState.camY = 0.75;
    layoutState.camZ = 3.6;
    layoutState.lookY = 0.05;
    PARTICLE_TOP = 1.1;
  }
  pitGroup.scale.setScalar(layoutState.scale);
  pitGroup.position.y = layoutState.baseY;
  camera.position.set(0, layoutState.camY, layoutState.camZ);
  camera.lookAt(0, layoutState.lookY, 0);
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
  renderer.setSize(w, h);
  for (let i = 0; i < PARTICLE_COUNT; i++) spawnParticle(i, true);
  pGeo.attributes.position.needsUpdate = true;
}
layout();

/* ------------------------------------------------------------------ */
/* Interaction — scroll turns the pit, drag turns it, view buttons     */
/* jump to Front / Side / Coals angles. All rotation is applied to     */
/* the pit group inside the stage; the camera stays framed on it.      */
/* ------------------------------------------------------------------ */
let scrollTarget = 0;
let scrollSmooth = 0;
function measureScroll() {
  const rect = stage.getBoundingClientRect();
  scrollTarget = THREE.MathUtils.clamp(
    (window.innerHeight - rect.top) / (window.innerHeight + rect.height), 0, 1);
}
measureScroll();
scrollSmooth = scrollTarget;
window.addEventListener('scroll', measureScroll, { passive: true });

// Drag to turn.
let dragOffset = 0;
let dragging = false;
let lastX = 0;
if (!reduceMotion) {
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dragOffset += (e.clientX - lastX) * 0.005;
    lastX = e.clientX;
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
}

// View buttons: Front / Side / Coals (camera looks down into the pit).
const views = {
  front: { rot: 0, camY: 0.75, camZ: 3.6, lookY: 0.05 },
  side: { rot: 1.35, camY: 0.75, camZ: 3.6, lookY: 0.05 },
  coals: { rot: 0.6, camY: 1.7, camZ: 2.7, lookY: 0.0 },
};
const viewState = { rot: 0, camY: layoutState.camY, camZ: layoutState.camZ, lookY: layoutState.lookY };
const viewTarget = { rot: 0, camY: layoutState.camY, camZ: layoutState.camZ, lookY: layoutState.lookY };
document.querySelectorAll('.view-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const v = views[btn.dataset.view];
    if (!v) return;
    Object.assign(viewTarget, v);
    document.querySelectorAll('.view-btn').forEach((b) => {
      const active = b === btn;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  });
});

// Pointer parallax — restrained, clamped, off on coarse pointers.
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
if (!coarsePointer && !reduceMotion) {
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
}

/* ------------------------------------------------------------------ */
/* Frame loop — runs only while the stage is on screen, the model has  */
/* loaded and the tab is visible; quality governor drops DPR first.    */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
let frameAvg = 16;
let governorStep = 0;
let stageVisible = true;
let tabVisible = !document.hidden;
let running = false;
let rafId = 0;

function renderFrame(t, dt) {
  const s = scrollSmooth;
  // Turntable: scroll turns the pit, drag and view buttons add to it.
  pitGroup.rotation.y = s * 1.6 + dragOffset + viewState.rot;
  camera.position.x = Math.sin(s * 0.8) * 0.4 + pointer.x * 0.15;
  camera.position.y = viewState.camY;
  camera.position.z = viewState.camZ;
  camera.lookAt(0, viewState.lookY, 0);

  if (!reduceMotion) {
    // Ember light flickers; the pit itself never deforms.
    emberLight.intensity = 14 + Math.sin(t * 7.3) * 2.5 + Math.sin(t * 12.9) * 1.5;
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    // Sparks rise from the pit and recycle at the top of the band.
    const arr = pGeo.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3 + 1] += pSpeed[i] * dt;
      arr[i * 3] += Math.sin(t * 0.6 + pSeed[i]) * dt * 0.08;
      if (arr[i * 3 + 1] > PARTICLE_TOP) {
        arr[i * 3 + 1] = 0;
        arr[i * 3] = (Math.random() - 0.5) * 2.0;
      }
    }
    pGeo.attributes.position.needsUpdate = true;
  }

  renderer.render(scene, camera);
}

function tick() {
  if (!running) return;
  rafId = requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const t = clock.elapsedTime;

  scrollSmooth = reduceMotion ? scrollTarget
    : scrollSmooth + (scrollTarget - scrollSmooth) * (1 - Math.exp(-5.2 * dt));
  // Ease the camera/view toward the chosen view.
  const k = 1 - Math.exp(-4 * dt);
  viewState.rot += (viewTarget.rot - viewState.rot) * k;
  viewState.camY += (viewTarget.camY - viewState.camY) * k;
  viewState.camZ += (viewTarget.camZ - viewState.camZ) * k;
  viewState.lookY += (viewTarget.lookY - viewState.lookY) * k;

  renderFrame(t, dt);

  // Quality governor: sustained slow frames lower DPR first.
  frameAvg = frameAvg * 0.95 + (dt * 1000) * 0.05;
  if (frameAvg > 26 && governorStep < 2 && t > 3) {
    governorStep += 1;
    renderer.setPixelRatio(governorStep === 1 ? 1.25 : 1);
    renderer.setSize(stage.clientWidth, stage.clientHeight);
  }
}

function startLoop() {
  if (running || !modelLoaded || !stageVisible || !tabVisible) return;
  running = true;
  clock.getDelta();
  if (reduceMotion) {
    // Static frame: one render, no loop.
    renderFrame(0, 0);
    running = false;
    return;
  }
  tick();
}

function stopLoop() {
  running = false;
  cancelAnimationFrame(rafId);
}

if ('IntersectionObserver' in window) {
  new IntersectionObserver((entries) => {
    stageVisible = entries[0].isIntersecting;
    if (stageVisible) startLoop();
    else stopLoop();
  }).observe(stage);
}

document.addEventListener('visibilitychange', () => {
  tabVisible = !document.hidden;
  if (tabVisible) startLoop();
  else stopLoop();
});

if ('ResizeObserver' in window) {
  new ResizeObserver(() => {
    layout();
    if (reduceMotion && modelLoaded && stageVisible && tabVisible) renderFrame(0, 0);
  }).observe(stage);
}
window.addEventListener('resize', () => {
  layout();
  if (reduceMotion && modelLoaded && stageVisible && tabVisible) renderFrame(0, 0);
});

startLoop();
