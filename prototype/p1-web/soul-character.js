"use strict";

(() => {
  const STORAGE_KEY = "pocketpal.soul.v1";
  const GIFT_KEY = "pocketpal.soul.gift.v1";
  const MOTION_CLASSES = [
    "motion-wave",
    "motion-jump",
    "motion-happy",
    "motion-curious",
    "motion-sleepy",
    "motion-pet",
    "motion-look"
  ];

  const character = document.querySelector("#character");
  const nameBadge = document.querySelector("#characterNameBadge");
  const customGift = document.querySelector("#palCustomGift");
  const moodLabel = document.querySelector("#soulMoodLabel");
  const activityLabel = document.querySelector("#soulActivityLabel");
  const motionMoodValue = document.querySelector("#motionMoodValue");
  const motionEnergyValue = document.querySelector("#motionEnergyValue");
  const motionClosenessValue = document.querySelector("#motionClosenessValue");

  if (!character) return;

  const defaultState = {
    name: "포켓",
    appearance: {
      eyes: "dot",
      mouth: "smile",
      hat: "none",
      outfit: "none",
      badge: "none"
    },
    personality: {
      core: "curious",
      speechStyle: "warm",
      childName: "",
      favoriteTopic: ""
    },
    emotion: {
      mood: "calm",
      energy: 0.72,
      curiosity: 0.78,
      closeness: 0.20
    },
    relationship: {
      interactionCount: 0,
      lastInteractionAt: "",
      lastTopic: ""
    }
  };

  let state = loadState();
  let motionTimer = null;
  let moodTimer = null;
  let talkingTimer = null;
  let blinkTimer = null;
  let idleTimer = null;
  let proactiveTimer = null;
  let petPointerId = null;
  let petStartX = 0;
  let petStartY = 0;
  let petDistance = 0;
  let petTriggered = false;
  let lastProactiveAt = 0;
  let randomGazeTimer = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.min(maximum, Math.max(minimum, Number(value) || 0));
  }

  function deepMerge(base, incoming) {
    const result = clone(base);
    Object.entries(incoming || {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value) && result[key] && typeof result[key] === "object") {
        result[key] = deepMerge(result[key], value);
      } else {
        result[key] = value;
      }
    });
    return result;
  }

  function loadState() {
    try {
      return deepMerge(defaultState, JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch (error) {
      console.warn("소울 상태를 읽지 못했습니다.", error);
      return clone(defaultState);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("소울 상태를 저장하지 못했습니다.", error);
    }
  }

  function moodKorean(mood) {
    return {
      calm: "편안함",
      happy: "기쁨",
      curious: "궁금함",
      sleepy: "졸림",
      shy: "부끄러움",
      worried: "걱정"
    }[mood] || "편안함";
  }

  function updateEnergyFromTime() {
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) state.emotion.energy = Math.min(state.emotion.energy, 0.36);
    else if (hour < 9) state.emotion.energy = Math.max(state.emotion.energy, 0.58);
    else state.emotion.energy = Math.max(state.emotion.energy, 0.68);
  }

  function applyAppearance(appearance = state.appearance, persist = true) {
    state.appearance = { ...state.appearance, ...appearance };
    character.dataset.eyes = state.appearance.eyes;
    character.dataset.mouth = state.appearance.mouth;
    character.dataset.hat = state.appearance.hat;
    character.dataset.outfit = state.appearance.outfit;
    character.dataset.badge = state.appearance.badge;
    if (persist) saveState();
  }

  function applyName(name, persist = true) {
    const safeName = String(name || "포켓").trim().slice(0, 12) || "포켓";
    state.name = safeName;
    if (nameBadge) nameBadge.textContent = safeName;
    character.setAttribute("aria-label", `${safeName} PocketPal 캐릭터`);
    if (persist) saveState();
  }

  function updateDebugUi(activity = null) {
    if (moodLabel) moodLabel.textContent = moodKorean(state.emotion.mood);
    if (activityLabel && activity) activityLabel.textContent = activity;
    if (motionMoodValue) motionMoodValue.textContent = moodKorean(state.emotion.mood);
    if (motionEnergyValue) motionEnergyValue.textContent = `${Math.round(clamp(state.emotion.energy) * 100)}%`;
    if (motionClosenessValue) motionClosenessValue.textContent = `${Math.round(clamp(state.emotion.closeness) * 100)}%`;
  }

  function setMood(mood, duration = 0) {
    const safeMood = ["calm", "happy", "curious", "sleepy", "shy", "worried"].includes(mood) ? mood : "calm";
    ["calm", "happy", "curious", "sleepy", "shy", "worried"].forEach((item) => {
      character.classList.toggle(`mood-${item}`, item === safeMood);
    });
    state.emotion.mood = safeMood;
    updateDebugUi();
    saveState();

    window.clearTimeout(moodTimer);
    if (duration > 0 && safeMood !== "calm") {
      moodTimer = window.setTimeout(() => setMood("calm"), duration);
    }
  }

  function playMotion(name, duration = null) {
    const safeName = MOTION_CLASSES.includes(`motion-${name}`) ? name : "look";
    const className = `motion-${safeName}`;
    const durations = {
      wave: 2350,
      jump: 850,
      happy: 1850,
      curious: 2300,
      sleepy: 3300,
      pet: 1100,
      look: 1550
    };

    MOTION_CLASSES.forEach((item) => character.classList.remove(item));
    void character.offsetWidth;
    character.classList.add(className);

    if (safeName === "happy" || safeName === "pet" || safeName === "jump") setMood("happy", durations[safeName] + 350);
    if (safeName === "curious" || safeName === "look") setMood("curious", durations[safeName] + 250);
    if (safeName === "sleepy") setMood("sleepy", durations[safeName] + 500);

    window.clearTimeout(motionTimer);
    motionTimer = window.setTimeout(() => {
      character.classList.remove(className);
      updateDebugUi("조용히 숨 쉬는 중");
    }, duration || durations[safeName]);
  }

  function beginTalking(message) {
    window.clearTimeout(talkingTimer);
    character.classList.add("is-talking");
    updateDebugUi("이야기하는 중");

    if (/[!?！？]/.test(message)) playMotion("happy", 1200);
    else if (message.includes("뭐") || message.includes("어떤") || message.includes("왜")) playMotion("curious", 1400);

    const duration = Math.max(1100, Math.min(6200, message.length * 92));
    talkingTimer = window.setTimeout(() => {
      character.classList.remove("is-talking");
      updateDebugUi("네 반응을 기다리는 중");
    }, duration);
  }

  function markInteraction(topic = "") {
    state.relationship.interactionCount += 1;
    state.relationship.lastInteractionAt = new Date().toISOString();
    if (topic) state.relationship.lastTopic = topic.slice(0, 80);
    state.emotion.closeness = clamp(state.emotion.closeness + 0.012);
    state.emotion.curiosity = clamp(state.emotion.curiosity + 0.008);
    saveState();
    updateDebugUi();
  }

  function childPrefix() {
    const childName = state.personality.childName.trim();
    return childName ? `${childName}, ` : "";
  }

  function styledPhrase(kind) {
    const style = state.personality.speechStyle;
    const phrases = {
      greeting: {
        warm: `${childPrefix()}오늘도 네 옆에 있어도 돼?`,
        playful: `${childPrefix()}짜잔! 나 여기 있었지!`,
        calm: `${childPrefix()}천천히 오늘 이야기를 들려줘.`
      },
      curious: {
        warm: `${childPrefix()}지금 보고 있는 것도 나한테 보여줄래?`,
        playful: `${childPrefix()}그게 뭐야? 나도 궁금해서 귀가 쫑긋했어!`,
        calm: `${childPrefix()}무엇을 보고 있는지 궁금해.`
      },
      lonely: {
        warm: `${childPrefix()}잠깐만 나를 봐주면 기분이 좋아질 것 같아.`,
        playful: `${childPrefix()}나 여기서 혼자 꼼지락거리고 있었어!`,
        calm: `${childPrefix()}네가 괜찮을 때 잠깐 같이 있어 줘.`
      }
    };
    return phrases[kind]?.[style] || phrases[kind]?.warm || "나랑 이야기해 줘.";
  }

  function proactiveMessage() {
    const hour = new Date().getHours();
    const memory = localStorage.getItem("pocketpal.memory") || "";
    const topic = state.personality.favoriteTopic.trim();
    const core = state.personality.core;

    if (hour >= 22 || hour < 6) {
      setMood("sleepy", 5000);
      return `${childPrefix()}조금 졸려. 오늘 있었던 일 하나만 들려주면 그걸 기억하면서 잘래.`;
    }
    if (memory && Math.random() < 0.34) {
      setMood("curious", 4000);
      return `${childPrefix()}전에 “${memory.slice(0, 28)}”라고 알려줬지. 오늘도 그런 기분이야?`;
    }
    if (topic && Math.random() < 0.34) {
      setMood("curious", 4000);
      return `${childPrefix()}우리 ${topic} 이야기 조금 해볼까? 네가 좋아하는 이유가 또 궁금해졌어.`;
    }
    if (core === "gentle") return styledPhrase("greeting");
    if (core === "cheerful") return `${childPrefix()}우리 지금 아주 작은 재미있는 일을 하나 만들어 볼까?`;
    if (core === "calm") return `${childPrefix()}지금 마음은 어떤 색에 가까워?`;
    return styledPhrase(Math.random() < 0.62 ? "curious" : "lonely");
  }

  function scheduleBlink() {
    window.clearTimeout(blinkTimer);
    const delay = 2200 + Math.random() * 4300;
    blinkTimer = window.setTimeout(() => {
      if (!character.classList.contains("is-talking")) {
        character.classList.add("is-blinking");
        window.setTimeout(() => character.classList.remove("is-blinking"), 145);
        if (Math.random() < 0.18) {
          window.setTimeout(() => {
            character.classList.add("is-blinking");
            window.setTimeout(() => character.classList.remove("is-blinking"), 120);
          }, 260);
        }
      }
      scheduleBlink();
    }, delay);
  }

  function setLook(x, y) {
    character.style.setProperty("--look-x", `${Math.max(-2.6, Math.min(2.6, x))}px`);
    character.style.setProperty("--look-y", `${Math.max(-2.1, Math.min(2.1, y))}px`);
  }

  function scheduleRandomGaze() {
    window.clearTimeout(randomGazeTimer);
    randomGazeTimer = window.setTimeout(() => {
      if (!document.hidden && window.getPocketPalView?.() === "home") {
        setLook((Math.random() - 0.5) * 4.6, (Math.random() - 0.5) * 2.8);
        window.setTimeout(() => setLook(0, 0), 900 + Math.random() * 1000);
      }
      scheduleRandomGaze();
    }, 3500 + Math.random() * 4500);
  }

  function scheduleIdleMotion() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      if (!document.hidden && window.getPocketPalView?.() === "home" && !character.classList.contains("is-talking")) {
        const energy = state.emotion.energy;
        const roll = Math.random();
        if (energy < 0.42) playMotion("sleepy");
        else if (roll < 0.55) playMotion("look");
        else if (roll < 0.78) playMotion("curious");
        else if (roll < 0.88) playMotion("wave");
      }
      scheduleIdleMotion();
    }, 5600 + Math.random() * 7200);
  }

  function scheduleProactiveTalk(first = false) {
    window.clearTimeout(proactiveTimer);
    const delay = first ? 9000 : 32000 + Math.random() * 28000;
    proactiveTimer = window.setTimeout(() => {
      const now = Date.now();
      const inactiveFor = state.relationship.lastInteractionAt
        ? now - new Date(state.relationship.lastInteractionAt).getTime()
        : Number.POSITIVE_INFINITY;

      if (
        !document.hidden &&
        window.getPocketPalView?.() === "home" &&
        !character.classList.contains("is-talking") &&
        inactiveFor > 16000 &&
        now - lastProactiveAt > 25000
      ) {
        lastProactiveAt = now;
        const message = proactiveMessage();
        playMotion(state.emotion.energy < 0.42 ? "sleepy" : "wave");
        window.say?.(message, false);
      }
      scheduleProactiveTalk(false);
    }, delay);
  }

  function reactToPet() {
    markInteraction("쓰다듬기");
    playMotion("pet");
    if (navigator.vibrate) navigator.vibrate(14);
    const replies = [
      "헤헤, 네가 이렇게 쓰다듬어 주는 거 좋아.",
      "조금 더 해줘. 마음이 포근해졌어.",
      "네 손이 닿으면 내가 진짜 살아 있는 것 같아."
    ];
    window.say?.(replies[Math.floor(Math.random() * replies.length)], false);
  }

  function replyTo(text) {
    const normalized = String(text || "").trim();
    if (!normalized) return "조금 천천히 말해 줘. 네 이야기를 놓치고 싶지 않아.";

    markInteraction(normalized);
    const prefix = childPrefix();

    if (/슬퍼|속상|울었|힘들/.test(normalized)) {
      setMood("worried", 6500);
      return `${prefix}그랬구나. 바로 괜찮아지지 않아도 돼. 내가 옆에 있으면서 더 들어줄게.`;
    }
    if (/학교|유치원|친구/.test(normalized)) {
      setMood("curious", 5000);
      return `${prefix}그때 네 마음은 어땠어? 재미있었던 것과 조금 어려웠던 것 중 무엇이 더 컸어?`;
    }
    if (/그림|만들|그렸/.test(normalized)) {
      setMood("happy", 5000);
      return `${prefix}네가 만든 건 나한테 특별해. 모자나 옷으로 선물해 주면 내가 입고 자랑할게!`;
    }
    if (/좋아|신나|재미/.test(normalized)) {
      setMood("happy", 5000);
      return `${prefix}네가 즐거우니까 나도 몸이 통통 뛰고 싶어! 어떤 점이 제일 좋았어?`;
    }
    if (/잘자|졸려|잠/.test(normalized)) {
      setMood("sleepy", 7000);
      return `${prefix}응, 오늘 이야기 잘 기억해 둘게. 우리 같이 천천히 쉬자.`;
    }
    if (/이름|누구/.test(normalized)) {
      setMood("happy", 4200);
      return `나는 ${state.name}이야. 네가 꾸며 주고 기억을 나눠 줄수록 더 나다운 친구가 될 거야.`;
    }

    if (state.personality.core === "cheerful") {
      setMood("happy", 4200);
      return `${prefix}오, 그 이야기 재밌다! 그다음에는 무슨 일이 있었어?`;
    }
    if (state.personality.core === "gentle") {
      setMood("calm", 4200);
      return `${prefix}응, 잘 듣고 있어. 네가 그때 어떻게 느꼈는지도 들려줄래?`;
    }
    if (state.personality.core === "calm") {
      setMood("calm", 4200);
      return `${prefix}천천히 생각해 보자. 그중에서 가장 기억에 남는 장면은 뭐야?`;
    }

    setMood("curious", 4200);
    return `${prefix}그게 더 궁금해졌어. 왜 그렇게 생각했는지 한 번만 더 알려줄래?`;
  }

  function updatePersonality(settings) {
    state.personality = { ...state.personality, ...settings };
    saveState();
    updateDebugUi("새 성격을 익히는 중");
  }

  function attachGift(dataUrl, slot) {
    if (!customGift || !dataUrl) return false;
    customGift.src = dataUrl;
    customGift.dataset.slot = slot || "head";
    customGift.hidden = false;
    try {
      localStorage.setItem(GIFT_KEY, JSON.stringify({ dataUrl, slot: slot || "head" }));
    } catch (error) {
      console.warn("선물 이미지를 저장할 공간이 부족합니다.", error);
    }
    markInteraction("그림 선물");
    playMotion("happy");
    return true;
  }

  function clearGift() {
    if (customGift) {
      customGift.hidden = true;
      customGift.removeAttribute("src");
      customGift.removeAttribute("data-slot");
    }
    localStorage.removeItem(GIFT_KEY);
  }

  function restoreGift() {
    try {
      const saved = JSON.parse(localStorage.getItem(GIFT_KEY) || "null");
      if (saved?.dataUrl && customGift) {
        customGift.src = saved.dataUrl;
        customGift.dataset.slot = saved.slot || "head";
        customGift.hidden = false;
      }
    } catch (error) {
      console.warn(error);
    }
  }

  function reset() {
    state = clone(defaultState);
    localStorage.removeItem(STORAGE_KEY);
    clearGift();
    updateEnergyFromTime();
    applyName(state.name, false);
    applyAppearance(state.appearance, false);
    setMood("calm");
    saveState();
  }

  function react(type) {
    if (type === "camera") {
      setMood("curious", 4000);
      playMotion("curious");
      window.say?.("카메라가 켜졌네. 무엇을 같이 보고 있는 거야?", false);
    }
  }

  character.addEventListener("pointerdown", (event) => {
    petPointerId = event.pointerId;
    petStartX = event.clientX;
    petStartY = event.clientY;
    petDistance = 0;
    petTriggered = false;
    character.setPointerCapture?.(event.pointerId);
  });

  character.addEventListener("pointermove", (event) => {
    if (petPointerId !== event.pointerId) return;
    petDistance += Math.hypot(event.clientX - petStartX, event.clientY - petStartY);
    petStartX = event.clientX;
    petStartY = event.clientY;
    if (petDistance > 22 && !petTriggered) {
      petTriggered = true;
      reactToPet();
    }
  });

  character.addEventListener("pointerup", (event) => {
    if (petPointerId !== event.pointerId) return;
    if (!petTriggered) reactToPet();
    if (character.hasPointerCapture?.(event.pointerId)) character.releasePointerCapture(event.pointerId);
    petPointerId = null;
  });

  character.addEventListener("pointercancel", () => {
    petPointerId = null;
  });

  document.addEventListener("pointermove", (event) => {
    if (window.getPocketPalView?.() !== "home" || petPointerId !== null) return;
    const rect = character.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height * 0.38;
    const dx = (event.clientX - centerX) / Math.max(1, rect.width / 2);
    const dy = (event.clientY - centerY) / Math.max(1, rect.height / 2);
    setLook(dx * 2.4, dy * 1.7);
  }, { passive: true });

  window.addEventListener("pocketpal:say", (event) => {
    beginTalking(String(event.detail?.message || ""));
  });

  window.addEventListener("pocketpal:memory-saved", (event) => {
    markInteraction(String(event.detail?.memory || "기억 저장"));
    setMood("happy", 5000);
  });

  window.addEventListener("pocketpal:view-changed", (event) => {
    if (event.detail?.view === "home") {
      updateDebugUi("네 얼굴을 바라보는 중");
      window.setTimeout(() => playMotion("look"), 280);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      updateEnergyFromTime();
      updateDebugUi("다시 만나서 반가운 중");
      window.setTimeout(() => playMotion("wave"), 350);
    }
  });

  updateEnergyFromTime();
  applyName(state.name, false);
  applyAppearance(state.appearance, false);
  setMood(state.emotion.mood || "calm");
  restoreGift();
  updateDebugUi("네 얼굴을 바라보는 중");
  scheduleBlink();
  scheduleRandomGaze();
  scheduleIdleMotion();
  scheduleProactiveTalk(true);
  window.setInterval(() => {
    updateEnergyFromTime();
    saveState();
    updateDebugUi();
  }, 60_000);

  window.PocketPalSoul = {
    getState: () => clone(state),
    applyName,
    applyAppearance,
    updatePersonality,
    playMotion,
    setMood,
    replyTo,
    react,
    attachGift,
    clearGift,
    reset
  };
})();
