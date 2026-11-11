/* Ember landing page — 3D enhancement layer.
 * One persistent, lightweight Three.js scene: a procedural ember flame
 * (lathe flame + inner flame + coal bed + crossed logs, all built from
 * code, no model files) with drifting ember particles, floating over the
 * hero grill photo and fading out as the hero scrolls away.
 * Follows open-3d-skills/threejs-scene and the Kairo homepage-3d pattern:
 * Three.js 0.169.0 via jsdelivr import map, ACES tone mapping, DPR capped
 * (2 desktop / 1.5 mobile), FOV 38, pause when hidden or scrolled past,
 * static under prefers-reduced-motion. No post-processing, no bloom.
 *
 * Layering note: the homepage pattern puts the canvas *behind* the DOM,
 * but this page is opaque — a full-bleed hero photo and a flour-white
 * ground — so a behind-DOM canvas would be invisible 100% of the time.
 * Here the fixed canvas sits *between* the hero photo and the text chrome
 * (below the fixed header, action bar and skip link), so the flame reads
 * as fire rising from the grill photo. It never overlaps copy: the flame
 * and particles are framed inside the hero photo band and fade to zero
 * as the hero scrolls away.
 *
 * The 3D is purely additive. If WebGL or the CDN is unavailable the
 * module fails silently and the page is exactly the original page —
 * fully readable, menu, prices, booking form and WhatsApp behaviour
 * untouched. The existing interactions live in script.js (classic
 * script, unchanged); this module is separate so a 3D failure can
 * never break them.
 */
import * as THREE from 'three';

const canvas = document.getElementById('webgl');
const hero = document.querySelector('.hero');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const isMobile = () => window.innerWidth < 760;

/* ------------------------------------------------------------------ */
/* Renderer (threejs-scene: ACES, DPR capped, FOV ~38, alpha canvas)  */
/* ------------------------------------------------------------------ */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (err) {
  // No WebGL: hide the canvas; the page stays exactly as it was.
  canvas.style.display = 'none';
}
if (!renderer) throw new Error('WebGL unavailable — static page in use.');

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0); // transparent: the grill photo shows through
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.classList.add('webgl-on');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);

/* ------------------------------------------------------------------ */
/* Light — warm key, ember point light at the flame, soft fill.        */
/* ------------------------------------------------------------------ */
scene.add(new THREE.HemisphereLight(0xfaf6ef, 0x241b14, 0.5));

const key = new THREE.DirectionalLight(0xfff1dd, 1.4);
key.position.set(4, 6, 6);
scene.add(key);

const EMBER = 0xb3341f;

/* ------------------------------------------------------------------ */
/* The flame — procedural lathe teardrop, tip leaning like a real      */
/* flame in a draught (threejs-scene: block it out, bevel the edges).  */
/* ------------------------------------------------------------------ */
function flameGeometry() {
  const profile = [
    [0.001, 0.00], [0.42, 0.04], [0.62, 0.22], [0.68, 0.45],
    [0.60, 0.72], [0.46, 1.00], [0.32, 1.26], [0.20, 1.50],
    [0.10, 1.70], [0.03, 1.86], [0.001, 1.95],
  ];
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 40);
  // Lean the tip: bend grows with height squared.
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 1.95;
    pos.setX(i, pos.getX(i) + 0.34 * t * t);
  }
  geo.computeVertexNormals();
  return geo;
}

const flameGroup = new THREE.Group();

const outerFlame = new THREE.Mesh(flameGeometry(), new THREE.MeshStandardMaterial({
  color: 0xc23a1e, emissive: 0xe0452a, emissiveIntensity: 0.9,
  roughness: 0.42, metalness: 0.0,
}));
flameGroup.add(outerFlame);

const innerFlame = new THREE.Mesh(flameGeometry(), new THREE.MeshStandardMaterial({
  color: 0xe8622a, emissive: 0xe8912d, emissiveIntensity: 1.1,
  roughness: 0.4, metalness: 0.0,
}));
innerFlame.scale.setScalar(0.55);
innerFlame.position.set(0.06, 0.15, 0.05);
innerFlame.rotation.y = 0.6;
flameGroup.add(innerFlame);

/* Coal bed — a ring of dark lumps with glowing ember cores. */
const coalGeo = new THREE.DodecahedronGeometry(0.22, 0);
const coalMat = new THREE.MeshStandardMaterial({
  color: 0x2a1d16, emissive: EMBER, emissiveIntensity: 0.7, roughness: 0.9,
});
const coalMatHot = new THREE.MeshStandardMaterial({
  color: 0x2a1d16, emissive: 0xe0452a, emissiveIntensity: 1.0, roughness: 0.9,
});
const coalSpots = [
  [-0.45, 0.06, 0.18, 1.0], [0.42, 0.06, 0.22, 0.9], [-0.12, 0.07, -0.28, 1.1],
  [0.18, 0.06, -0.32, 0.85], [-0.52, 0.05, -0.12, 0.8], [0.55, 0.05, -0.05, 0.95],
  [0.02, 0.08, 0.34, 1.0],
];
coalSpots.forEach(([x, y, z, s], i) => {
  const coal = new THREE.Mesh(coalGeo, i % 2 === 0 ? coalMat : coalMatHot);
  coal.position.set(x, y, z);
  coal.scale.set(s, s * 0.6, s);
  coal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  flameGroup.add(coal);
});

