/* Kairo homepage — one persistent Three.js world, driven by native scroll.
 * Follows open-3d-skills/threejs-scene (procedural geometry, ACES tone mapping,
 * DPR caps, FOV 38, quality tiers, reduced-motion) and
 * mengto-skills/build-threejs-scroll-worlds (one world + scroll conductor +
 * authored camera chapters) — kept light for static GitHub Pages: no build
 * step, no post-processing stack, no model files.
 */
import * as THREE from 'three';

const canvas = document.getElementById('webgl');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const isMobile = () => window.innerWidth < 760;

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
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.classList.add('webgl-on');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x17120f, 0.045);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.0, 7.4);

/* ------------------------------------------------------------------ */
/* Light — one warm key, one ember practical, soft hemisphere fill.    */
/* ------------------------------------------------------------------ */
scene.add(new THREE.HemisphereLight(0xfaf6ef, 0x241b14, 0.55));

const key = new THREE.DirectionalLight(0xfff1dd, 1.6);
key.position.set(4, 6, 6);
scene.add(key);

const emberLight = new THREE.PointLight(0xb3341f, 18, 12, 1.8);
emberLight.position.set(-2.5, 0.4, 3.2);
scene.add(emberLight);

/* ------------------------------------------------------------------ */
/* The K mark — built from code alone: three rounded bars, extruded   */
/* with a small bevel (threejs-scene: block it out, bevel the edges).  */
/* ------------------------------------------------------------------ */
const EMBER = 0xb3341f;

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function kBar(w, h, cx, cy, rotZ, zOff) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, 0.06), {
    depth: 0.3, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02,
    bevelSegments: 2, curveSegments: 8,
  });
  geo.translate(0, 0, -0.15 + zOff);
  const mesh = new THREE.Mesh(geo, kMaterial);
  mesh.position.set(cx, cy, 0);
  mesh.rotation.z = rotZ;
  return mesh;
}

const kMaterial = new THREE.MeshStandardMaterial({
  color: EMBER, metalness: 0.25, roughness: 0.35,
  emissive: 0x3a0d06, emissiveIntensity: 0.6,
});

const kGroup = new THREE.Group();
kGroup.add(kBar(0.38, 2.0, 0.19, 1.0, 0, 0));            // stem
kGroup.add(kBar(0.34, 1.25, 0.78, 1.5, -0.733, 0.004));  // upper arm
kGroup.add(kBar(0.34, 1.3, 0.82, 0.5, 0.733, 0.008));    // lower leg
kGroup.position.set(-0.675, -0.1, 0); // centre the 1.35 x 2.0 mark on the origin
scene.add(kGroup);

/* ------------------------------------------------------------------ */
/* Ember particle field — restrained ambient layer                     */
/* (mengto ambient-section-particles: bounded, DPR-capped, pausable). */
/* ------------------------------------------------------------------ */
const PARTICLE_COUNT = isMobile() ? 260 : 520;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PARTICLE_COUNT * 3);
const pCol = new Float32Array(PARTICLE_COUNT * 3);
const pSeed = new Float32Array(PARTICLE_COUNT);
const emberCol = new THREE.Color(0xe0452a);
const paleCol = new THREE.Color(0xfaf6ef);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  pPos[i * 3] = (Math.random() - 0.5) * 13;
  pPos[i * 3 + 1] = -2 + Math.random() * 7;
  pPos[i * 3 + 2] = -4 + Math.random() * 5;
  const c = Math.random() < 0.7 ? emberCol : paleCol;
  pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
  pSeed[i] = Math.random() * Math.PI * 2;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: 0.055, vertexColors: true, transparent: true, opacity: 0.75,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
}));
scene.add(particles);

/* ------------------------------------------------------------------ */
/* Scroll conductor — authored camera chapters, one per section.       */
/* (mengto build-threejs-scroll-worlds: one world, scroll as the      */
/* deterministic conductor; smoothed render state, exact target.)     */
/* ------------------------------------------------------------------ */
const chapters = [
  { pos: [0, 1.0, 7.4], tgt: [0, 0.95, 0], rotY: 0,    fov: 38 }, // hero
  { pos: [-2.6, 1.3, 6.6], tgt: [0.3, 0.9, 0], rotY: -0.5, fov: 38 }, // services
  { pos: [2.6, 1.1, 6.6], tgt: [-0.3, 0.9, 0], rotY: 0.5, fov: 38 }, // work
  { pos: [0, 2.0, 8.4], tgt: [0, 0.7, 0], rotY: 0,    fov: 38 }, // pricing
  { pos: [0, 1.0, 6.2], tgt: [0, 0.95, 0], rotY: 0,    fov: 38 }, // contact
];

