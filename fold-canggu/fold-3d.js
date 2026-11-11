/* Fold Canggu — one persistent, lightweight Three.js layer behind the page.
 *
 * Follows the Kairo homepage-3d reference (Three.js 0.169.0 via jsdelivr
 * import map, fixed <canvas id="webgl"> behind the DOM, .webgl-fallback
 * gradient, DPR caps, pause on hidden tab, static under
 * prefers-reduced-motion) and open-3d-skills/threejs-scene (procedural
 * geometry, ACES tone mapping, FOV 38, quality governor).
 *
 * The scene is a stylised golden croissant — Fold's signature bake —
 * floating in the hero band at the right edge, with drifting flour-dust
 * particles in the site palette (gold #B7791F, cream #FBF7F0, a touch of
 * jade #1E5B44 in the fill light only). The canvas renders the page's
 * cream ground itself, so the DOM needs no redesign: copy, photos, menu,
 * prices and the WhatsApp form are untouched.
 */
import * as THREE from 'three';

const canvas = document.getElementById('webgl');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const isMobile = () => window.innerWidth < 760;

/* Palette — Fold's own colours, from styles.css. */
const CREAM = 0xfbf7f0;
const GOLD = 0xb7791f;
const GOLD_LIGHT = 0xd9a441;
const CRUST = 0xe0a93f;
const CRUST_DEEP = 0xc98a2e;
const JADE = 0x1e5b44;

/* ------------------------------------------------------------------ */
/* Renderer — ACES tone mapping, DPR capped, cream scene background.   */
/* ------------------------------------------------------------------ */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
} catch (err) {
  // No WebGL: the CSS fallback gradient stays visible, DOM content intact.
  canvas.style.display = 'none';
}
if (!renderer) throw new Error('WebGL unavailable — static fallback in use.');

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.classList.add('webgl-on');

const scene = new THREE.Scene();
scene.background = new THREE.Color(CREAM);
scene.fog = new THREE.FogExp2(CREAM, 0.028);

const camera = new THREE.PerspectiveCamera(isMobile() ? 46 : 38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, isMobile() ? 9.0 : 7.4);
const LOOK_AT = new THREE.Vector3(0, 0, 0);
camera.lookAt(LOOK_AT);

/* ------------------------------------------------------------------ */
/* Light — warm key from the upper right, soft cream fill, a whisper   */
/* of jade from the left (the green-tiled house).                      */
/* ------------------------------------------------------------------ */
scene.add(new THREE.HemisphereLight(0xfffdf6, 0xe3d5c3, 0.75));

const key = new THREE.DirectionalLight(0xfff1dd, 1.5);
key.position.set(4, 6, 5);
scene.add(key);

const jadeFill = new THREE.PointLight(JADE, 6, 10, 1.8);
jadeFill.position.set(-3.5, 0.5, 2.5);
scene.add(jadeFill);

/* ------------------------------------------------------------------ */
/* The croissant — procedural only: a tapered torus crescent with     */
/* folded-layer bands and a few golden crumbs. No model files.        */
/* ------------------------------------------------------------------ */
const croissantMats = [];
function pastryMat(color, roughness) {
  const m = new THREE.MeshStandardMaterial({
    color, roughness, metalness: 0.0,
    emissive: 0x2a1503, emissiveIntensity: 0.22,
    transparent: true, opacity: 1,
  });
  croissantMats.push(m);
  return m;
}

function buildCroissant() {
  const group = new THREE.Group(); // positioned + faded by the conductor
  const shape = new THREE.Group(); // the crescent pose
  shape.rotation.z = THREE.MathUtils.degToRad(166.5); // fat middle down, tips up
  shape.rotation.x = -0.16;
  group.add(shape);

  const R = 1.05, TUBE = 0.42, ARC = Math.PI * 1.15;
  const tubular = 64, radial = 20;
  const taperAt = (t) => 0.42 + 0.58 * Math.sin(Math.PI * THREE.MathUtils.clamp(t, 0, 1));

  const geo = new THREE.TorusGeometry(R, TUBE, radial, tubular, ARC);
  // Taper the tube toward the tips. TorusGeometry emits vertices
  // row-major: row j = radial ring, column i = step along the arc, so
  // the arc angle for vertex (j, i) is exactly (i / tubular) * ARC.
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  if (pos.count === (radial + 1) * (tubular + 1)) {
    for (let j = 0; j <= radial; j++) {
      for (let i = 0; i <= tubular; i++) {
        const idx = j * (tubular + 1) + i;
        const u = (i / tubular) * ARC;
        const taper = taperAt(u / ARC);
        const cx = Math.cos(u) * R, cy = Math.sin(u) * R;
        v.fromBufferAttribute(pos, idx);
        pos.setXYZ(idx,
          cx + (v.x - cx) * taper,
          cy + (v.y - cy) * taper,
          v.z * taper);
      }
    }
  } else {
    // Fallback if a future three.js changes the vertex order.
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      let u = Math.atan2(v.y, v.x);
      if (u < 0) u += Math.PI * 2;
      const taper = taperAt(THREE.MathUtils.clamp(u / ARC, 0, 1));
      const cx = Math.cos(u) * R, cy = Math.sin(u) * R;
      pos.setXYZ(i,
        cx + (v.x - cx) * taper,
        cy + (v.y - cy) * taper,
        v.z * taper);
    }
  }
  geo.computeVertexNormals();
  shape.add(new THREE.Mesh(geo, pastryMat(CRUST, 0.55)));

  // Folded layers: thin bands wrapped around the body.
  const bandMat = pastryMat(GOLD, 0.6);
  const zAxis = new THREE.Vector3(0, 0, 1);
  [0.16, 0.34, 0.5, 0.66, 0.84].forEach((t) => {
    const u = t * ARC;
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(TUBE * taperAt(t), 0.05, 8, 28),
      bandMat);
    band.position.set(Math.cos(u) * R, Math.sin(u) * R, 0);
    band.quaternion.setFromUnitVectors(zAxis, new THREE.Vector3(-Math.sin(u), Math.cos(u), 0));
    shape.add(band);
  });

  // A few golden crumbs drifting near the bake.
  const crumbMat = pastryMat(CRUST_DEEP, 0.65);
  const crumbs = [];
  [[1.7, 0.9, 0.4, 0.09], [-1.5, 0.8, -0.3, 0.07], [0.5, -1.4, 0.5, 0.08], [2.3, -0.8, -0.4, 0.06]]
    .forEach(([x, y, z, r], k) => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), crumbMat);
      c.position.set(x, y, z);
      c.userData.baseY = y;
      c.userData.phase = k * 1.7;
      shape.add(c);
      crumbs.push(c);
    });

  return { group, crumbs };
}