/* Two crossed logs under the flame. */
const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.95 });
const logGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.6, 10);
[-0.45, 0.45].forEach((rotY, i) => {
  const log = new THREE.Mesh(logGeo, logMat);
  log.rotation.set(0, rotY, Math.PI / 2);
  log.position.set(0, 0.1, i === 0 ? 0.12 : -0.12);
  flameGroup.add(log);
});

/* Soft ember glow behind the flame — a procedural radial gradient, no bloom. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(224, 69, 42, 0.55)');
  g.addColorStop(0.4, 'rgba(179, 52, 31, 0.28)');
  g.addColorStop(1, 'rgba(179, 52, 31, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const glowMat = new THREE.MeshBasicMaterial({
  map: glowTexture(), transparent: true, opacity: 0.55,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), glowMat);
glow.position.set(0, 0.9, -0.8);
flameGroup.add(glow);

/* The flame's own light, flickering with it. */
const emberLight = new THREE.PointLight(0xe0452a, 20, 10, 1.8);
emberLight.position.set(0, 0.9, 0.8);
flameGroup.add(emberLight);

scene.add(flameGroup);

/* ------------------------------------------------------------------ */
/* Ember particle field — restrained ambient layer, biased to the      */
/* flame so nothing drifts over the headline.                          */
/* ------------------------------------------------------------------ */
const PARTICLE_COUNT = isMobile() ? 170 : 320;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PARTICLE_COUNT * 3);
const pCol = new Float32Array(PARTICLE_COUNT * 3);
const pSpeed = new Float32Array(PARTICLE_COUNT);
const pSeed = new Float32Array(PARTICLE_COUNT);
const emberCol = new THREE.Color(0xe0452a);
const goldCol = new THREE.Color(0xd9a441);
const paleCol = new THREE.Color(0xfaf6ef);
function spawnParticle(i, randomY) {
  const fx = flameGroup.position.x;
  pPos[i * 3] = fx + (Math.random() - 0.5) * (isMobile() ? 2.8 : 4.4);
  pPos[i * 3 + 1] = randomY ? PARTICLE_TOP + (Math.random() - 1) * (PARTICLE_TOP - PARTICLE_BOTTOM) : PARTICLE_BOTTOM;
  pPos[i * 3 + 2] = -1.5 + Math.random() * 2.5;
  const r = Math.random();
  const c = r < 0.6 ? emberCol : r < 0.85 ? goldCol : paleCol;
  pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
  pSpeed[i] = 0.15 + Math.random() * 0.2;
  pSeed[i] = Math.random() * Math.PI * 2;
}
// Particle band, set by layout() (world units, flame-relative heights).
let PARTICLE_BOTTOM = -0.3;
let PARTICLE_TOP = 3.2;
for (let i = 0; i < PARTICLE_COUNT; i++) spawnParticle(i, true);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: 0.06, vertexColors: true, transparent: true, opacity: 0.8,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
}));
scene.add(particles);

/* ------------------------------------------------------------------ */
/* Layout — frame the flame inside the hero photo band on any screen.  */
/* Desktop: flame right of centre, camera level. Mobile: flame centred */
/* and raised, camera further back with a wider FOV.                   */
/* ------------------------------------------------------------------ */
const layoutState = { baseY: -0.4, flameX: 1.55, lookX: 0.3, lookY: 0.45 };

function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  camera.aspect = aspect;
  if (isMobile()) {
    camera.fov = 46;
    camera.position.set(0, 0.9, 9.5);
    layoutState.flameX = 0;
    layoutState.baseY = 1.55;
    layoutState.lookX = 0;
    layoutState.lookY = 0.9;
    flameGroup.scale.setScalar(0.72);
    PARTICLE_BOTTOM = 1.7;
    PARTICLE_TOP = 4.6;
  } else {
    camera.fov = 38;
    camera.position.set(0, 0.9, 7.4);
    // Keep the flame inside the frame on narrow desktop/tablet widths.
    const halfWidth = Math.tan(THREE.MathUtils.degToRad(19)) * 7.4 * aspect;
    layoutState.flameX = Math.min(1.55, Math.max(0, halfWidth - 1.2));
    layoutState.baseY = -0.4;
    layoutState.lookX = layoutState.flameX * 0.2;
    layoutState.lookY = 0.45;
    flameGroup.scale.setScalar(1);
    PARTICLE_BOTTOM = -0.3;
    PARTICLE_TOP = 3.2;
  }
  flameGroup.position.set(layoutState.flameX, layoutState.baseY, 0);
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
  renderer.setSize(w, h);
  // Re-seed particles into the new band.
  for (let i = 0; i < PARTICLE_COUNT; i++) spawnParticle(i, true);
  pGeo.attributes.position.needsUpdate = true;
}
layout();

