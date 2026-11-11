/* Ruko Cafe — real 3D hero: a real coffee-cup .glb model (see
 * MODEL-CREDIT.md) loaded with Three.js GLTFLoader, presented in its own
 * stage over a real photo of roasted coffee beans.
 *
 * NO procedural geometry: no lathes, toruses, primitives, points or
 * sprites — the only 3D object is the loaded model. Lights are the only
 * other scene contents. The canvas lives INSIDE the hero stage element
 * (never fixed, never full-page), so it physically cannot cover the hero
 * headline, subtitle or buttons, which live in a separate grid column.
 *
 * Fallback: the canvas starts hidden. It is only revealed after the model
 * loads and the first frame renders. If WebGL, the CDN or the model file
 * fails, the canvas stays hidden and the stage simply shows its real
 * photo — the page is fully readable either way.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const stage = document.getElementById('hero-stage');
const canvas = document.getElementById('webgl');
const hero = document.querySelector('.hero');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const isMobile = () => window.innerWidth < 760;

function modelFailed(reason) {
  console.warn('[ruko-3d] 3D cup unavailable, photo stage remains:', reason);
  if (stage) stage.classList.add('model-off');
  if (canvas) canvas.hidden = true;
}

/* ------------------------------------------------------------------ */
/* Renderer (ACES tone mapping, DPR capped). No WebGL -> photo only.   */
/* ------------------------------------------------------------------ */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (err) {
  modelFailed(err);
}
if (!renderer) throw new Error('WebGL unavailable — photo fallback in use.');

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
renderer.setClearColor(0x000000, 0); // transparent: the photo shows through
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

/* ------------------------------------------------------------------ */
/* Light only — warm morning key, soft fill, cream hemisphere.         */
/* ------------------------------------------------------------------ */
scene.add(new THREE.HemisphereLight(0xfffaf0, 0x6b4a33, 0.85));

const key = new THREE.DirectionalLight(0xffe3b3, 1.6);
key.position.set(4, 6, 5);
scene.add(key);

const fill = new THREE.DirectionalLight(0xf3e9dc, 0.55);
fill.position.set(-5, 2, 4);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.4);
rim.position.set(-2, 3, -5);
scene.add(rim);

/* ------------------------------------------------------------------ */
/* The cup — real .glb model, centred and fitted to the stage.        */
/* Camera distance is computed from the model's own bounding sphere,   */
/* so the framing is right whatever the model's native scale is.       */
/* ------------------------------------------------------------------ */
const turntable = new THREE.Group();
scene.add(turntable);

let fitRadius = 2.6; // replaced by the real bounding sphere once loaded
let fitDistance = 8.6;
let modelReady = false;
let revealed = false;

function fitCamera() {
  const w = stage.clientWidth || 1;
  const h = stage.clientHeight || 1;
  camera.aspect = w / h;
  const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  const half = Math.min(vHalf, hHalf);
  fitDistance = (fitRadius / Math.sin(half)) * 1.04;
  camera.position.z = fitDistance;
  camera.position.y = 0.6;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function resize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
  fitCamera();
  if (modelReady) {
    if (reduceMotion) renderOnce();
  }
}

/* ------------------------------------------------------------------ */
/* Scroll — hero progress 0 at the top, 1 once the hero has scrolled  */
/* away. Scrolling spins the cup a little further and lifts the camera */
/* slightly, so the model is shown from more angles as you scroll.     */
/* ------------------------------------------------------------------ */
let heroH = 1;
let scrollTarget = 0;
let scrollSmooth = 0;
let scrollE = 0;

function measureHero() {
  heroH = hero ? hero.offsetHeight : window.innerHeight;
}
measureHero();

function readScroll() {
  scrollTarget = THREE.MathUtils.clamp((window.scrollY || 0) / Math.max(heroH, 1), 0, 1);
}

/* ------------------------------------------------------------------ */
/* Drag to spin + pointer parallax (desktop, fine pointers only).      */
/* ------------------------------------------------------------------ */
const drag = { active: false, id: -1, lastX: 0, lastY: 0 };
let targetRotY = 0.6; // opening angle: a three-quarter view of the cup
let targetRotX = 0;
let rotY = targetRotY;
let rotX = 0;
let userInteracted = false;

