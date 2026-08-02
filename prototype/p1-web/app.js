"use strict";

const views = [...document.querySelectorAll(".view")];
const menus = new Map(
  [...document.querySelectorAll(".menu-list[data-menu]")].map((list) => [
    list.dataset.menu,
    { list, items: [...list.querySelectorAll("li")], index: 0 }
  ])
);
const wheel = document.querySelector("#wheel");
const centerButton = document.querySelector("#centerButton");
const speech = document.querySelector("#speech");
const clock = document.querySelector("#clock");

const parentMenuByView = {
  character: "character-menu",
  "character-3d-prep": "character-menu",
  "character-3d-status": "character-menu",
  "character-3d-result": "character-menu",
  talk: "menu",
  camera: "menu",
  gift: "menu",
  memory: "menu"
};

let currentView = "home";
let pointerActive = false;
let previousAngle = 0;
let accumulatedAngle = 0;
let visualAngle = 0;
let cameraFacing = "user";
let mediaStream = null;

const proactiveMessages = [
  "오늘 같이 사진 한 장 찍을까?",
  "네가 좋아하는 걸 하나 더 기억해도 될까?",
  "조금 심심해. 휠을 천천히 쓰다듬어 줘!",
  "오늘 있었던 일 중에 제일 재미있었던 건 뭐야?"
];

function isMenuView(name) {
  return menus.has(name);
}

function activeMenu() {
  return menus.get(currentView) || null;
}

function updateMenuSelection(menuName = currentView) {
  const menu = menus.get(menuName);
  if (!menu) return;
  menu.items.forEach((item, index) => item.classList.toggle("selected", index === menu.index));
  menu.items[menu.index]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function showView(name) {
  if (!views.some((view) => view.dataset.view === name)) name = "home";
  currentView = name;
  views.forEach((view) => view.classList.toggle("active", view.dataset.view === name));

  if (isMenuView(name)) updateMenuSelection(name);
  if (name !== "camera") stopCamera();

  window.dispatchEvent(new CustomEvent("pocketpal:view-changed", { detail: { view: name } }));
}

function moveMenu(direction) {
  if (!isMenuView(currentView)) {
    const destination = currentView === "home" ? "menu" : (parentMenuByView[currentView] || "menu");
    showView(destination);
    return;
  }

  const menu = activeMenu();
  if (!menu?.items.length) return;
  menu.index = (menu.index + direction + menu.items.length) % menu.items.length;
  updateMenuSelection();
  if (navigator.vibrate) navigator.vibrate(10);
}

function selectCurrent() {
  if (currentView === "home") {
    showView("menu");
    return;
  }

  if (!isMenuView(currentView)) {
    showView(parentMenuByView[currentView] || "menu");
    return;
  }

  const menu = activeMenu();
  const action = menu?.items[menu.index]?.dataset.action;
  if (!action) return;

  if (action === "home") {
    showView("home");
    say("다시 만나서 반가워!");
    return;
  }

  showView(action);
}

function angleFromPointer(event) {
  const rect = wheel.getBoundingClientRect();
  const x = event.clientX - (rect.left + rect.width / 2);
  const y = event.clientY - (rect.top + rect.height / 2);
  return Math.atan2(y, x) * (180 / Math.PI);
}

function normalizeDelta(delta) {
  if (delta > 180) return delta - 360;
  if (delta < -180) return delta + 360;
  return delta;
}

wheel.addEventListener("pointerdown", (event) => {
  pointerActive = true;
  previousAngle = angleFromPointer(event);
  accumulatedAngle = 0;
  wheel.setPointerCapture(event.pointerId);
});

wheel.addEventListener("pointermove", (event) => {
  if (!pointerActive) return;

  const nextAngle = angleFromPointer(event);
  const delta = normalizeDelta(nextAngle - previousAngle);
  previousAngle = nextAngle;
  accumulatedAngle += delta;
  visualAngle += delta;
  wheel.style.setProperty("--wheel-angle", `${visualAngle}deg`);

  const step = 28;
  while (Math.abs(accumulatedAngle) >= step) {
    const direction = accumulatedAngle > 0 ? 1 : -1;
    moveMenu(direction);
    accumulatedAngle -= direction * step;
  }
});

function releaseWheel(event) {
  pointerActive = false;
  if (event.pointerId !== undefined && wheel.hasPointerCapture(event.pointerId)) {
    wheel.releasePointerCapture(event.pointerId);
  }
}

wheel.addEventListener("pointerup", releaseWheel);
wheel.addEventListener("pointercancel", releaseWheel);
centerButton.addEventListener("click", selectCurrent);

menus.forEach((menu, menuName) => {
  menu.items.forEach((item, index) => {
    item.addEventListener("click", () => {
      menu.index = index;
      if (currentView !== menuName) showView(menuName);
      updateMenuSelection(menuName);
      selectCurrent();
    });
  });
});

window.addEventListener("keydown", (event) => {
  if (["ArrowDown", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    moveMenu(1);
  }
  if (["ArrowUp", "ArrowLeft"].includes(event.key)) {
    event.preventDefault();
    moveMenu(-1);
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    selectCurrent();
  }
  if (event.key === "Escape") showView(parentMenuByView[currentView] || "home");
});

function say(message, useVoice = false) {
  speech.textContent = message;

  if (useVoice && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "ko-KR";
    utterance.rate = 1.02;
    window.speechSynthesis.speak(utterance);
  }
}

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

updateClock();
setInterval(updateClock, 30_000);

setInterval(() => {
  if (currentView !== "home") return;
  const next = proactiveMessages[Math.floor(Math.random() * proactiveMessages.length)];
  say(next);
}, 25_000);

const talkInput = document.querySelector("#talkInput");
const talkButton = document.querySelector("#talkButton");
const talkResult = document.querySelector("#talkResult");

function localReply(text) {
  const normalized = text.trim();
  if (!normalized) return "무슨 이야기인지 천천히 말해 줘.";
  if (normalized.includes("학교")) return "학교에서 있었던 일, 더 자세히 들려줄래?";
  if (normalized.includes("그림")) return "그 그림을 나에게 선물해 주면 정말 기쁠 것 같아!";
  if (normalized.includes("슬퍼") || normalized.includes("속상")) return "그랬구나. 내가 옆에서 같이 있어 줄게.";
  if (normalized.includes("좋아")) return "좋아하는 걸 하나 더 알게 됐네. 기억해 둘까?";
  return `“${normalized}”라고 말해 줬구나. 다음 버전에서는 AI와 연결해서 더 자연스럽게 대화할게.`;
}

talkButton?.addEventListener("click", () => {
  const reply = localReply(talkInput.value);
  talkResult.textContent = reply;
  say(reply, true);
});

const cameraVideo = document.querySelector("#cameraVideo");
const cameraState = document.querySelector("#cameraState");
const cameraStart = document.querySelector("#cameraStart");
const cameraFlip = document.querySelector("#cameraFlip");

async function startCamera() {
  stopCamera();

  if (!navigator.mediaDevices?.getUserMedia) {
    cameraState.textContent = "이 브라우저에서는 카메라 기능을 사용할 수 없어요.";
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: cameraFacing },
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    });
    cameraVideo.srcObject = mediaStream;
    await cameraVideo.play();
    cameraVideo.style.transform = cameraFacing === "user" ? "scaleX(-1)" : "none";
    cameraState.textContent = cameraFacing === "user" ? "전면 카메라 모드" : "후면 카메라 모드";
  } catch (error) {
    console.error(error);
    cameraState.textContent = "카메라 권한을 허용해 주세요. HTTPS 또는 GitHub Pages에서 시험해야 할 수 있어요.";
  }
}