/* ------------------------------------------------------------------ */
/* Scroll — the flame fades out as the hero scrolls away, with a      */
/* slight rise and turn while it is still visible.                     */
/* ------------------------------------------------------------------ */
let scrollTarget = 0;   // 0 = hero fully in view, 1 = hero gone
let scrollSmooth = 0;
function measureScroll() {
  scrollTarget = THREE.MathUtils.clamp(window.scrollY / 300, 0, 1);
}
measureScroll();
scrollSmooth = scrollTarget; // start at the true position: no flash if the page loads scrolled
window.addEventListener('scroll', measureScroll, { passive: true });

/* Pointer parallax — restrained, clamped, off on coarse pointers. */
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
if (!coarsePointer && !reduceMotion) {
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
}

/* ------------------------------------------------------------------ */
/* Frame loop — runs only while the hero is on screen and the tab is   */
/* visible; quality governor drops DPR before anything else.           */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
let frameAvg = 16;
let governorStep = 0;
let heroVisible = true;
let tabVisible = !document.hidden;
let running = false;
let rafId = 0;

function renderFrame(t, dt) {
  const s = scrollSmooth;
  // Fade the whole canvas out as the hero leaves.
  canvas.style.opacity = String(1 - s);
  // Gentle scroll drift: flame rises and turns a touch, camera lifts.
  flameGroup.position.y = layoutState.baseY + s * 0.35;
  flameGroup.rotation.y = pointer.x * 0.06 + s * 0.35;
  camera.position.y = 0.9 + s * 0.5;
  camera.lookAt(layoutState.lookX, layoutState.lookY, 0);

  if (!reduceMotion) {
    // Flicker: flame breathes, its light and glow breathe with it.
    const breathe = 1 + Math.sin(t * 5.3) * 0.02 + Math.sin(t * 9.1) * 0.015;
    outerFlame.scale.setScalar(breathe);
    innerFlame.scale.setScalar(0.55 * (1 + Math.sin(t * 6.7 + 1.3) * 0.03));
    emberLight.intensity = 20 + Math.sin(t * 7.3) * 2.5 + Math.sin(t * 12.9) * 1.5;
    glowMat.opacity = 0.55 + Math.sin(t * 6.1) * 0.06;
    // Pointer parallax on the flame.
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    flameGroup.rotation.x = pointer.y * 0.05;
    // Particles rise and sway, recycling at the top of the band.
    const arr = pGeo.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3 + 1] += pSpeed[i] * dt;
      arr[i * 3] += Math.sin(t * 0.6 + pSeed[i]) * dt * 0.08;
      if (arr[i * 3 + 1] > PARTICLE_TOP) {
        arr[i * 3 + 1] = PARTICLE_BOTTOM;
        arr[i * 3] = flameGroup.position.x + (Math.random() - 0.5) * (isMobile() ? 2.8 : 4.4);
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

  renderFrame(t, dt);

  // Quality governor: sustained slow frames lower DPR first.
  frameAvg = frameAvg * 0.95 + (dt * 1000) * 0.05;
  if (frameAvg > 26 && governorStep < 2 && t > 3) {
    governorStep += 1;
    renderer.setPixelRatio(governorStep === 1 ? 1.25 : 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

function startLoop() {
  if (running || !heroVisible || !tabVisible) return;
  running = true;
  clock.getDelta();
  if (reduceMotion) {
    // Static frame: one render, no loop. Opacity still follows scroll
    // via the scroll listener below (a scroll-linked change, not motion).
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

// Reduced motion: keep the canvas fade scroll-linked without animating.
if (reduceMotion) {
  window.addEventListener('scroll', () => {
    measureScroll();
    canvas.style.opacity = String(1 - scrollTarget);
  }, { passive: true });
}

if ('IntersectionObserver' in window && hero) {
  new IntersectionObserver((entries) => {
    heroVisible = entries[0].isIntersecting;
    if (heroVisible) startLoop();
    else stopLoop();
  }).observe(hero);
}

document.addEventListener('visibilitychange', () => {
  tabVisible = !document.hidden;
  if (tabVisible) startLoop();
  else stopLoop();
});

window.addEventListener('resize', () => {
  layout();
  if (reduceMotion && heroVisible && tabVisible) renderFrame(0, 0);
});

startLoop();
