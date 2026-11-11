/* Kairo homepage — real 3D model hero (GLB), scroll-driven turning.
 * The hero object is a real model file, not procedural geometry:
 * "Kairo K" — Kairo's own logo mark, modelled in-house from the logo
 * (k-logo.webp) as three extruded, bevelled bars and exported as
 * k-model.glb (see CREDITS-3D.md — no third-party credit needed).
 * Loaded with GLTFLoader from ./k-model.glb.
 * The canvas lives only inside .stage-view (its own grid cell), so the
 * model can never cover text. Static files, no build step.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('webgl');
const stageView = document.querySelector('.stage-view');
const hero = document.querySelector('.hero');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const isMobile = () => window.innerWidth < 760;

function showFallback() {
  document.body.classList.add('webgl-off');
  document.body.classList.remove('webgl-on');
  if (canvas) canvas.style.display = 'none';
}

/* ------------------------------------------------------------------ */
/* Renderer — transparent so the real photo behind it shows through.  */
/* ------------------------------------------------------------------ */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (err) {
  showFallback();
}
if (!renderer) {
  // No WebGL: the stage photo + logo fallback stay visible, page intact.
  showFallback();
  // Nothing else to do — this module ends cleanly.
} else {
  init(renderer);
}

function init(renderer) {
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(isMobile() ? 46 : 38, 1, 0.1, 100);

  /* Light — one warm key, one ember practical, soft hemisphere fill. */
  scene.add(new THREE.HemisphereLight(0xfaf6ef, 0x241b14, 0.55));
  const key = new THREE.DirectionalLight(0xfff1dd, 1.6);
  key.position.set(4, 6, 6);
  scene.add(key);
  const emberLight = new THREE.PointLight(0xb3341f, 18, 14, 1.8);
  emberLight.position.set(-2.5, 0.4, 3.2);
  scene.add(emberLight);

  /* ---------------------------------------------------------------- */
  /* The model — loaded from file, centred and scaled from its own    */
  /* bounding box, then framed by distance computed from the same box  */
  /* (fit-to-view: the model always fits the stage, desktop + mobile). */
  /* ---------------------------------------------------------------- */
  const modelRoot = new THREE.Group();
  scene.add(modelRoot);

  let modelRadius = 1; // bounding-sphere radius, set once the model loads
  let modelLoaded = false;

  function frameCamera() {
    const w = stageView.clientWidth || 1;
    const h = stageView.clientHeight || 1;
    camera.aspect = w / h;
    const vFov = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hFov = Math.atan(Math.tan(vFov) * camera.aspect);
    const dist = (modelRadius / Math.tan(Math.min(vFov, hFov))) * 1.18;
    // Slightly above centre: a gentle top-down three-quarter view.
    camera.position.set(0, dist * 0.22, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function sizeRenderer() {
    const w = stageView.clientWidth || 1;
    const h = stageView.clientHeight || 1;
    renderer.setSize(w, h, false);
    if (modelLoaded) frameCamera();
    else {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  /* -------------------------------------------------------------- */
  /* Ember dust — a small ambient particle effect, not an object.    */
  /* -------------------------------------------------------------- */
  const PARTICLE_COUNT = isMobile() ? 90 : 180;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PARTICLE_COUNT * 3);
  const pCol = new Float32Array(PARTICLE_COUNT * 3);
  const pSeed = new Float32Array(PARTICLE_COUNT);
  const emberCol = new THREE.Color(0xe0452a);
  const paleCol = new THREE.Color(0xfaf6ef);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 4.4;
    pPos[i * 3 + 1] = -1.6 + Math.random() * 3.2;
    pPos[i * 3 + 2] = -1 + Math.random() * 2.5;
    const c = Math.random() < 0.7 ? emberCol : paleCol;
    pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
    pSeed[i] = Math.random() * Math.PI * 2;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.045, vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(particles);

  /* -------------------------------------------------------------- */
  /* Input — scroll turns the model; drag turns it by hand; pointer  */
  /* tilt is a small extra on fine pointers only.                   */
  /* -------------------------------------------------------------- */
  let dragOffset = 0; // user drag, radians, clamped
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let dragging = false;
  let lastX = 0;

  function heroProgress() {
    if (!hero) return 0;
    const max = Math.max(hero.offsetHeight - window.innerHeight * 0.6, 1);
    return THREE.MathUtils.clamp(window.scrollY / max, 0, 1);
  }

  if (!reduceMotion) {
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      canvas.classList.add('dragging');
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (dragging) {
        dragOffset = THREE.MathUtils.clamp(dragOffset + (e.clientX - lastX) * 0.006, -1.5, 1.5);
        lastX = e.clientX;
      } else if (!coarsePointer) {
        const r = stageView.getBoundingClientRect();
        pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      }
    });
    const endDrag = () => { dragging = false; canvas.classList.remove('dragging'); };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
  }

  /* -------------------------------------------------------------- */
  /* Frame loop — runs only while the stage is on screen and the tab  */
  /* is visible. Reduced motion: one static frame, no loop.          */
  /* -------------------------------------------------------------- */
  const clock = new THREE.Clock();
  let rafId = 0;
  let pageVisible = true;
  let stageVisible = true;
  let frameAvg = 16;
  let governorStep = 0;

  function renderFrame() {
    const dt = Math.min(clock.getDelta(), 1 / 30);
    const t = clock.elapsedTime;

    if (!reduceMotion) {
      const scrollTurn = -0.55 + heroProgress() * 1.1;
      const sway = Math.sin(t * 0.25) * 0.06;
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      const targetY = scrollTurn + dragOffset + sway + pointer.x * 0.1;
      modelRoot.rotation.y += (targetY - modelRoot.rotation.y) * (1 - Math.exp(-5.2 * dt));
      modelRoot.rotation.x = pointer.y * 0.08;
      modelRoot.position.y = Math.sin(t * 0.6) * 0.04;

      const arr = pGeo.attributes.position.array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        arr[i * 3 + 1] += dt * 0.12;
        arr[i * 3] += Math.sin(t * 0.5 + pSeed[i]) * dt * 0.05;
        if (arr[i * 3 + 1] > 1.6) arr[i * 3 + 1] = -1.6;
      }
      pGeo.attributes.position.needsUpdate = true;
      particles.rotation.y = pointer.x * 0.05;

      frameAvg = frameAvg * 0.95 + (dt * 1000) * 0.05;
      if (frameAvg > 26 && governorStep < 2 && t > 3) {
        governorStep += 1;
        renderer.setPixelRatio(governorStep === 1 ? 1.25 : 1);
        sizeRenderer();
      }
    }

    renderer.render(scene, camera);
  }

  function tick() {
    rafId = requestAnimationFrame(tick);
    renderFrame();
  }

  function maybeStart() {
    if (reduceMotion) return; // static frame only (rendered once on load)
    if (pageVisible && stageVisible) {
      cancelAnimationFrame(rafId);
      clock.getDelta();
      tick();
    } else {
      cancelAnimationFrame(rafId);
    }
  }

  document.addEventListener('visibilitychange', () => {
    pageVisible = !document.hidden;
    maybeStart();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      stageVisible = entries[0].isIntersecting;
      maybeStart();
    }, { threshold: 0.02 }).observe(stageView);
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(rafId);
    showFallback();
  });

  /* Resize — ResizeObserver on the stage keeps the canvas fitted. */
  const resize = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
    camera.fov = isMobile() ? 46 : 38;
    sizeRenderer();
    if (reduceMotion && modelLoaded) renderer.render(scene, camera);
  };
  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(stageView);
  }
  window.addEventListener('resize', resize);
  sizeRenderer();

  /* -------------------------------------------------------------- */
  /* Load the model.                                                 */
  /* -------------------------------------------------------------- */
  new GLTFLoader().load(
    'k-model.glb',
    (gltf) => {
      const inner = gltf.scene;
      // The K is exported at stage scale (2 units tall, centred on the
      // origin) — no rescaling needed.
      modelRoot.add(inner);
      // Centre the model on the origin from its own bounding box.
      const box = new THREE.Box3().setFromObject(modelRoot);
      const centre = box.getCenter(new THREE.Vector3());
      inner.position.sub(centre);
      const size = box.getSize(new THREE.Vector3());
      modelRadius = size.length() / 2;
      modelLoaded = true;
      frameCamera();
      document.body.classList.add('webgl-on');
      document.body.classList.remove('webgl-off');
      if (reduceMotion) {
        // One static frame at a pleasing three-quarter angle.
        modelRoot.rotation.y = 0.35;
        modelRoot.rotation.x = 0.05;
        renderer.render(scene, camera);
      } else {
        maybeStart();
      }
    },
    undefined,
    () => {
      // Model file missing or unreadable: logo fallback over the photo.
      cancelAnimationFrame(rafId);
      showFallback();
    },
  );
}
