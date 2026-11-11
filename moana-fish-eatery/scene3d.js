/* Moana Fish Eatery — one lightweight Three.js enhancement layer.
 * Follows open-3d-skills/threejs-scene (procedural geometry, ACES tone
 * mapping, DPR caps, FOV 38, reduced-motion) and the Kairo homepage
 * pattern (fixed <canvas id="webgl"> behind the DOM + .webgl-fallback).
 *
 * The scene is a stylised ocean wave: a curling teal ribbon, a lighter
 * crest tube, a small leaping fish, and drifting sea-foam particles —
 * all in the site palette (#0e6e6a ocean teal on #faf6ef flour-white).
 * It lives behind the hero, fades out as the hero scrolls away, and the
 * loop pauses when the tab is hidden or the hero is off-screen.
 * No copy, prices, links or form behaviour are touched by this file.
 */
import * as THREE from 'three';

const canvas = document.getElementById('webgl');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const isMobile = () => window.innerWidth < 760;

/* ------------------------------------------------------------------ */
/* Renderer (threejs-scene: ACES tone mapping, DPR capped, FOV ~38)   */
/* ------------------------------------------------------------------ */
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (err) {
  renderer = null;
}
if (renderer && !renderer.getContext()) renderer = null;
if (!renderer) {
  // No WebGL: hide the canvas, the CSS fallback gradient stays visible,
  // and the DOM page is fully readable. Nothing else to do.
  if (canvas) canvas.style.display = 'none';
} else {
  init(renderer);
}