if (stage) {
  stage.addEventListener('pointerdown', (e) => {
    if (!modelReady || drag.active) return;
    drag.active = true;
    drag.id = e.pointerId;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    userInteracted = true;
    stage.classList.add('dragging');
    try { stage.setPointerCapture(e.pointerId); } catch (_) { /* no-op */ }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag.active || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    targetRotY += dx * 0.006;
    targetRotX = THREE.MathUtils.clamp(targetRotX + dy * 0.002, -0.25, 0.25);
  });
  const endDrag = (e) => {
    if (e.pointerId !== drag.id) return;
    drag.active = false;
    stage.classList.remove('dragging');
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
}

const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
if (!coarsePointer && !reduceMotion) {
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
}

/* ------------------------------------------------------------------ */
/* Frame loop — renders only while the stage is on screen and the tab  */
/* is visible. Quality governor drops DPR before anything else.        */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
let frameAvg = 16;
let governorStep = 0;
let stageVisible = true;
let tabVisible = true;
let rafId = 0;

function applyPose(dt, t) {
  // Damped drag rotation + slow idle spin (pauses once the user drags).
  if (!drag.active && !reduceMotion && !userInteracted) targetRotY += dt * 0.12;
  const k = 1 - Math.exp(-8 * dt);
  rotY += (targetRotY - rotY) * k;
  rotX += (targetRotX - rotX) * k;
  pointer.x += (pointer.tx - pointer.x) * 0.04;
  pointer.y += (pointer.ty - pointer.y) * 0.04;

  turntable.rotation.y = rotY + scrollE * 1.4;
  turntable.rotation.x = rotX;
  camera.position.y = 0.6 + scrollE * 0.6;
  camera.position.z = fitDistance * (1 - scrollE * 0.06);
  camera.position.x = pointer.x * 0.25;
  camera.lookAt(0, pointer.y * -0.12, 0);
}

function renderFrame(dt) {
  const t = clock.elapsedTime;
  readScroll();
  scrollSmooth += (scrollTarget - scrollSmooth) * (1 - Math.exp(-6 * dt));
  scrollE = scrollSmooth * scrollSmooth * (3 - 2 * scrollSmooth);
  applyPose(dt, t);
  renderer.render(scene, camera);
  if (!revealed) {
    revealed = true;
    canvas.hidden = false; // only now is the canvas allowed to appear
  }
}

function tick() {
  rafId = requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  renderFrame(dt);

  // Quality governor: sustained slow frames lower DPR first.
  frameAvg = frameAvg * 0.95 + (dt * 1000) * 0.05;
  if (frameAvg > 26 && governorStep < 2 && clock.elapsedTime > 3) {
    governorStep += 1;
    renderer.setPixelRatio(governorStep === 1 ? 1.25 : 1);
    fitCamera();
  }
}

function startLoop() {
  if (!tabVisible || !stageVisible || !modelReady) return;
  cancelAnimationFrame(rafId);
  clock.getDelta();
  tick();
}

function stopLoop() {
  cancelAnimationFrame(rafId);
}

if ('IntersectionObserver' in window && stage) {
  new IntersectionObserver((entries) => {
    stageVisible = entries[0].isIntersecting;
    if (reduceMotion) return;
    if (stageVisible && tabVisible && modelReady) startLoop();
    else stopLoop();
  }, { threshold: 0 }).observe(stage);
}

document.addEventListener('visibilitychange', () => {
  tabVisible = !document.hidden;
  if (reduceMotion) return;
  if (tabVisible && stageVisible && modelReady) startLoop();
  else stopLoop();
});

if ('ResizeObserver' in window && stage) {
  new ResizeObserver(resize).observe(stage);
} else {
  window.addEventListener('resize', resize);
}
window.addEventListener('resize', measureHero);
window.addEventListener('load', measureHero);

/* Reduced motion: one static frame at the opening angle, re-rendered
   only when scroll or resize moves the cup — no idle animation. */
function renderOnce() {
  readScroll();
  scrollE = THREE.MathUtils.clamp(scrollTarget, 0, 1);
  scrollE = scrollE * scrollE * (3 - 2 * scrollE);
  turntable.rotation.y = targetRotY + scrollE * 1.4;
  turntable.rotation.x = targetRotX;
  camera.position.y = 0.6 + scrollE * 0.6;
  camera.position.z = fitDistance * (1 - scrollE * 0.06);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  if (!revealed) {
    revealed = true;
    canvas.hidden = false;
  }
}

/* ------------------------------------------------------------------ */
/* Load the real model.                                                */
/* ------------------------------------------------------------------ */
fitCamera();

new GLTFLoader().load(
  'coffee-cup.glb',
  (gltf) => {
    const model = gltf.scene;
    // Centre the model on its own bounding-box centre, so it spins
    // around its middle instead of its file origin.
    const box = new THREE.Box3().setFromObject(model);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    fitRadius = Math.max(sphere.radius, 0.5);
    model.position.sub(sphere.center);
    turntable.add(model);
    modelReady = true;
    fitCamera();

    if (reduceMotion) {
      renderOnce();
      window.addEventListener('scroll', renderOnce, { passive: true });
      window.addEventListener('resize', renderOnce);
    } else {
      startLoop();
    }
  },
  undefined,
  (err) => modelFailed(err)
);
