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

function loadTexture(source) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      source,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        resolve(texture);
      },
      undefined,
      reject
    );
  });
}

async function showTemporary2_5D() {
  clearActiveModel();
  const imageData = await readSavedImage();
  const name = localStorage.getItem(NAME_KEY) || "나의 친구";

  if (!imageData) {
    setStatus("먼저 PocketPal 화면에서 그림이나 사진을 캐릭터로 적용해 주세요.", "불러올 캐릭터 없음");
    return;
  }

  setStatus("그림에 두께를 준 2.5D 임시 미리보기입니다.", `${name} · 실제 3D 변환 전`);
  const texture = await loadTexture(imageData);
  const image = texture.image;
  const aspect = Math.max(0.55, Math.min(1.8, (image?.width || 1) / (image?.height || 1)));
  const height = 2.35;
  const width = height * aspect;
  const depth = 0.13;

  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth, 8, 8, 2),
    new THREE.MeshStandardMaterial({ color: 0xf4f1eb, roughness: 0.68, metalness: 0.02 })
  );
  body.geometry.translate(0, 0, -depth / 2);
  group.add(body);

  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.985, height * 0.985),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide })
  );
  front.position.z = 0.006;
  group.add(front);

  const shadowBack = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.94, height * 0.94),
    new THREE.MeshBasicMaterial({ color: 0xb4c7c9, transparent: true, opacity: 0.22 })
  );
  shadowBack.position.z = -depth - 0.008;
  shadowBack.rotation.y = Math.PI;
  group.add(shadowBack);

  group.position.y = -0.05;
  activeModel = group;
  scene.add(group);
  fitObject(group);
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
  showTemporary2_5D().catch((error) => {
    console.error(error);
    setStatus("2.5D 화면을 만들지 못했어요.");
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
  else await showTemporary2_5D();
} catch (error) {
  console.error(error);
  setStatus("3D 결과를 불러오지 못해 2.5D 임시 화면으로 돌아갑니다.");
  await showTemporary2_5D();
}

window.addEventListener("beforeunload", () => {
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
});
