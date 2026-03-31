import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import earthVertexShader from "../shaders/earth/vertex.glsl?raw";
import earthFragmentShader from "../shaders/earth/fragment.glsl?raw";
import atmosphereVertexShader from "../shaders/atmosphere/vertex.glsl?raw";
import atmosphereFragmentShader from "../shaders/atmosphere/fragment.glsl?raw";

function createSolidTexture(color: [number, number, number, number] = [255, 255, 255, 255]) {
  const data = new Uint8Array(color);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function clampDpr(dpr: number) {
  return Math.min(Math.max(dpr, 1), 2);
}

function setupEarth(canvas: HTMLCanvasElement, container: HTMLElement) {
  const scene = new THREE.Scene();

  const sizes = {
    width: container.clientWidth,
    height: container.clientHeight,
    dpr: clampDpr(window.devicePixelRatio),
  };

  const camera = new THREE.PerspectiveCamera(25, sizes.width / sizes.height, 0.1, 100);
  camera.position.set(12, 5, 4);
  camera.lookAt(0, 0, 0);
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(sizes.dpr);
  renderer.setSize(sizes.width, sizes.height);
  // Opaque dark background ensures the scene is always visible
  // (some browsers/drivers can render alpha=0 clears unexpectedly).
  renderer.setClearColor(0x000011, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 6;
  controls.maxDistance = 18;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.7;
  controls.target.set(0, 0, 0);

  const earthParameters = {
    atmosphereDayColor: "#00aaff",
    atmosphereTwilightColor: "#ff6600",
  };

  const loader = new THREE.TextureLoader();
  const placeholderDay = createSolidTexture([40, 120, 200, 255]);
  const placeholderNight = createSolidTexture([5, 10, 30, 255]);
  const placeholderSpec = createSolidTexture([255, 255, 255, 255]);

  const uDayTexture = new THREE.Uniform(placeholderDay);
  const uNightTexture = new THREE.Uniform(placeholderNight);
  const uSpecularCloudsTexture = new THREE.Uniform(placeholderSpec);

  const loadImage = (
    url: string,
    onOk: (t: THREE.Texture) => void,
    label: string,
  ) => {
    loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        onOk(t);
      },
      undefined,
      () => {
        // eslint-disable-next-line no-console
        console.warn(`Failed loading ${label}; using placeholder`);
      },
    );
  };

  loadImage("/static/earth/day.jpg", (t) => (uDayTexture.value = t), "/static/earth/day.jpg");
  loadImage("/static/earth/night.jpg", (t) => (uNightTexture.value = t), "/static/earth/night.jpg");
  loadImage(
    "/static/earth/specularClouds.jpg",
    (t) => (uSpecularCloudsTexture.value = t),
    "/static/earth/specularClouds.jpg",
  );

  const earthGeometry = new THREE.SphereGeometry(2, 64, 64);
  const sunDirection = new THREE.Vector3(0.6, 0.15, 1).normalize();

  const earthMaterial = new THREE.ShaderMaterial({
    vertexShader: earthVertexShader,
    fragmentShader: earthFragmentShader,
    toneMapped: true,
    uniforms: {
      uDayTexture,
      uNightTexture,
      uSpecularCloudsTexture,
      uSunDirection: new THREE.Uniform(sunDirection),
      uAtmosphereDayColor: new THREE.Uniform(new THREE.Color(earthParameters.atmosphereDayColor)),
      uAtmosphereTwilightColor: new THREE.Uniform(new THREE.Color(earthParameters.atmosphereTwilightColor)),
    },
  });

  const earth = new THREE.Mesh(earthGeometry, earthMaterial);
  scene.add(earth);

  const atmosphereMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    toneMapped: true,
    uniforms: {
      uSunDirection: new THREE.Uniform(sunDirection),
      uAtmosphereDayColor: new THREE.Uniform(new THREE.Color(earthParameters.atmosphereDayColor)),
      uAtmosphereTwilightColor: new THREE.Uniform(new THREE.Color(earthParameters.atmosphereTwilightColor)),
    },
  });

  const atmosphere = new THREE.Mesh(earthGeometry, atmosphereMaterial);
  atmosphere.scale.set(1.04, 1.04, 1.04);
  scene.add(atmosphere);

  // Subtle ambient rim (helps the sphere read even with flat textures)
  const rim = new THREE.PointLight(0x88ccff, 0.6, 50);
  rim.position.set(10, 5, 10);
  scene.add(rim);

  const resize = () => {
    sizes.width = container.clientWidth;
    sizes.height = container.clientHeight;
    sizes.dpr = clampDpr(window.devicePixelRatio);
    if (sizes.width <= 0 || sizes.height <= 0) return;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(sizes.dpr);
    renderer.setSize(sizes.width, sizes.height);
  };

  const ro = new ResizeObserver(() => resize());
  ro.observe(container);
  resize();

  let raf = 0;
  const clock = new THREE.Clock();
  const tick = () => {
    const t = clock.getElapsedTime();
    earth.rotation.y = t * 0.12;
    earth.rotation.x = Math.sin(t * 0.15) * 0.03;
    atmosphere.rotation.copy(earth.rotation);
    controls.update();
    renderer.render(scene, camera);
    raf = window.requestAnimationFrame(tick);
  };

  tick();

  return () => {
    window.cancelAnimationFrame(raf);
    ro.disconnect();
    controls.dispose();
    renderer.dispose();
    earthGeometry.dispose();
    earthMaterial.dispose();
    atmosphereMaterial.dispose();
  };
}

function initLoginEarth() {
  const mount = document.querySelector<HTMLElement>("[data-login-earth]");
  if (!mount) return;

  const canvas = document.createElement("canvas");
  canvas.className = "block w-full h-full";
  mount.appendChild(canvas);

  let cleanup: null | (() => void) = null;
  try {
    cleanup = setupEarth(canvas, mount);
  } catch (e) {
    canvas.remove();
    mount.classList.add("flex", "items-center", "justify-center");
    mount.innerHTML =
      `<p class="text-xs text-gray-300/80 px-3 text-center">No se pudo inicializar WebGL/Three.js en este navegador.</p>`;
    // eslint-disable-next-line no-console
    console.error(e);
    return;
  }

  // Clean up if navigating away in SPA-like environments.
  window.addEventListener(
    "beforeunload",
    () => {
      cleanup?.();
    },
    { once: true },
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initLoginEarth());
} else {
  initLoginEarth();
}

