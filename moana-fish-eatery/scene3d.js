/* Moana Fish Eatery — REAL 3D hero: a real fish model over a real photo.
 *
 * The hero object is "Barramundi Fish", a real glTF 2.0 model from the
 * Khronos glTF-Sample-Assets library (CC0-1.0, artist Microsoft, 2017).
 * It lives in this folder as fish.gltf + fish.bin + 3 JPEG textures
 * (original 2048px PNGs downscaled to 1024px JPEG, ~546 KB total).
 * Loaded with Three.js GLTFLoader — NO procedural geometry is used
 * for the hero object. The ocean behind it is a real Unsplash photo,
 * set as the .hero-stage background in styles.css; this canvas is
 * transparent (alpha) so the photo shows through.
 *
 * Layout guarantee: the canvas is absolutely positioned INSIDE
 * .hero-stage (position:relative; overflow:hidden) and is sized to
 * that element only — it can never paint over the headline, subtitle
 * or buttons, which live in the separate .hero-text zone above it.
 * If WebGL or the model fails, the canvas hides and the real ocean
 * photo simply stays visible. Page is fully readable either way.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('webgl');
const stage = document.getElementById('hero-stage');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const isMobile = () => window.innerWidth < 768;

function hideCanvas() {
  if (canvas) canvas.style.display = 'none';
}

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (err) {
  renderer = null;
}
if (renderer && !renderer.getContext()) renderer = null;
if (!renderer || !stage) {
  // No WebGL: hide the canvas, the real ocean photo behind it stays,
  // and the DOM page is fully readable. Nothing else to do.
  hideCanvas();
} else {
  init(renderer);
}

function init(renderer) {
  const stageW = () => stage.clientWidth || window.innerWidth;
  const stageH = () => stage.clientHeight || 420;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
  renderer.setSize(stageW(), stageH(), false);
  renderer.setClearColor(0x000000, 0); // transparent: the photo shows through
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a3f3d, 0.018);

  const camera = new THREE.PerspectiveCamera(38, stageW() / stageH(), 0.1, 100);
  camera.position.set(0, 0.35, 7.4);
  camera.lookAt(0, 0.3, 0);

  /* Light — soft daylight from the front-top, so the real fish
     reads clearly against the dark ocean photo. */
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a6f6a, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 6, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd8f3ee, 0.7);
  fill.position.set(-5, -1, 4);
  scene.add(fill);

  /* The fish — wrapper group positioned/framed by code, geometry
     entirely from the loaded .gltf file. */
  const wrapper = new THREE.Group();
  wrapper.position.y = 0.35;
  scene.add(wrapper);
  let fishReady = false;
  let baseScale = 1;

  // Model-space fact (verified from the .bin POSITION accessor):
  // the fish is long along Z (0.64), tall in Y (0.29), thin in X
  // (0.14); the head is the wider/taller end at -Z, tail at +Z.
  // Rotating -90° about Y lays it along X with the nose pointing
  // right (+X); wrapper rotation.z tilts the nose up: a leap.
  const FISH_LENGTH = 5.0; // world units, desktop (scaled down on mobile)
  const LEAP_TILT = 0.24;

  new GLTFLoader().load(
    'fish.gltf',
    (gltf) => {
      const fish = gltf.scene;
      fish.rotation.y = -Math.PI / 2; // long axis Z -> X, nose to +X
      wrapper.add(fish);
      // Centre the fish on the wrapper origin, then scale so its
      // longest side is FISH_LENGTH world units — big and unmistakable.
      const box = new THREE.Box3().setFromObject(wrapper);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      fish.position.sub(center);
      baseScale = FISH_LENGTH / Math.max(size.x, size.y, size.z);
      wrapper.scale.setScalar(baseScale * (isMobile() ? 0.62 : 1));
      wrapper.rotation.z = LEAP_TILT;
      fishReady = true;
      if (reduceMotion) applyFrame(0, 0, 0); // one static frame
    },
    undefined,
    (err) => {
      console.warn('Moana 3D fish failed to load, showing photo only:', err);
      hideCanvas();
    }
  );

  /* ---------------------------------------------------------------- */
  /* Scroll conductor — the fish turns as the hero scrolls away, so
   * visitors see the real model from several angles (the a1.gallery
   * rule: show the product from multiple angles). The stage itself
   * scrolls away normally; the loop pauses once it is off-screen.   */
  /* ---------------------------------------------------------------- */
  const heroEl = document.querySelector('.hero');
  function scrollProgress() {
    if (!heroEl) return 0;
    const h = heroEl.offsetHeight || window.innerHeight;
    return THREE.MathUtils.clamp(window.scrollY / Math.max(h * 0.85, 1), 0, 1);
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
    // Turntable: scroll turns the fish ~70° total; pointer adds a little.
    const turn = (p - 0.5) * 1.2 + pointer.x * 0.12;
    wrapper.rotation.y = turn;
    // Gentle leap bob (off under reduced motion) + slow scroll rise.
    if (!reduceMotion) {
      wrapper.position.y = 0.35 + Math.sin(t * 0.7) * 0.12 + p * 0.25;
      wrapper.rotation.z = LEAP_TILT + Math.sin(t * 0.5) * 0.03;
    } else {
      wrapper.position.y = 0.35 + p * 0.25;
      wrapper.rotation.z = LEAP_TILT;
    }
    // Camera drifts slightly with scroll; always looks at the fish.
    camera.position.set(-0.4 * p + pointer.x * 0.25, 0.35 + 0.4 * p - pointer.y * 0.2, 7.4 + 0.4 * p);
    camera.lookAt(0, 0.3, 0);
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    renderer.render(scene, camera);
  }

  /* ---------------------------------------------------------------- */
  /* Frame loop — pauses when the tab is hidden or the stage is gone;
   * quality governor drops DPR before anything else.                */
  /* ---------------------------------------------------------------- */
  const clock = new THREE.Clock();
  let rafId = 0;
  let running = false;
  let frameAvg = 16;
  let governorStep = 0;
  let stageVisible = true;

  function tick() {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    const t = clock.elapsedTime;
    applyFrame(scrollProgress(), t, dt);
    frameAvg = frameAvg * 0.95 + (dt * 1000) * 0.05;
    if (frameAvg > 26 && governorStep < 2 && t > 3) {
      governorStep += 1;
      renderer.setPixelRatio(governorStep === 1 ? 1.25 : 1);
      renderer.setSize(stageW(), stageH(), false);
    }
  }

  function startLoop() {
    if (running || document.hidden || !stageVisible) return;
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

  if (stage && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      stageVisible = entries[0].isIntersecting;
      if (stageVisible) startLoop();
      else stopLoop();
    }).observe(stage);
  }

  function resize() {
    camera.aspect = stageW() / stageH();
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
    renderer.setSize(stageW(), stageH(), false);
    if (fishReady) wrapper.scale.setScalar(baseScale * (isMobile() ? 0.62 : 1));
    if (reduceMotion) applyFrame(scrollProgress(), 0, 0);
  }
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(stage);
  }

  if (reduceMotion) {
    // Static scene: one frame once the model arrives (the load
    // callback renders it); until then the photo shows through.
    applyFrame(scrollProgress(), 0, 0);
  } else {
    startLoop();
  }
}