function init(renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xfaf6ef, 1); // the canvas paints the flour ground
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.classList.add('webgl-on');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xfaf6ef, 0.028);

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.55, 7.6);

  /* ---------------------------------------------------------------- */
  /* Light — soft daylight, so teal reads as water, not plastic.       */
  /* ---------------------------------------------------------------- */
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fc6c0, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(4, 6, 5);
  scene.add(key);
  const tealGlow = new THREE.PointLight(0x0e6e6a, 6, 9, 1.8);
  tealGlow.position.set(-2.5, -1.0, 2.5);
  scene.add(tealGlow);

  /* ---------------------------------------------------------------- */
  /* The wave — procedural geometry, no model files.                   */
  /* A curling ribbon (displaced plane) + a lighter crest tube that    */
  /* follows the swell, + a small stylised fish leaping over it.       */
  /* ---------------------------------------------------------------- */
  const ocean = new THREE.Group();
  ocean.position.set(0.9, -1.35, -0.8);
  ocean.rotation.z = -0.04;
  scene.add(ocean);

  const fadeMats = []; // { mat, base } — faded out as the hero scrolls away
  function track(mat, base) {
    mat.transparent = true;
    fadeMats.push({ mat, base });
    return mat;
  }

  // Ribbon: 7.5 wide, swells up toward the middle and curls toward camera.
  const waveGeo = new THREE.PlaneGeometry(7.5, 1.5, 72, 10);
  const wPos = waveGeo.attributes.position;
  for (let i = 0; i < wPos.count; i++) {
    const x = wPos.getX(i);
    const y = wPos.getY(i);
    const u = (x + 3.75) / 7.5; // 0..1 across the ribbon
    const swell = Math.sin(u * Math.PI);
    wPos.setZ(i, 0.55 * swell * swell + 0.15 * Math.sin(x * 2.0 + y * 1.5));
    wPos.setY(i, y + 0.22 * Math.sin(u * Math.PI * 2));
  }
  waveGeo.computeVertexNormals();
  const waveMat = track(new THREE.MeshStandardMaterial({
    color: 0x0e6e6a, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide,
  }), 0.95);
  ocean.add(new THREE.Mesh(waveGeo, waveMat));

  // Crest: a tube following an S-curve just above the ribbon's swell.
  const crestCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.2, 0.55, 0.35),
    new THREE.Vector3(-1.8, 0.95, 0.55),
    new THREE.Vector3(-0.4, 0.72, 0.45),
    new THREE.Vector3(0.9, 1.05, 0.6),
    new THREE.Vector3(2.2, 0.68, 0.4),
    new THREE.Vector3(3.3, 0.9, 0.5),
  ]);
  const crestMat = track(new THREE.MeshStandardMaterial({
    color: 0x1b9e96, roughness: 0.45, metalness: 0.05,
  }), 0.95);
  ocean.add(new THREE.Mesh(new THREE.TubeGeometry(crestCurve, 48, 0.09, 8, false), crestMat));

  // Fish: one extruded outline (body + forked tail), nose up, mid-leap.
  const fishShape = new THREE.Shape();
  fishShape.moveTo(0.7, 0);
  fishShape.quadraticCurveTo(0.35, 0.34, -0.15, 0.28);
  fishShape.quadraticCurveTo(-0.45, 0.24, -0.55, 0.12);
  fishShape.lineTo(-0.85, 0.34);
  fishShape.lineTo(-0.72, 0);
  fishShape.lineTo(-0.85, -0.34);
  fishShape.lineTo(-0.55, -0.12);
  fishShape.quadraticCurveTo(-0.45, -0.24, -0.15, -0.28);
  fishShape.quadraticCurveTo(0.35, -0.34, 0.7, 0);
  const fishGeo = new THREE.ExtrudeGeometry(fishShape, {
    depth: 0.14, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02,
    bevelSegments: 2, curveSegments: 12,
  });
  fishGeo.translate(0.075, 0, -0.07);
  const fishMat = track(new THREE.MeshStandardMaterial({
    color: 0x17a398, roughness: 0.5, metalness: 0.08,
  }), 1);
  const fish = new THREE.Group();
  fish.add(new THREE.Mesh(fishGeo, fishMat));
  const eyeMat = track(new THREE.MeshStandardMaterial({ color: 0x1f2a28, roughness: 0.4 }), 1);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), eyeMat);
  eye.position.set(0.52, 0.07, 0.1);
  fish.add(eye);
  fish.position.set(1.55, 0.75, 0.35);
  fish.rotation.z = -0.28;
  ocean.add(fish);
  const fishBaseY = fish.position.y;

  if (isMobile()) {
    ocean.scale.setScalar(0.7);
    ocean.position.x = 0.35;
  }

  /* ---------------------------------------------------------------- */
  /* Sea-foam particles — restrained ambient layer, normal blending    */
  /* (additive would wash out on the light flour ground).              */
  /* ---------------------------------------------------------------- */
  const PARTICLE_COUNT = isMobile() ? 200 : 380;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PARTICLE_COUNT * 3);
  const pCol = new Float32Array(PARTICLE_COUNT * 3);
  const pSeed = new Float32Array(PARTICLE_COUNT);
  const white = new THREE.Color(0xffffff);
  const paleTeal = new THREE.Color(0x9fd8d2);
  const midTeal = new THREE.Color(0x2a9d8f);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 13;
    pPos[i * 3 + 1] = -2.5 + Math.random() * 6;
    pPos[i * 3 + 2] = -3 + Math.random() * 4;
    const r = Math.random();
    const c = r < 0.6 ? white : (r < 0.85 ? paleTeal : midTeal);
    pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
    pSeed[i] = Math.random() * Math.PI * 2;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = track(new THREE.PointsMaterial({
    size: 0.06, vertexColors: true, transparent: true, opacity: 0.55,
    depthWrite: false, sizeAttenuation: true,
  }), 0.55);
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ---------------------------------------------------------------- */
  /* Scroll conductor — the camera drifts gently as the hero scrolls   */
  /* away, and the whole scene fades out so later sections stay clean. */
  /* ---------------------------------------------------------------- */
  const heroEl = document.querySelector('.hero');
  function scrollProgress() {
    const h = heroEl ? heroEl.offsetHeight : window.innerHeight;
    return THREE.MathUtils.clamp(window.scrollY / Math.max(h * 0.9, 1), 0, 1);
  }

  /* Pointer parallax — restrained, clamped, off on coarse pointers. */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!coarsePointer && !reduceMotion) {
    window.addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  function applyFrame(p, t, dt) {
    // Camera drift with scroll.
    camera.position.set(-0.5 * p, 0.55 + 0.5 * p, 7.6 + 0.5 * p);
    camera.lookAt(0, 0.05 - 0.3 * p, 0);
    // Fade the scene out as the hero leaves.
    const fade = 1 - p;
    for (const f of fadeMats) f.mat.opacity = f.base * fade;
    // Gentle idle motion (off under reduced motion).
    if (!reduceMotion) {
      ocean.position.y = -1.35 + Math.sin(t * 0.6) * 0.04;
      ocean.rotation.y = pointer.x * 0.06;
      ocean.rotation.x = pointer.y * 0.04;
      fish.position.y = fishBaseY + Math.sin(t * 0.8) * 0.08;
      fish.rotation.z = -0.28 + Math.sin(t * 0.5) * 0.05;
      const arr = pGeo.attributes.position.array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        arr[i * 3 + 1] += dt * 0.10;
        arr[i * 3] += Math.sin(t * 0.4 + pSeed[i]) * dt * 0.04;
        if (arr[i * 3 + 1] > 3.8) arr[i * 3 + 1] = -2.5;
      }
      pGeo.attributes.position.needsUpdate = true;
    }
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    renderer.render(scene, camera);
  }

  /* ---------------------------------------------------------------- */
  /* Frame loop — pauses when the tab is hidden or the hero is gone;  */
  /* quality governor drops DPR before anything else.                  */
  /* ---------------------------------------------------------------- */
  const clock = new THREE.Clock();
  let rafId = 0;
  let running = false;
  let frameAvg = 16;
  let governorStep = 0;
  let heroVisible = true;

  function tick() {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    const t = clock.elapsedTime;
    applyFrame(scrollProgress(), t, dt);
    frameAvg = frameAvg * 0.95 + (dt * 1000) * 0.05;
    if (frameAvg > 26 && governorStep < 2 && t > 3) {
      governorStep += 1;
      renderer.setPixelRatio(governorStep === 1 ? 1.25 : 1);
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  function startLoop() {
    if (running || document.hidden || !heroVisible) return;
    running = true;
    clock.getDelta();
    tick();
  }
  function stopLoop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop();
    else startLoop();
  });

  if (heroEl && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      heroVisible = entries[0].isIntersecting;
      if (heroVisible) startLoop();
      else stopLoop();
    }).observe(heroEl);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (reduceMotion) applyFrame(scrollProgress(), 0, 0);
  });

  if (reduceMotion) {
    // Static scene: one frame, no animation loop.
    applyFrame(scrollProgress(), 0, 0);
  } else {
    startLoop();
  }
}
