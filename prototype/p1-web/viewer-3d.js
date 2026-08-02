import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const DB_NAME = "pocketpal-assets";
const DB_STORE = "assets";
const DB_KEY = "character-image";
const IMAGE_FALLBACK_KEY = "pocketpal.character.image.v2";
const NAME_KEY = "pocketpal.character.name.v2";
const JOB_KEY = "pocketpal.3d.job.v1";

const container = document.querySelector("#viewerCanvas");
const statusElement = document.querySelector("#viewerStatus");
const subtitleElement = document.querySelector("#viewerSubtitle");
const backButton = document.querySelector("#viewerBack");
const rotateButton = document.querySelector("#viewerAutoRotate");
const resetButton = document.querySelector("#viewerReset");
const modelFileInput = document.querySelector("#viewerModelFile");

if (!container || !statusElement || !subtitleElement || !backButton || !rotateButton || !resetButton || !modelFileInput) {
  throw new Error("3D 뷰어 화면 요소를 찾지 못했습니다.");
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
camera.position.set(0, 0.15, 4.3);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 1.4;
controls.maxDistance = 9;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.25;
controls.target.set(0, 0.05, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x9eb3b6, 2.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
keyLight.position.set(3, 4, 5);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xcdefff, 1.3);
fillLight.position.set(-4, 1, 2);
scene.add(fillLight);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(1.8, 64),
  new THREE.MeshStandardMaterial({ color: 0xd6e3e4, roughness: 0.94, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.42;
scene.add(floor);

let activeModel = null;
let activeObjectUrl = null;

function setStatus(message, subtitle = null) {
  statusElement.textContent = message;
  if (subtitle) subtitleElement.textContent = subtitle;
}

function clearActiveModel() {
  if (!activeModel) return;
  scene.remove(activeModel);
  activeModel.traverse((object) => {
    if (object.geometry) object.geometry.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value?.isTexture) value.dispose?.();
      });
      material.dispose?.();
    });
  });
  activeModel = null;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DB_STORE)) database.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("DB open failed"));
  });
}

async function readSavedImage() {
  try {
    const database = await openDatabase();
    const value = await new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, "readonly");
      const request = transaction.objectStore(DB_STORE).get(DB_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("DB read failed"));
    });
    database.close();
    if (value) return value;
  } catch (error) {
    console.warn(error);
  }
  return localStorage.getItem(IMAGE_FALLBACK_KEY);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("캐릭터 이미지를 읽지 못했습니다."));
    image.src = source;
  });
}

function channelMedian(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 255;
}

function estimateEdgeBackground(data, width, height) {
  const red = [];
  const green = [];
  const blue = [];
  const patch = Math.max(3, Math.round(Math.min(width, height) * 0.035));
  const corners = [
    [0, 0],
    [Math.max(0, width - patch), 0],
    [0, Math.max(0, height - patch)],
    [Math.max(0, width - patch), Math.max(0, height - patch)]
  ];

  for (const [startX, startY] of corners) {
    for (let y = startY; y < Math.min(height, startY + patch); y += 1) {
      for (let x = startX; x < Math.min(width, startX + patch); x += 1) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] < 20) continue;
        red.push(data[offset]);
        green.push(data[offset + 1]);
        blue.push(data[offset + 2]);
      }
    }
  }

  return {
    red: channelMedian(red),
    green: channelMedian(green),
    blue: channelMedian(blue)
  };
}

function pixelDistance(data, offset, background) {
  const red = data[offset] - background.red;
  const green = data[offset + 1] - background.green;
  const blue = data[offset + 2] - background.blue;
  return Math.sqrt(red * red + green * green + blue * blue);
}