const croissant = buildCroissant();
scene.add(croissant.group);

/* Layout — the croissant peeks in from the right edge of the hero
 * copy band (below the hero photo), clear of the headline and button. */
const layout = { x: 3.55, y: -1.85, s: 0.85 };
function layoutCroissant() {
  const mob = isMobile();
  layout.x = mob ? 1.05 : 3.55;
  layout.y = mob ? -2.1 : -1.85;
  layout.s = mob ? 0.55 : 0.85;
  croissant.group.position.set(layout.x, layout.y, 0);
  croissant.group.scale.set(layout.s, layout.s, layout.s * 0.78); // flattened, pastry-like
}
layoutCroissant();

/* ------------------------------------------------------------------ */
/* Flour-dust particles — golden and cream, drifting across the page.  */
/* ------------------------------------------------------------------ */
const PARTICLE_COUNT = isMobile() ? 170 : 320;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PARTICLE_COUNT * 3);
const pCol = new Float32Array(PARTICLE_COUNT * 3);
const pSeed = new Float32Array(PARTICLE_COUNT);
const goldCol = new THREE.Color(GOLD);
const lightGoldCol = new THREE.Color(GOLD_LIGHT);
const tanCol = new THREE.Color(0xc9a86a);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  pPos[i * 3] = (Math.random() - 0.5) * 14;
  pPos[i * 3 + 1] = -3 + Math.random() * 7.5;
  pPos[i * 3 + 2] = -3.5 + Math.random() * 5;
  const r = Math.random();
  const c = r < 0.45 ? goldCol : r < 0.8 ? lightGoldCol : tanCol;
  pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
  pSeed[i] = Math.random() * Math.PI * 2;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: 0.05, vertexColors: true, transparent: true, opacity: 0.55,
  depthWrite: false, sizeAttenuation: true,
}));
scene.add(particles);

/* ------------------------------------------------------------------ */
/* Scroll conductor — the camera drifts gently as the hero scrolls    */
/* away; the croissant turns and fades out, the dust stays.            */
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
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
let smoothP = scrollProgress();
let frameAvg = 16;
let governorStep = 0;
let visible = true;
let rafId = 0;

const BASE_ROT_Y = -0.35;

function applyFrame(dt, t, p) {
  camera.position.x = -0.5 * p;
  camera.position.y = 0.8 * p;
  camera.position.z = isMobile() ? 9.0 : 7.4;
  camera.lookAt(LOOK_AT);

  const fade = 1 - THREE.MathUtils.smoothstep(p, 0.55, 1.0);
  croissant.group.visible = fade > 0.01;
  if (croissant.group.visible) {
    croissant.group.rotation.y = BASE_ROT_Y + p * 0.7 + pointer.x * 0.12;
    croissant.group.rotation.x = pointer.y * 0.05;
    croissant.group.position.y = layout.y + (reduceMotion ? 0 : Math.sin(t * 0.6) * 0.06);
    croissantMats.forEach((m) => { m.opacity = fade; });
    if (!reduceMotion) {
      croissant.crumbs.forEach((c) => {
        c.position.y = c.userData.baseY + Math.sin(t * 0.9 + c.userData.phase) * 0.07;
      });
    }
  }

  // Flour dust drifts upward and recycles; static when reduced motion.
  if (!reduceMotion) {
    const arr = pGeo.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3 + 1] += dt * 0.1;
      arr[i * 3] += Math.sin(t * 0.4 + pSeed[i]) * dt * 0.04;
      if (arr[i * 3 + 1] > 4.5) arr[i * 3 + 1] = -3;
    }
    pGeo.attributes.position.needsUpdate = true;
    particles.rotation.y = pointer.x * 0.04;
  }
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
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

function renderOnce() {
  applyFrame(0, 0, scrollProgress());
  renderer.render(scene, camera);
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
  camera.fov = isMobile() ? 46 : 38;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  layoutCroissant();
  measure();
  if (reduceMotion) renderOnce();
});

window.addEventListener('load', () => { measure(); if (reduceMotion) renderOnce(); });

if (reduceMotion) renderOnce();
else startLoop();