const chapterEls = [...document.querySelectorAll('[data-chapter]')];
let chapterTops = [];
function measureChapters() {
  chapterTops = chapterEls.map((el) => el.offsetTop);
}
measureChapters();

function chapterProgress() {
  const y = window.scrollY;
  const first = chapterTops[0] ?? 0;
  const last = chapterTops[chapterTops.length - 1] ?? 1;
  const span = Math.max(last - first, 1);
  return THREE.MathUtils.clamp(((y - first) / span) * (chapters.length - 1), 0, chapters.length - 1);
}

function chapterState(p) {
  const i = Math.min(Math.floor(p), chapters.length - 2);
  const t = THREE.MathUtils.clamp(p - i, 0, 1);
  const a = chapters[i], b = chapters[i + 1];
  const mob = isMobile();
  const lerp = (u, v) => u + (v - u) * t;
  return {
    pos: [
      lerp(a.pos[0], b.pos[0]) * (mob ? 0.55 : 1),
      lerp(a.pos[1], b.pos[1]),
      lerp(a.pos[2], b.pos[2]) + (mob ? 1.8 : 0),
    ],
    tgt: [lerp(a.tgt[0], b.tgt[0]), lerp(a.tgt[1], b.tgt[1]), 0],
    rotY: lerp(a.rotY, b.rotY),
    fov: mob ? 46 : lerp(a.fov, b.fov),
  };
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
/* Frame loop — quality governor drops DPR before deleting landmarks.  */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
let smooth = chapterProgress();
let frameAvg = 16;
let governorStep = 0;
let visible = true;
let rafId = 0;

function applyState(s, dt, sway) {
  const damp = reduceMotion ? 1 : 1 - Math.exp(-5.2 * dt); // ease toward target
  camera.position.x += (s.pos[0] - camera.position.x) * damp;
  camera.position.y += (s.pos[1] - camera.position.y) * damp;
  camera.position.z += (s.pos[2] - camera.position.z) * damp;
  if (Math.abs(camera.fov - s.fov) > 0.01) {
    camera.fov += (s.fov - camera.fov) * damp;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(s.tgt[0], s.tgt[1], s.tgt[2]);
  // Damped toward the chapter rotation plus a small absolute sway (not accumulated).
  kGroup.rotation.y += (s.rotY + sway - kGroup.rotation.y) * damp;
}

function tick() {
  rafId = requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const t = clock.elapsedTime;

  const target = chapterProgress();
  smooth = reduceMotion ? target : smooth + (target - smooth) * (1 - Math.exp(-5.2 * dt));
  const sway = reduceMotion ? 0 : Math.sin(t * 0.25) * 0.06; // gentle idle sway
  applyState(chapterState(smooth), dt, sway);

  // Pointer parallax (blended out near transitions by keeping it small).
  pointer.x += (pointer.tx - pointer.x) * 0.04;
  pointer.y += (pointer.ty - pointer.y) * 0.04;
  kGroup.rotation.x = pointer.y * 0.08;
  if (!reduceMotion) {
    kGroup.position.y = -0.1 + Math.sin(t * 0.6) * 0.05; // gentle float
  }

  // Particles drift upward and recycle; static when reduced motion.
  if (!reduceMotion) {
    const arr = pGeo.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3 + 1] += dt * 0.12;
      arr[i * 3] += Math.sin(t * 0.5 + pSeed[i]) * dt * 0.05;
      if (arr[i * 3 + 1] > 5) arr[i * 3 + 1] = -2;
    }
    pGeo.attributes.position.needsUpdate = true;
    particles.rotation.y = pointer.x * 0.05;
  }

  renderer.render(scene, camera);

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
  if (visible) startLoop();
  else cancelAnimationFrame(rafId);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  measureChapters();
});

window.addEventListener('load', measureChapters);
startLoop();