function stopCamera() {
  if (!mediaStream) return;
  mediaStream.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  cameraVideo.srcObject = null;
}

cameraStart?.addEventListener("click", startCamera);
cameraFlip?.addEventListener("click", async () => {
  cameraFacing = cameraFacing === "user" ? "environment" : "user";
  await startCamera();
});

const giftImage = document.querySelector("#giftImage");
const giftPreview = document.querySelector("#giftPreview");
const giftButton = document.querySelector("#giftButton");
const giftResult = document.querySelector("#giftResult");
let giftObjectUrl = null;

giftImage?.addEventListener("change", () => {
  const file = giftImage.files?.[0];
  if (!file) return;

  if (giftObjectUrl) URL.revokeObjectURL(giftObjectUrl);
  giftObjectUrl = URL.createObjectURL(file);
  giftPreview.src = giftObjectUrl;
  giftPreview.hidden = false;
  giftButton.disabled = false;
  giftResult.textContent = `${file.name}을 선택했어요. 다음 단계에서 배경 제거와 3D 변환을 연결합니다.`;
});

giftButton?.addEventListener("click", () => {
  giftResult.textContent = "선물을 준비했어! 아직은 미리보기지만, 곧 캐릭터가 실제로 착용하게 만들 거야.";
  say("우와, 나에게 주는 선물이야? 정말 고마워!", true);
});

const memoryInput = document.querySelector("#memoryInput");
const memorySave = document.querySelector("#memorySave");
const memoryResult = document.querySelector("#memoryResult");

function loadMemory() {
  const saved = localStorage.getItem("pocketpal.memory");
  if (saved) {
    memoryInput.value = saved;
    memoryResult.textContent = `기억 중: ${saved}`;
  } else {
    memoryResult.textContent = "아직 저장된 기억이 없어요.";
  }
}

memorySave?.addEventListener("click", () => {
  const memory = memoryInput.value.trim();
  if (!memory) {
    memoryResult.textContent = "기억할 내용을 먼저 적어 주세요.";
    return;
  }
  localStorage.setItem("pocketpal.memory", memory);
  memoryResult.textContent = `기억했어: ${memory}`;
  say("응, 소중하게 기억할게!", true);
});

loadMemory();
menus.forEach((_, name) => updateMenuSelection(name));

window.showView = showView;
window.moveMenu = moveMenu;
window.selectCurrent = selectCurrent;
window.say = say;

window.addEventListener("beforeunload", () => {
  stopCamera();
  if (giftObjectUrl) URL.revokeObjectURL(giftObjectUrl);
});
