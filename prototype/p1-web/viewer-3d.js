import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const DB_NAME = "pocketpal-assets";
const DB_STORE = "assets";
const MODEL_KEY = "character-3d-model-glb-v2";
const STATE_KEY = "pocketpal.character3d.state.v2";
const JOB_KEY = "pocketpal.character3d.job.v2";

const container = document.querySelector("#viewerCanvas");
const statusElement = document.querySelector("#viewerStatus");
const subtitleElement = document.querySelector("#viewerSubtitle");
const backButton = document.querySelector("#viewerBack");
const rotateButton = document.querySelector("#viewerAutoRotate");
const reloadButton = document.querySelector("#viewerReload");
const modelFileInput = document.querySelector("#viewerModelFile");

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
controls.minDistance = 0.5;
controls.maxDistance = 20;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.1;
controls.target.set(0, 0.05, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8aa0a5, 2.3));
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

async function dbGet(key) {
  const database = await openDatabase();
  const value = await new Promise((resolve, reject) => {
    const transaction = database.transaction(DB_STORE, "readonly");
    const request = transaction.objectStore(DB_STORE).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error || new Error("DB read failed"));
  });
  database.close();
  return value;
}

function clearActiveModel() {
  if (!activeModel) return;
  scene.remove(activeModel);
  activeModel.traverse((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => value?.isTexture && value.dispose?.());
      material.dispose?.();
    });
  });
  activeModel = null;
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

  floor.position.y = box.min.y - Math.max(0.02, size.y * 0.025);
  floor.scale.setScalar(Math.max(0.7, Math.min(3, maxSize / 2)));
}

function markDone(filename) {
  try {
    const state = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
    localStorage.setItem(STATE_KEY, JSON.stringify({
      ...state,
      status: "done",
      modelName: filename || state.modelName || "character.glb"
    }));
    const job = JSON.parse(localStorage.getItem(JOB_KEY) || "null");
    if (job) {
      localStorage.setItem(JOB_KEY, JSON.stringify({
        ...job,
        status: "done",
        result: { ...(job.result || {}), model_file: filename || "character.glb" }
      }));
    }
  } catch (error) {
    console.warn(error);
  }
}

async function loadGltfUrl(url, label = "character.glb") {
  setStatus("실제 3D 모델을 불러오는 중이에요…", label);
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  clearActiveModel();
  activeModel = gltf.scene;
  scene.add(activeModel);
  fitObject(activeModel);
  setStatus("실제 360도 캐릭터를 불러왔어요.", label);
  markDone(label);
}

async function loadStoredModel() {
  const blob = await dbGet(MODEL_KEY);
  if (!(blob instanceof Blob)) {
    clearActiveModel();
    setStatus("저장된 실제 GLB 결과가 없어요.", "3D 준비 → 실제 결과 등록 필요");
    return;
  }
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = URL.createObjectURL(blob);
  const state = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
  await loadGltfUrl(activeObjectUrl, state.modelName || "character.glb");
}

async function loadProceduralModule(url) {
  setStatus("img2threejs Three.js 모델을 불러오는 중이에요…", "절차형 3D 결과");
  const module = await import(url);
  const factory = module.createPocketPalModel || module.createModel || module.default;
  if (typeof factory !== "function") throw new Error("모듈에서 createModel 함수를 찾지 못했습니다.");
  const object = await factory();
  if (!object?.isObject3D) throw new Error("생성 함수가 THREE.Object3D를 반환하지 않았습니다.");
  clearActiveModel();
  activeModel = object;
  scene.add(activeModel);
  fitObject(activeModel);
  setStatus("img2threejs의 실제 절차형 3D 모델을 불러왔어요.", "Three.js 결과");
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
    setStatus("GLB 모델을 열지 못했어요.", file.name);
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

reloadButton.addEventListener("click", () => {
  loadStoredModel().catch((error) => {
    console.error(error);
    setStatus("저장된 GLB를 다시 열지 못했어요.");
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
  else if (modelUrl) await loadGltfUrl(modelUrl, modelUrl.split("/").pop() || "character.glb");
  else await loadStoredModel();
} catch (error) {
  console.error(error);
  setStatus("실제 3D 결과를 불러오지 못했어요. GLB 파일을 다시 확인해 주세요.");
}

window.addEventListener("beforeunload", () => {
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
});
