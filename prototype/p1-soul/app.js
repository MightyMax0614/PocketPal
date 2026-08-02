"use strict";

(() => {
  const STORAGE_KEY = "pocketpal.soul.v1";
  const MAX_MEMORIES = 40;
  const MAX_EVENTS = 60;

  const defaults = {
    version: 1,
    childName: "",
    palName: "포켓",
    personality: "gentle",
    speechStyle: "warm",
    mood: "calm",
    energy: 72,
    curiosity: 62,
    closeness: 15,
    lastInteraction: Date.now(),
    lastProactive: 0,
    settings: {
      proactive: true,
      voice: true,
      testMode: true
    },
    memories: [],
    events: []
  };

  const el = {
    speechText: document.querySelector("#speechText"),
    moodLabel: document.querySelector("#moodLabel"),
    presenceOrb: document.querySelector("#presenceOrb"),
    speakAgain: document.querySelector("#speakAgain"),
    energyBar: document.querySelector("#energyBar"),
    curiosityBar: document.querySelector("#curiosityBar"),
    closenessBar: document.querySelector("#closenessBar"),
    energyValue: document.querySelector("#energyValue"),
    curiosityValue: document.querySelector("#curiosityValue"),
    closenessValue: document.querySelector("#closenessValue"),
    talkInput: document.querySelector("#talkInput"),
    talkButton: document.querySelector("#talkButton"),
    proactiveEnabled: document.querySelector("#proactiveEnabled"),
    voiceEnabled: document.querySelector("#voiceEnabled"),
    testMode: document.querySelector("#testMode"),
    memoryType: document.querySelector("#memoryType"),
    memoryInput: document.querySelector("#memoryInput"),
    memorySave: document.querySelector("#memorySave"),
    memoryList: document.querySelector("#memoryList"),
    childName: document.querySelector("#childName"),
    palName: document.querySelector("#palName"),
    personality: document.querySelector("#personality"),
    speechStyle: document.querySelector("#speechStyle"),
    profileSave: document.querySelector("#profileSave"),
    profileResult: document.querySelector("#profileResult"),
    memoryCount: document.querySelector("#memoryCount"),
    lastInteractionLabel: document.querySelector("#lastInteractionLabel"),
    exportData: document.querySelector("#exportData"),
    importData: document.querySelector("#importData"),
    resetData: document.querySelector("#resetData"),
    clearEvents: document.querySelector("#clearEvents"),
    eventList: document.querySelector("#eventList")
  };

  let state = loadState();
  let currentSpeech = "";

  function clamp(value) {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  }

  function normalizeState(raw) {
    const safe = raw && typeof raw === "object" ? raw : {};
    return {
      ...defaults,
      ...safe,
      version: 1,
      childName: String(safe.childName || "").slice(0, 15),
      palName: String(safe.palName || "포켓").slice(0, 15),
      personality: ["gentle", "curious", "cheerful", "calm"].includes(safe.personality) ? safe.personality : "gentle",
      speechStyle: ["warm", "playful", "calm"].includes(safe.speechStyle) ? safe.speechStyle : "warm",
      mood: ["calm", "happy", "curious", "sad", "sleepy"].includes(safe.mood) ? safe.mood : "calm",
      energy: clamp(safe.energy ?? defaults.energy),
      curiosity: clamp(safe.curiosity ?? defaults.curiosity),
      closeness: clamp(safe.closeness ?? defaults.closeness),
      lastInteraction: Number(safe.lastInteraction) || Date.now(),
      lastProactive: Number(safe.lastProactive) || 0,
      settings: {
        proactive: safe.settings?.proactive !== false,
        voice: safe.settings?.voice !== false,
        testMode: safe.settings?.testMode !== false
      },
      memories: Array.isArray(safe.memories)
        ? safe.memories.slice(0, MAX_MEMORIES).map((item) => ({
            id: String(item.id || cryptoId()),
            type: ["like", "important", "recent", "person"].includes(item.type) ? item.type : "recent",
            text: String(item.text || "").slice(0, 120),
            createdAt: Number(item.createdAt) || Date.now()
          })).filter((item) => item.text)
        : [],
      events: Array.isArray(safe.events)
        ? safe.events.slice(0, MAX_EVENTS).map((item) => ({
            time: Number(item.time) || Date.now(),
            text: String(item.text || "").slice(0, 160)
          }))
        : []
    };
  }

  function cryptoId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return normalizeState(saved ? JSON.parse(saved) : defaults);
    } catch (error) {
      console.warn("Soul state load failed", error);
      return normalizeState(defaults);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Soul state save failed", error);
    }
  }

  function formatTime(timestamp) {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }

  function logEvent(text) {
    state.events.unshift({ time: Date.now(), text: String(text).slice(0, 160) });
    state.events = state.events.slice(0, MAX_EVENTS);
    saveState();
    renderEvents();
  }

  function touchInteraction(reason = "상호작용") {
    state.lastInteraction = Date.now();
    saveState();
    updateSummary();
    if (reason) logEvent(reason);
  }

  function moodName(mood) {
    return {
      calm: "편안함",
      happy: "기쁨",
      curious: "궁금함",
      sad: "속상함",
      sleepy: "졸림"
    }[mood] || "편안함";
  }

  function setMood(mood) {
    state.mood = mood;
    el.moodLabel.textContent = moodName(mood);
    el.presenceOrb.dataset.mood = mood;
    saveState();
  }

  function speak(text) {
    if (!state.settings.voice || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ko-KR";
      utterance.rate = state.speechStyle === "calm" ? 0.92 : state.speechStyle === "playful" ? 1.08 : 1;
      utterance.pitch = state.speechStyle === "playful" ? 1.12 : 1;
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn("Speech synthesis failed", error);
    }
  }

  function say(text, mood = "calm", options = {}) {
    currentSpeech = text;
    el.speechText.textContent = text;
    setMood(mood);
    if (options.voice !== false) speak(text);
    if (options.log !== false) logEvent(`${state.palName}: ${text}`);
  }

  function updateMeters() {
    const items = [
      [el.energyBar, el.energyValue, state.energy],
      [el.curiosityBar, el.curiosityValue, state.curiosity],
      [el.closenessBar, el.closenessValue, state.closeness]
    ];
    items.forEach(([bar, label, value]) => {
      bar.value = value;
      label.textContent = String(value);
    });
  }

  function renderMemories() {
    el.memoryList.innerHTML = "";
    if (!state.memories.length) {
      const item = document.createElement("li");
      item.textContent = "아직 저장된 기억이 없어요.";
      el.memoryList.append(item);
      return;
    }

    const labels = { like: "좋아함", important: "중요", recent: "최근", person: "사람" };
    state.memories.forEach((memory) => {
      const item = document.createElement("li");
      const text = document.createElement("span");
      text.textContent = `[${labels[memory.type]}] ${memory.text}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "삭제";
      remove.addEventListener("click", () => {
        state.memories = state.memories.filter((entry) => entry.id !== memory.id);
        saveState();
        renderAll();
        logEvent(`기억 삭제: ${memory.text}`);
      });
      item.append(text, remove);
      el.memoryList.append(item);
    });
  }

  function renderEvents() {
    el.eventList.innerHTML = "";
    if (!state.events.length) {
      const item = document.createElement("li");
      item.textContent = "아직 행동 기록이 없어요.";
      el.eventList.append(item);
      return;
    }
    state.events.slice(0, 20).forEach((event) => {
      const item = document.createElement("li");
      const time = document.createElement("time");
      time.textContent = new Date(event.time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
      item.append(time, document.createTextNode(event.text));
      el.eventList.append(item);
    });
  }

  function updateSummary() {
    el.memoryCount.textContent = `${state.memories.length}개`;
    el.lastInteractionLabel.textContent = formatTime(state.lastInteraction);
  }

  function renderProfile() {
    el.childName.value = state.childName;
    el.palName.value = state.palName;
    el.personality.value = state.personality;
    el.speechStyle.value = state.speechStyle;
    el.proactiveEnabled.checked = state.settings.proactive;
    el.voiceEnabled.checked = state.settings.voice;
    el.testMode.checked = state.settings.testMode;
  }

  function renderAll() {
    updateMeters();
    setMood(state.mood);
    renderMemories();
    renderEvents();
    updateSummary();
    renderProfile();
  }

  function remember(type, text, automatic = false) {
    const cleaned = String(text || "").trim().slice(0, 120);
    if (!cleaned) return false;
    state.memories.unshift({ id: cryptoId(), type, text: cleaned, createdAt: Date.now() });
    state.memories = state.memories.slice(0, MAX_MEMORIES);
    saveState();
    renderMemories();
    updateSummary();
    logEvent(`${automatic ? "대화에서 " : ""}기억 저장: ${cleaned}`);
    return true;
  }

  function namePrefix() {
    return state.childName ? `${state.childName}아, ` : "";
  }

  function styled(base) {
    if (state.speechStyle === "playful") return `${base} 헤헤!`;
    if (state.speechStyle === "calm") return base.replace(/!/g, ".");
    return base;
  }

  function localReply(input) {
    const text = input.trim();
    const prefix = namePrefix();
    if (!text) return { text: `${prefix}천천히 말해도 괜찮아.`, mood: "calm" };

    if (/슬퍼|속상|싫어|힘들/.test(text)) {
      state.closeness = clamp(state.closeness + 2);
      return { text: styled(`${prefix}그랬구나. 지금은 내가 네 이야기를 조용히 들어줄게.`), mood: "sad" };
    }
    if (/좋아|신나|기뻐|재미/.test(text)) {
      state.energy = clamp(state.energy + 4);
      state.closeness = clamp(state.closeness + 1);
      return { text: styled(`${prefix}그 이야기를 들으니까 나도 기분이 좋아졌어!`), mood: "happy" };
    }
    if (/학교|유치원|학원/.test(text)) {
      return { text: styled(`${prefix}오늘 거기에서 가장 기억에 남은 일은 뭐였어?`), mood: "curious" };
    }
    if (/그림|만들|그렸/.test(text)) {
      state.curiosity = clamp(state.curiosity + 3);
      return { text: styled(`${prefix}네가 만든 걸 나중에 나한테도 보여줘. 어떤 부분이 제일 마음에 들어?`), mood: "curious" };
    }
    if (/공룡|우주|자동차|동물/.test(text)) {
      return { text: styled(`${prefix}그 이야기는 나도 더 알고 싶어. 네가 제일 좋아하는 건 뭐야?`), mood: "curious" };
    }
    return { text: styled(`${prefix}응, 기억하고 싶어. 그다음에는 어떻게 됐어?`), mood: "calm" };
  }

  function randomMemory() {
    if (!state.memories.length) return null;
    return state.memories[Math.floor(Math.random() * state.memories.length)];
  }

  function proactiveMessage() {
    const hour = new Date().getHours();
    const prefix = namePrefix();
    const memory = randomMemory();

    if (hour >= 22 || hour < 6) {
      return { text: styled(`${prefix}아직 안 자고 있었어? 오늘 기억하고 싶은 일이 하나 있어?`), mood: "sleepy" };
    }
    if (hour < 10) {
      return { text: styled(`${prefix}좋은 아침이야. 오늘 기대되는 일이 있어?`), mood: "happy" };
    }
    if (memory) {
      if (memory.type === "like") return { text: styled(`${prefix}네가 ${memory.text}라고 했던 거 기억나. 오늘도 그 이야기 해볼까?`), mood: "curious" };
      if (memory.type === "important") return { text: styled(`${prefix}${memory.text}라고 했던 중요한 일, 지금은 어떻게 됐어?`), mood: "curious" };
      if (memory.type === "person") return { text: styled(`${prefix}${memory.text} 이야기를 전에 했었지. 오늘은 무슨 일이 있었어?`), mood: "calm" };
      return { text: styled(`${prefix}전에 ${memory.text}라고 말해줬잖아. 그 뒤 이야기도 궁금해.`), mood: "curious" };
    }
    if (state.personality === "cheerful") return { text: styled(`${prefix}우리 지금 재미있는 것 하나 찾아볼까?`), mood: "happy" };
    if (state.personality === "curious") return { text: styled(`${prefix}지금 네가 보고 있는 게 뭔지 궁금해.`), mood: "curious" };
    if (state.personality === "calm") return { text: `${prefix}잠깐 쉬고 싶으면 나랑 조용히 있어도 괜찮아.`, mood: "calm" };
    return { text: styled(`${prefix}지금 기분이 어떤지 나한테 알려줄래?`), mood: "calm" };
  }

  function runAction(action) {
    touchInteraction(`빠른 반응: ${action}`);
    if (action === "greet") say(styled(`${namePrefix()}다시 만나서 반가워!`), "happy");
    if (action === "curious") say(styled(`${namePrefix()}지금 뭐 하고 있어? 나도 같이 알고 싶어.`), "curious");
    if (action === "happy") {
      state.energy = clamp(state.energy + 5);
      state.closeness = clamp(state.closeness + 1);
      updateMeters();
      say(styled(`${namePrefix()}정말? 어떤 좋은 일이었는지 들려줘!`), "happy");
    }
    if (action === "sad") say(styled(`${namePrefix()}괜찮아. 서두르지 말고 천천히 말해줘.`), "sad");
    if (action === "pet") {
      state.closeness = clamp(state.closeness + 3);
      updateMeters();
      say(styled(`${namePrefix()}따뜻하다. 네가 이렇게 해주는 거 좋아.`), "happy");
    }
    if (action === "proactive") {
      const next = proactiveMessage();
      say(next.text, next.mood);
    }
    saveState();
  }

  document.querySelectorAll(".tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tabs button").forEach((item) => item.classList.toggle("selected", item === button));
      document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === button.dataset.tab));
      touchInteraction(`화면 이동: ${button.textContent.trim()}`);
    });
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => runAction(button.dataset.action));
  });

  el.talkButton.addEventListener("click", () => {
    const input = el.talkInput.value.trim();
    if (!input) {
      say(`${namePrefix()}말하고 싶은 게 생기면 천천히 적어줘.`, "calm");
      return;
    }
    touchInteraction(`아이: ${input}`);
    const reply = localReply(input);
    if (input.length >= 6) remember("recent", input, true);
    state.curiosity = clamp(state.curiosity + 1);
    state.closeness = clamp(state.closeness + 1);
    updateMeters();
    say(reply.text, reply.mood);
    el.talkInput.value = "";
    saveState();
  });

  el.memorySave.addEventListener("click", () => {
    const text = el.memoryInput.value.trim();
    if (!remember(el.memoryType.value, text)) {
      say("기억할 내용을 먼저 적어줘.", "calm", { voice: false });
      return;
    }
    el.memoryInput.value = "";
    state.closeness = clamp(state.closeness + 1);
    updateMeters();
    say(styled(`${namePrefix()}응, 소중하게 기억할게.`), "happy");
  });

  el.profileSave.addEventListener("click", () => {
    state.childName = el.childName.value.trim().slice(0, 15);
    state.palName = el.palName.value.trim().slice(0, 15) || "포켓";
    state.personality = el.personality.value;
    state.speechStyle = el.speechStyle.value;
    state.lastInteraction = Date.now();
    saveState();
    el.profileResult.textContent = `${state.palName}의 성격과 말투를 저장했어요.`;
    logEvent("소울 프로필 저장");
    say(styled(`${namePrefix()}이제부터 나는 ${state.palName}이야. 잘 부탁해!`), "happy");
    updateSummary();
  });

  [
    [el.proactiveEnabled, "proactive"],
    [el.voiceEnabled, "voice"],
    [el.testMode, "testMode"]
  ].forEach(([input, key]) => {
    input.addEventListener("change", () => {
      state.settings[key] = input.checked;
      touchInteraction(`설정 변경: ${key}=${input.checked}`);
      saveState();
    });
  });

  el.speakAgain.addEventListener("click", () => {
    touchInteraction("현재 문장 다시 읽기");
    speak(currentSpeech || el.speechText.textContent);
  });

  el.exportData.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pocketpal-soul-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    logEvent("보호자 데이터 JSON 내보내기");
  });

  el.importData.addEventListener("change", async () => {
    const file = el.importData.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      state = normalizeState(parsed);
      state.lastInteraction = Date.now();
      saveState();
      renderAll();
      say("데이터를 안전하게 불러왔어.", "happy");
      logEvent("보호자 데이터 JSON 가져오기");
    } catch (error) {
      console.error(error);
      say("이 파일은 PocketPal 데이터 형식이 아닌 것 같아.", "sad", { voice: false });
    } finally {
      el.importData.value = "";
    }
  });

  el.resetData.addEventListener("click", () => {
    const confirmed = window.confirm("PocketPal의 이름, 기억, 친밀도와 행동 기록을 모두 삭제할까요?");
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    state = normalizeState(defaults);
    currentSpeech = "";
    renderAll();
    say("모든 로컬 데이터를 지웠어. 처음부터 다시 시작할게.", "calm", { voice: false });
  });

  el.clearEvents.addEventListener("click", () => {
    state.events = [];
    saveState();
    renderEvents();
  });

  function proactiveTick() {
    if (document.visibilityState !== "visible" || !state.settings.proactive) return;
    const now = Date.now();
    const idleThreshold = state.settings.testMode ? 20_000 : 10 * 60_000;
    const repeatThreshold = state.settings.testMode ? 45_000 : 30 * 60_000;
    if (now - state.lastInteraction < idleThreshold) return;
    if (now - state.lastProactive < repeatThreshold) return;

    const next = proactiveMessage();
    state.lastProactive = now;
    state.energy = clamp(state.energy - 1);
    state.curiosity = clamp(state.curiosity + 1);
    saveState();
    updateMeters();
    say(next.text, next.mood);
    logEvent("자발 발화 실행");
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updateSummary();
  });

  renderAll();
  const initial = state.childName
    ? `${state.childName}아, ${state.palName}이 다시 왔어. 오늘은 어떤 하루였어?`
    : "안녕. 먼저 ‘성격’에서 네 이름과 내 이름을 정해줘.";
  say(initial, "calm", { voice: false, log: false });
  logEvent("Soul Lab 시작");
  window.setInterval(proactiveTick, 5_000);
})();