function cropCanvas(sourceCanvas, imageData, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = imageData.data[(y * width + x) * 4 + 3];
      if (alpha < 18) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return sourceCanvas;

  const padding = Math.max(4, Math.round(Math.min(width, height) * 0.018));
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const cropped = document.createElement("canvas");
  cropped.width = maxX - minX + 1;
  cropped.height = maxY - minY + 1;
  const context = cropped.getContext("2d", { alpha: true });
  if (!context) return sourceCanvas;
  context.drawImage(sourceCanvas, minX, minY, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  return cropped;
}

function makeCharacterCutout(image) {
  const maxSide = 560;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
  if (!context) throw new Error("배경 제거용 캔버스를 만들지 못했습니다.");

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  const background = estimateEdgeBackground(data, width, height);

  const cornerDistances = [];
  const cornerIndexes = [0, width - 1, (height - 1) * width, height * width - 1];
  for (const pixel of cornerIndexes) cornerDistances.push(pixelDistance(data, pixel * 4, background));
  const variation = cornerDistances.reduce((sum, value) => sum + value, 0) / cornerDistances.length;
  const tolerance = Math.max(42, Math.min(105, 48 + variation * 2.4));

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let queueStart = 0;
  let queueEnd = 0;

  function isBackground(pixel) {
    const offset = pixel * 4;
    if (data[offset + 3] < 20) return true;

    const distance = pixelDistance(data, offset, background);
    const maximum = Math.max(data[offset], data[offset + 1], data[offset + 2]);
    const minimum = Math.min(data[offset], data[offset + 1], data[offset + 2]);
    const neutral = maximum - minimum < 40;
    const bright = (data[offset] + data[offset + 1] + data[offset + 2]) / 3 > 170;
    const backgroundBright = (background.red + background.green + background.blue) / 3 > 175;

    return distance <= tolerance || (backgroundBright && neutral && bright && distance <= tolerance * 1.42);
  }

  function enqueue(pixel) {
    if (pixel < 0 || pixel >= visited.length || visited[pixel] || !isBackground(pixel)) return;
    visited[pixel] = 1;
    queue[queueEnd] = pixel;
    queueEnd += 1;
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (queueStart < queueEnd) {
    const pixel = queue[queueStart];
    queueStart += 1;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }

  let removedPixels = 0;
  for (let pixel = 0; pixel < visited.length; pixel += 1) {
    if (!visited[pixel]) continue;
    data[pixel * 4 + 3] = 0;
    removedPixels += 1;
  }

  context.putImageData(imageData, 0, 0);
  const cropped = cropCanvas(canvas, imageData, width, height);
  return {
    canvas: cropped,
    removedRatio: removedPixels / Math.max(1, width * height)
  };
}

function createCutoutTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;
  return texture;
}

function addCutoutLayer(group, geometry, texture, z, options = {}) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.055,
    side: THREE.DoubleSide,
    depthWrite: options.depthWrite ?? true,
    opacity: options.opacity ?? 1,
    color: options.color ?? 0xffffff
  });
  const layer = new THREE.Mesh(geometry, material);
  layer.position.z = z;
  if (options.flip) layer.rotation.y = Math.PI;
  group.add(layer);
}

async function showCharacterCutout() {
  clearActiveModel();
  const imageData = await readSavedImage();
  const name = localStorage.getItem(NAME_KEY) || "나의 친구";

  if (!imageData) {
    setStatus("먼저 PocketPal 화면에서 그림이나 사진을 캐릭터로 적용해 주세요.", "불러올 캐릭터 없음");
    return;
  }

  setStatus("캐릭터와 배경을 분리하는 중이에요…", `${name} · 캐릭터 분리 확인`);
  const image = await loadImage(imageData);
  const cutout = makeCharacterCutout(image);
  const texture = createCutoutTexture(cutout.canvas);
  const aspect = Math.max(0.42, Math.min(2.1, cutout.canvas.width / Math.max(1, cutout.canvas.height)));
  const height = 2.35;
  const width = height * aspect;
  const depth = 0.18;
  const layers = 11;
  const geometry = new THREE.PlaneGeometry(width, height);
  const group = new THREE.Group();

  for (let index = 1; index < layers - 1; index += 1) {
    const progress = index / (layers - 1);
    const z = -depth / 2 + depth * progress;
    addCutoutLayer(group, geometry, texture, z, {
      color: 0x6e8385,
      opacity: 0.26,
      depthWrite: false
    });
  }

  addCutoutLayer(group, geometry, texture, depth / 2, { depthWrite: true });
  addCutoutLayer(group, geometry, texture, -depth / 2, { depthWrite: true, flip: true });

  group.position.y = -0.04;
  activeModel = group;
  scene.add(group);
  fitObject(group);

  if (cutout.removedRatio > 0.08) {
    setStatus(
      "배경을 제거하고 캐릭터 부분만 분리했어요. 아직 진짜 3D가 아니라 실루엣 두께 확인용입니다.",
      `${name} · 캐릭터 분리 완료 · 실제 3D 변환 전`
    );
  } else {
    setStatus(
      "배경을 충분히 분리하지 못했어요. 흰색이나 단순한 배경의 그림이 가장 잘 됩니다.",
      `${name} · 배경 분리 보정 필요`
    );
  }
}

function fitObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 0.1);
  const distance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));

  controls.target.copy(center);
  camera.position.set(center.x + distance * 0.18, center.y + distance * 0.08, center.z + distance * 1.35);
  camera.near = Math.max(0.01, distance / 100);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  controls.update();
}

function markJobDone(filename) {
  try {
    const job = JSON.parse(localStorage.getItem(JOB_KEY) || "null");
    if (!job) return;
    localStorage.setItem(JOB_KEY, JSON.stringify({
      ...job,
      status: "done",
      model_file: filename,
      completed_at: new Date().toISOString(),
      result_origin: "local_file"
    }));
  } catch (error) {
    console.warn(error);
  }
}

async function loadGltfUrl(url, label = "3D 결과") {
  setStatus("3D 모델을 불러오는 중이에요…", label);
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  clearActiveModel();
  activeModel = gltf.scene;
  scene.add(activeModel);
  fitObject(activeModel);
  setStatus("실제 3D 결과를 불러왔어요.", label);
  markJobDone(label);
}

async function loadProceduralModule(url) {
  setStatus("Three.js 절차형 모델을 불러오는 중이에요…", "img2threejs 결과 모듈");
  const module = await import(url);
  const factory = module.createPocketPalModel || module.createModel || module.default;
  if (typeof factory !== "function") throw new Error("모듈에서 createModel 함수를 찾지 못했습니다.");
  const object = await factory();
  if (!object?.isObject3D) throw new Error("생성 함수가 THREE.Object3D를 반환하지 않았습니다.");
  clearActiveModel();
  activeModel = object;
  scene.add(activeModel);
  fitObject(activeModel);
  setStatus("img2threejs 절차형 모델을 불러왔어요.", "Three.js 모듈 결과");
  markJobDone(url.split("/").pop() || "procedural-module.js");
}

modelFileInput.addEventListener("change", async () => {
  const file = modelFileInput.files?.[0];
  if (!file) return;
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = URL.createObjectURL(file);
  try {
    await loadGltfUrl(activeObjectUrl, file.name);
  } catch (error) {
    console.error(error);
    setStatus("모델을 열지 못했어요. GLB 파일을 우선 사용해 주세요.", file.name);
  }
});

backButton.addEventListener("click", () => {
  window.location.href = "index.html";
});

rotateButton.addEventListener("click", () => {
  controls.autoRotate = !controls.autoRotate;
  rotateButton.setAttribute("aria-pressed", String(controls.autoRotate));
  rotateButton.textContent = controls.autoRotate ? "자동 회전" : "회전 멈춤";
});

resetButton.addEventListener("click", () => {
  modelFileInput.value = "";
  showCharacterCutout().catch((error) => {
    console.error(error);
    setStatus("캐릭터 분리 화면을 만들지 못했어요.");
  });
});

function resize() {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(container);
resize();

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

const parameters = new URLSearchParams(window.location.search);
const modelUrl = parameters.get("model");
const moduleUrl = parameters.get("module");

try {
  if (moduleUrl) await loadProceduralModule(moduleUrl);
  else if (modelUrl) await loadGltfUrl(modelUrl, modelUrl.split("/").pop() || "3D 결과");
  else await showCharacterCutout();
} catch (error) {
  console.error(error);
  setStatus("3D 결과를 불러오지 못해 캐릭터 분리 화면으로 돌아갑니다.");
  await showCharacterCutout();
}

window.addEventListener("beforeunload", () => {
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
});
