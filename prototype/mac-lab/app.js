"use strict";
(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const character = $("#character");
  const prefKey = "pocketpal.mac-lab.preferences.v2";
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(prefKey) || "{}"); } catch (_) {}
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) prefs = {};
  let profileId = ["child-1", "child-2"].includes(prefs.profile) ? prefs.profile : "child-1";
  let state = null, busy = false, currentTab = "talk", info = null;
  let originalImage = null, stream = null, cameraTicket = 0;
  let lastActivity = Date.now(), lastProactive = 0;
  let talkTimer = null;
  const pixelPal = new PixelPal(character, {onState: text => $("#moodLabel").textContent = text});
  let menuOpen = false, menuIndex = 0, drag = null;
  const menu = [["talk", "대화하기"], ["memory", "기억하기"], ["gift", "그림 선물"], ["settings", "설정"], ["test", "시험 순서"]];

  function status(message, error = false) {
    $("#statusMessage").textContent = message;
    $("#statusMessage").classList.toggle("error", error);
  }
  function savePrefs() {
    prefs.profile = profileId;
    prefs.mode = $("#chatMode").value;
    prefs.model = $("#modelSelect").value;
    prefs.proactive = $("#proactiveEnabled").checked;
    prefs.voice = $("#voiceEnabled").checked;
    try { localStorage.setItem(prefKey, JSON.stringify(prefs)); }
    catch (_) { status("브라우저 설정 저장은 제한되어 있어요. 아이 기억은 맥북 파일에 저장됩니다."); }
  }
  async function api(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 100000);
    try {
      const response = await fetch(path, body === undefined ? {signal: controller.signal} : {
        method: "POST", headers: {"Content-Type": "application/json", "X-PocketPal": "mac-lab"},
        body: JSON.stringify(body), signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "요청을 처리하지 못했어요.");
      return result;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("응답 시간이 길어졌어요. 서버와 Ollama를 확인해 주세요.");
      if (error instanceof TypeError) throw new Error("맥북 실행 창과 연결이 끊겼어요. Start_PocketPal.command를 다시 실행해 주세요.");
      throw error;
    } finally { clearTimeout(timer); }
  }
  async function work(callback) {
    if (busy) { status("진행 중인 작업이 끝나면 다시 눌러 주세요."); return; }
    busy = true;
    $("#sendButton").disabled = true;
    $("#profileSelect").disabled = true;
    lastActivity = Date.now();
    try { await callback(); }
    catch (error) { status(error.message, true); }
    finally {
      busy = false;
      $("#sendButton").disabled = false;
      $("#profileSelect").disabled = false;
      lastActivity = Date.now();
    }
  }
  function makeElement(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function attachGift(gift) {
    const image = $("#palCustomGift");
    image.hidden = !gift;
    $("#giftRemove").disabled = !gift;
    if (!gift) {
      pixelPal.setGift(null);
      $("#giftStatus").textContent = "현재 착용한 선물이 없어요.";
      return;
    }
    pixelPal.setGift(gift);
    $("#giftStatus").textContent = "착용 중: " + gift.name + " · " + $("#giftSlot option[value='" + gift.slot + "']").textContent;
  }
  function render(next) {
    state = next;
    pixelPal.setSkin(state.skin || (profileId === "child-2" ? "frog" : "pink"));
    $$("[data-skin-choice]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.skinChoice === pixelPal.skin)));
    $("#childName").value = state.child_name;
    $("#palName").value = state.pal_name;
    $("#palLabel").textContent = state.pal_name;
    $("#sessionHeading").textContent = state.pal_name + "과 함께하기";
    $("#bond").value = state.bond;
    $("#bondText").textContent = state.bond;
    const messages = $("#messages");
    messages.replaceChildren();
    if (!state.messages.length) messages.appendChild(makeElement("div", "먼저 인사해 보세요. 여기에서 대화가 시작됩니다.", "empty-message"));
    for (const message of state.messages) {
      const item = makeElement("li", message.text);
      item.dataset.role = message.role;
      item.appendChild(makeElement("small", message.role === "user" ? (state.child_name || "나") : state.pal_name + " · " + (message.source === "ollama" ? "로컬 AI" : "기본 반응")));
      messages.appendChild(item);
    }
    messages.scrollTop = messages.scrollHeight;
    $("#memoryCount").textContent = state.memories.length + " / 100";
    const memories = $("#memoryList");
    memories.replaceChildren();
    if (!state.memories.length) memories.appendChild(makeElement("li", "아직 저장한 기억이 없어요."));
    for (const memory of [...state.memories].reverse()) {
      const item = document.createElement("li"), body = makeElement("div", memory.text), button = makeElement("button", "삭제");
      body.appendChild(makeElement("small", new Date(memory.created_at).toLocaleString("ko-KR")));
      button.setAttribute("aria-label", "기억 삭제: " + memory.text);
      button.addEventListener("click", () => work(async () => {
        render(await api("/api/memory", {profile: profileId, delete_id: memory.id}));
        status("기억을 삭제했어요. 이전 대화에 인용된 내용은 대화 기록에 남을 수 있어요.");
      }));
      item.append(body, button); memories.appendChild(item);
    }
    attachGift(state.gift);
  }
  function animate(action) { pixelPal.play(action); }
  function say(text) {
    $("#speech").textContent = text;
    clearTimeout(talkTimer);
    character.classList.add("is-talking");
    talkTimer = setTimeout(() => character.classList.remove("is-talking"), Math.min(6000, Math.max(1000, text.length * 65)));
    if (!$("#voiceEnabled").checked) return;
    if (!("speechSynthesis" in window)) { status("이 브라우저에는 음성 읽기 기능이 없어요.", true); return; }
    const voice = speechSynthesis.getVoices().find(v => v.localService && v.lang.toLowerCase().startsWith("ko"));
    if (!voice) { status("설치된 한국어 로컬 음성이 없어요. macOS의 손쉬운 사용 > 콘텐츠 말하기에서 한국어 음성을 설치해 주세요.", true); return; }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = .95;
    utterance.onerror = () => status("음성이 재생되지 않았어요. 음성 설정과 볼륨을 확인해 주세요.", true);
    speechSynthesis.speak(utterance);
  }
  function clearDraft() {
    originalImage = null;
    $("#giftCanvas").hidden = true;
    $("#giftEmpty").hidden = false;
    $("#giftFile").value = "";
    $("#giftName").value = "";
    $("#whiteThreshold").value = 0;
    $("#thresholdLabel").textContent = "끄기";
    $("#giftSave").disabled = true;
  }
  async function loadProfile() {
    stopCamera(); clearDraft();
    state = null;
    $("#speech").textContent = "기억을 불러오고 있어요.";
    $("#messages").replaceChildren(); $("#memoryList").replaceChildren();
    $("#childName").value = ""; $("#palName").value = "";
    $("#palLabel").textContent = "불러오는 중";
    $("#sessionHeading").textContent = "기억을 불러오는 중";
    $("#memoryCount").textContent = "0 / 100";
    $("#bond").value = 0; $("#bondText").textContent = "—";
    attachGift(null);
    pixelPal.play("idle");
    $("#chatInput").value = ""; $("#memoryInput").value = "";
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    render(await api("/api/state?profile=" + encodeURIComponent(profileId)));
    $("#speech").textContent = state.child_name ? state.child_name + ", 다시 만나서 반가워!" : "안녕! 이름을 알려 주면 기억할게.";
    savePrefs();
    status((profileId === "child-1" ? "첫째" : "둘째") + "의 기억을 불러왔어요.");
  }
  function switchTab(tab) {
    if (!menu.some(m => m[0] === tab)) return;
    currentTab = tab;
    $$('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== tab);
    $$('[data-tab]').forEach(b => {
      b.classList.toggle("selected", b.dataset.tab === tab);
      if (b.dataset.tab === tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    if (tab !== "gift") stopCamera();
    lastActivity = Date.now();
  }
  async function action(name) {
    await work(async () => {
      const result = await api("/api/action", {profile: profileId, action: name});
      render(result.state); animate(name); status("반응을 확인하고 저장했어요."); say(result.reply);
    });
  }
  $("#chatForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!$("#chatInput").value.trim()) return;
    work(async () => {
      const text = $("#chatInput").value.trim();
      const mode = $("#chatMode").value;
      status(mode === "ollama" ? "이 맥북의 AI가 생각하고 있어요. 첫 응답은 모델 로딩으로 오래 걸릴 수 있어요." : "이야기에 답하고 있어요.");
      const result = await api("/api/chat", {profile: profileId, text, mode, model: $("#modelSelect").value});
      render(result.state); $("#chatInput").value = "";
      $("#lastResponse").textContent = (result.source === "ollama" ? "로컬 AI" : "기본 반응") + " · 응답 " + result.seconds + "초";
      status("대화를 맥북에 저장했어요."); say(result.reply);
    });
  });
  $("#memoryForm").addEventListener("submit", event => {
    event.preventDefault();
    work(async () => {
      render(await api("/api/memory", {profile: profileId, text: $("#memoryInput").value}));
      $("#memoryInput").value = ""; status("기억을 저장했어요. 대화에서 ‘내가 좋아하는 걸 기억해?’라고 물어보세요.");
    });
  });
  $("#profileForm").addEventListener("submit", event => {
    event.preventDefault();
    work(async () => {
      render(await api("/api/profile", {profile: profileId, child_name: $("#childName").value, pal_name: $("#palName").value}));
      status("이름을 맥북에 저장했어요.");
    });
  });
  $("#profileSelect").value = profileId;
  $("#profileSelect").addEventListener("change", () => work(async () => {
    const previous = profileId;
    const previousState = state;
    profileId = $("#profileSelect").value;
    try { await loadProfile(); }
    catch (error) { profileId = previous; $("#profileSelect").value = previous; if (previousState) render(previousState); throw error; }
  }));
  $$('[data-tab]').forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  $$('[data-action]').forEach(b => b.addEventListener("click", () => action(b.dataset.action)));
  character.addEventListener("click", () => action("pet"));
  character.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); action("pet"); }
  });
  $("#proactiveButton").addEventListener("click", () => { lastProactive = Date.now(); action("proactive"); });
  $("#proactiveEnabled").checked = prefs.proactive === true;
  $("#voiceEnabled").checked = prefs.voice === true;
  ["#proactiveEnabled", "#voiceEnabled"].forEach(id => $(id).addEventListener("change", savePrefs));
  $("#chatMode").value = prefs.mode === "ollama" ? "ollama" : "basic";
  if (typeof prefs.model === "string" && prefs.model.length < 100) $("#modelSelect").replaceChildren(new Option(prefs.model, prefs.model));
  function updateMode() {
    const ai = $("#chatMode").value === "ollama";
    $("#modeBadge").textContent = ai ? "로컬 AI" : "기본 반응";
    $("#chatHint").textContent = ai ? "이 맥북에서 실행 중인 AI와 대화합니다. 최근 기억과 대화를 함께 참고하며, 카메라 사진은 보내지 않습니다." : "기본 반응은 정해진 문장으로 교감을 시험합니다. 자유 대화는 설정에서 로컬 AI를 연결해 주세요.";
    savePrefs();
  }
  $("#chatMode").addEventListener("change", updateMode);
  $("#modelSelect").addEventListener("change", savePrefs);
  $("#checkOllama").addEventListener("click", () => work(async () => {
    const result = await api("/api/ollama");
    $("#modelSelect").replaceChildren();
    result.models.forEach(model => $("#modelSelect").add(new Option(model, model)));
    if (result.models.includes(prefs.model)) $("#modelSelect").value = prefs.model;
    else if (result.models.includes("qwen3:1.7b")) $("#modelSelect").value = "qwen3:1.7b";
    if (!result.models.length) $("#modelSelect").add(new Option("qwen3:1.7b", "qwen3:1.7b"));
    $("#ollamaStatus").textContent = !result.connected ? "Ollama가 실행되지 않았어요. 실행한 뒤 다시 확인해 주세요." : result.models.length ? "연결됐어요. 사용할 모델을 고르고 ‘로컬 AI’로 바꾸세요." : "Ollama는 연결됐지만 로컬 모델이 없어요. 터미널에서 ollama pull qwen3:1.7b 를 실행하세요.";
    status($("#ollamaStatus").textContent); savePrefs();
  }));

  function paintGift() {
    if (!originalImage) return;
    const canvas = $("#giftCanvas"), ctx = canvas.getContext("2d", {willReadFrequently: true});
    ctx.clearRect(0, 0, 512, 512);
    const ratio = Math.min(480 / originalImage.width, 480 / originalImage.height, 1);
    const width = originalImage.width * ratio, height = originalImage.height * ratio;
    ctx.drawImage(originalImage, (512 - width) / 2, (512 - height) / 2, width, height);
    const tolerance = Number($("#whiteThreshold").value);
    if (tolerance > 0) {
      const frame = ctx.getImageData(0, 0, 512, 512), threshold = 255 - tolerance;
      for (let i = 0; i < frame.data.length; i += 4) {
        const min = Math.min(frame.data[i], frame.data[i+1], frame.data[i+2]);
        if (min >= threshold) frame.data[i+3] = 0;
      }
      ctx.putImageData(frame, 0, 0);
    }
    $("#thresholdLabel").textContent = tolerance ? tolerance + "%" : "끄기";
    canvas.hidden = false; $("#giftEmpty").hidden = true; $("#giftSave").disabled = false;
  }
  async function readPicture(file) {
    if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("PNG·JPG·WebP 그림을 선택해 주세요. HEIC 사진은 JPEG로 내보내 주세요.");
    if (file.size > 10 * 1024 * 1024) throw new Error("10MB 이하 그림을 선택해 주세요.");
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("그림을 읽지 못했어요.")); image.src = objectUrl; });
      if (image.naturalWidth * image.naturalHeight > 25_000_000) throw new Error("너무 큰 사진이에요. 2500만 화소 이하로 줄여 주세요.");
      originalImage = image;
      $("#whiteThreshold").value = 0;
      $("#giftName").value = (file.name || "카메라 선물").replace(/\.[^.]+$/, "").slice(0, 60);
      paintGift(); status("붙일 위치를 선택하고 미리보기를 확인한 뒤 선물해 주세요.");
    } finally { URL.revokeObjectURL(objectUrl); }
  }
  $("#giftFile").addEventListener("change", () => work(() => readPicture($("#giftFile").files[0])));
  $("#whiteThreshold").addEventListener("input", paintGift);
  $("#giftSave").addEventListener("click", () => work(async () => {
    if (!originalImage) throw new Error("먼저 그림을 골라 주세요.");
    const gift = {name: $("#giftName").value.trim() || "내 그림 선물", slot: $("#giftSlot").value, image: $("#giftCanvas").toDataURL("image/png")};
    render(await api("/api/gift", {profile: profileId, gift}));
    setMenu(false); animate("happy"); status("선물을 착용하고 저장했어요."); say("네가 만든 " + gift.name + ", 정말 고마워!");
  }));
  $("#giftRemove").addEventListener("click", () => work(async () => {
    render(await api("/api/gift", {profile: profileId, gift: null})); status("착용한 선물을 벗겼어요.");
  }));
  function stopCamera() {
    cameraTicket++;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    $("#cameraVideo").srcObject = null;
    $("#cameraPanel").hidden = true;
    $("#cameraStatus").textContent = "카메라 꺼짐 · 사진은 선물로 저장할 때만 보관합니다.";
  }
  $("#cameraStart").addEventListener("click", () => work(async () => {
    stopCamera();
    const ticket = cameraTicket;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("카메라를 사용할 수 없어요. localhost로 열었는지 확인하고 그림 선택을 이용해 주세요.");
    try {
      const incoming = await navigator.mediaDevices.getUserMedia({video: {width: {ideal: 1280}, height: {ideal: 720}}, audio: false});
      if (ticket !== cameraTicket || currentTab !== "gift" || document.hidden) { incoming.getTracks().forEach(t => t.stop()); return; }
      stream = incoming; $("#cameraVideo").srcObject = incoming; $("#cameraPanel").hidden = false;
      await $("#cameraVideo").play();
      $("#cameraStatus").textContent = "카메라 사용 중 · 현재 영상은 저장·전송하지 않습니다. 맥북 내장 카메라 하나로 촬영 시험합니다.";
    } catch (_) { stopCamera(); throw new Error("카메라를 켜지 못했어요. macOS·브라우저의 카메라 허용 상태를 확인하거나 그림 선택을 이용해 주세요."); }
  }));
  $("#cameraStop").addEventListener("click", stopCamera);
  $("#cameraCapture").addEventListener("click", () => work(async () => {
    const video = $("#cameraVideo");
    if (!video.videoWidth) throw new Error("카메라 영상이 준비되면 촬영해 주세요.");
    const capture = document.createElement("canvas"); capture.width = video.videoWidth; capture.height = video.videoHeight;
    capture.getContext("2d").drawImage(video, 0, 0);
    const blob = await new Promise(resolve => capture.toBlob(resolve, "image/jpeg", .9));
    stopCamera();
    if (!blob) throw new Error("사진을 만들지 못했어요.");
    await readPicture(new File([blob], "카메라 선물.jpg", {type: "image/jpeg"}));
  }));
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopCamera(); lastActivity = Date.now(); });
  window.addEventListener("pagehide", stopCamera);

  function download(filename, content, mime = "application/json") {
    const url = URL.createObjectURL(new Blob([content], {type: mime}));
    const link = document.createElement("a"); link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  $("#exportBackup").addEventListener("click", () => work(async () => {
    download("PocketPal_Backup_" + new Date().toISOString().slice(0,10) + ".json", JSON.stringify(await api("/api/backup"), null, 2));
    status("두 아이의 백업 다운로드를 시작했어요. 이름·기억·최근 대화·착용 선물이 포함됩니다.");
  }));
  $("#restoreFile").addEventListener("change", () => work(async () => {
    const file = $("#restoreFile").files[0]; $("#restoreFile").value = "";
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) throw new Error("백업 파일은 12MB 이하여야 해요.");
    let backup;
    try { backup = JSON.parse(await file.text()); } catch (_) { throw new Error("백업 JSON을 읽지 못했어요."); }
    if (!confirm("두 아이의 현재 이름·기억·대화·선물을 이 백업 내용으로 바꿀까요? 필요한 현재 데이터는 먼저 백업해 주세요.")) return;
    await api("/api/restore", {backup, confirm: "RESTORE"}); await loadProfile(); status("두 아이의 백업을 복원했어요.");
  }));
  $("#resetProfile").addEventListener("click", () => work(async () => {
    const label = profileId === "child-1" ? "첫째" : "둘째";
    if (!confirm(label + "의 이름·기억·최근 대화·선물을 삭제할까요? 다른 아이의 데이터는 유지됩니다.")) return;
    await api("/api/reset", {profile: profileId, confirm: "DELETE"}); await loadProfile(); status(label + "의 데이터를 삭제했어요.");
  }));
  const checks = $$('#testList input');
  checks.forEach(input => { input.checked = Array.isArray(prefs.tests) && prefs.tests.includes(input.value); });
  $("#testNotes").value = typeof prefs.notes === "string" ? prefs.notes : "";
  function saveTests() {
    prefs.tests = checks.filter(c => c.checked).map(c => c.value);
    prefs.notes = $("#testNotes").value;
    $("#testProgress").textContent = prefs.tests.length + " / 8";
    savePrefs();
  }
  checks.forEach(c => c.addEventListener("change", saveTests));
  $("#testNotes").addEventListener("input", saveTests);
  $("#exportTest").addEventListener("click", () => {
    saveTests();
    const report = {app: "PocketPal Mac Lab", version: info?.version || "unknown", recorded_at: new Date().toISOString(),
      user_agent: navigator.userAgent, verification: "사용자가 직접 표시한 시험 결과", tests: checks.map(c => ({id: c.value, item: c.parentElement.textContent.trim(), checked: c.checked})),
      notes: $("#testNotes").value, ai_mode: $("#chatMode").value};
    download("PocketPal_Mac_Test_Result.json", JSON.stringify(report, null, 2));
    status("시험 결과 다운로드를 시작했어요. 이 파일에는 아이의 기억이나 대화를 넣지 않았어요.");
  });
  function setMenu(open) {
    menuOpen = open; $("#homeScreen").hidden = open; $("#wheelMenu").hidden = !open;
    $("#menuButton").setAttribute("aria-expanded", String(open)); renderMenu();
  }
  function renderMenu() {
    const host = $("#wheelItems"); host.replaceChildren();
    menu.forEach(([tab, title], index) => {
      const button = makeElement("button", title);
      button.classList.toggle("selected", index === menuIndex);
      button.addEventListener("click", () => { menuIndex = index; selectMenu(); });
      host.appendChild(button);
    });
  }
  function moveMenu(delta) {
    if (!menuOpen) setMenu(true);
    menuIndex = (menuIndex + delta + menu.length) % menu.length; renderMenu();
  }
  function selectMenu() {
    if (!menuOpen) { action("pet"); return; }
    switchTab(menu[menuIndex][0]); setMenu(false);
  }
  $("#menuButton").addEventListener("click", () => setMenu(!menuOpen));
  $("#wheelCenter").addEventListener("click", selectMenu);
  $("#wheelPrev").addEventListener("click", () => moveMenu(-1));
  $("#wheelNext").addEventListener("click", () => moveMenu(1));
  function wheelAngle(event) {
    const r = $("#wheelArea").getBoundingClientRect();
    return Math.atan2(event.clientY - r.top - r.height / 2, event.clientX - r.left - r.width / 2) * 180 / Math.PI;
  }
  $("#wheelArea").addEventListener("pointerdown", event => {
    if (event.target.closest("button")) return;
    drag = {angle: wheelAngle(event), accumulated: 0};
    $("#wheelArea").setPointerCapture(event.pointerId);
  });
  $("#wheelArea").addEventListener("pointermove", event => {
    if (!drag) return;
    const angle = wheelAngle(event);
    drag.accumulated += ((angle - drag.angle + 540) % 360) - 180; drag.angle = angle;
    while (Math.abs(drag.accumulated) >= 28) { const delta = Math.sign(drag.accumulated); moveMenu(delta); drag.accumulated -= 28 * delta; }
  });
  function endDrag(event) { drag = null; if ($("#wheelArea").hasPointerCapture(event.pointerId)) $("#wheelArea").releasePointerCapture(event.pointerId); }
  $("#wheelArea").addEventListener("pointerup", endDrag); $("#wheelArea").addEventListener("pointercancel", endDrag);
  $("#wheelArea").addEventListener("wheel", event => { event.preventDefault(); moveMenu(event.deltaY > 0 ? 1 : -1); }, {passive: false});
  window.addEventListener("keydown", event => {
    lastActivity = Date.now();
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.("input, textarea, select, button, [contenteditable='true'], [role='button']")) return;
    if (["ArrowDown", "ArrowRight"].includes(event.key)) { event.preventDefault(); moveMenu(1); }
    if (["ArrowUp", "ArrowLeft"].includes(event.key)) { event.preventDefault(); moveMenu(-1); }
    if (["Enter", " "].includes(event.key)) { event.preventDefault(); if (menuOpen) selectMenu(); else setMenu(true); }
    if (event.key === "Escape") setMenu(false);
  });
  document.addEventListener("pointerdown", () => lastActivity = Date.now(), {passive: true});
  document.addEventListener("input", () => lastActivity = Date.now());
  $$("[data-skin-choice]").forEach(button => button.addEventListener("click", () => work(async () => {
    render(await api("/api/appearance", {profile: profileId, skin: button.dataset.skinChoice}));
    status("이 아이의 캐릭터를 저장했어요.");
  })));
  let freeMovement = true, motionPaused = false;
  $("#autoplayToggle").addEventListener("click", () => {
    freeMovement = !freeMovement; pixelPal.setAutoplay(freeMovement);
    $("#autoplayToggle").setAttribute("aria-pressed", String(freeMovement));
    $("#autoplayToggle").textContent = "자유롭게 움직이기 " + (freeMovement ? "켜짐" : "꺼짐");
    if (!freeMovement) pixelPal.play("idle");
  });
  $("#pauseCharacter").addEventListener("click", () => {
    motionPaused = !motionPaused; pixelPal.setPaused(motionPaused);
    $("#pauseCharacter").setAttribute("aria-pressed", String(motionPaused));
    $("#pauseCharacter").textContent = motionPaused ? "움직임 다시 시작" : "움직임 멈추기";
  });
  function tick() {
    $("#clock").textContent = new Date().toLocaleTimeString("ko-KR", {hour: "2-digit", minute: "2-digit", hour12: false});
    if (!state || busy || document.hidden || currentTab !== "talk" || menuOpen || !$("#proactiveEnabled").checked || $("#chatInput").value.trim()) return;
    if (Date.now() - lastActivity >= 45000 && Date.now() - lastProactive >= 300000) { lastProactive = Date.now(); action("proactive"); }
  }
  setInterval(tick, 1000); tick(); renderMenu(); updateMode(); saveTests();
  work(async () => {
    info = await api("/api/info");
    $("#connection").textContent = "맥북 연결됨";
    $("#storagePath").textContent = "저장 위치: " + info.storage;
    await loadProfile();
  });
})();
