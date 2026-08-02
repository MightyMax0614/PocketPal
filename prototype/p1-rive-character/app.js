"use strict";

(() => {
  const contract = window.POCKETPAL_RIVE_CONTRACT;
  const VERSION = "2.38.5";
  const runtimeUrls = [
    `https://unpkg.com/@rive-app/canvas-single@${VERSION}/rive.js`,
    `https://cdn.jsdelivr.net/npm/@rive-app/canvas-single@${VERSION}/rive.js`
  ];
  const canvas = document.querySelector("#riveCanvas");
  const stageMessage = document.querySelector("#stageMessage");
  const engineStatus = document.querySelector("#engineStatus");
  const assetBadge = document.querySelector("#assetBadge");
  const contractList = document.querySelector("#contractList");
  const contractScore = document.querySelector("#contractScore");
  const contractMessage = document.querySelector("#contractMessage");
  const actionMessage = document.querySelector("#actionMessage");
  const pauseButton = document.querySelector("#pauseButton");
  const localFile = document.querySelector("#localFile");

  let rive = null;
  let activeMachine = "";
  let activeInputs = [];
  let paused = false;
  let loadToken = 0;

  function showStage(title, detail, visible = true) {
    stageMessage.querySelector("strong").textContent = title;
    stageMessage.querySelector("span").textContent = detail;
    stageMessage.classList.toggle("hidden", !visible);
  }

  function status(kind, text) {
    engineStatus.className = `status ${kind}`;
    engineStatus.textContent = text;
  }

  function cleanup() {
    try { rive?.cleanup(); } catch (error) { console.warn(error); }
    rive = null;
    activeMachine = "";
    activeInputs = [];
    paused = false;
    pauseButton.disabled = true;
    pauseButton.textContent = "일시정지";
    document.querySelectorAll("[data-action], [data-style]").forEach((item) => { item.disabled = true; });
  }

  function loadScript(url, timeoutMs = 18000) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timer = setTimeout(() => {
        script.remove();
        reject(new Error(`런타임 시간 초과: ${url}`));
      }, timeoutMs);
      script.src = url;
      script.async = true;
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error(`런타임 실패: ${url}`)); };
      document.head.append(script);
    });
  }

  async function ensureRuntime() {
    if (window.rive?.Rive) return;
    for (const url of runtimeUrls) {
      try {
        await loadScript(url);
        if (window.rive?.Rive) return;
      } catch (error) {
        console.warn(error);
      }
    }
    throw new Error("Rive 런타임을 불러오지 못했습니다.");
  }

  async function fetchBuffer(url, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { cache: "no-store", mode: "cors", signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.arrayBuffer();
    } finally {
      clearTimeout(timer);
    }
  }

  function typeName(input) {
    const type = window.rive.StateMachineInputType;
    if (input.type === type?.Number) return "Number";
    if (input.type === type?.Boolean) return "Boolean";
    if (input.type === type?.Trigger) return "Trigger";
    return `Type ${input.type}`;
  }

  function renderContract(isPocketPal) {
    contractList.innerHTML = "";
    const byName = new Map(activeInputs.map((item) => [item.name, item]));
    let passed = 0;

    contract.inputs.forEach((expected) => {
      const actual = byName.get(expected.name);
      const ok = Boolean(isPocketPal && actual && typeName(actual) === expected.type);
      if (ok) passed += 1;
      const row = document.createElement("div");
      row.className = `contract-item${ok ? " ok" : ""}`;
      const icon = document.createElement("b");
      icon.textContent = ok ? "✓" : "·";
      const name = document.createElement("strong");
      name.textContent = expected.name;
      const detail = document.createElement("span");
      detail.textContent = ok ? expected.type : actual ? `타입 불일치: ${typeName(actual)}` : "없음";
      row.append(icon, name, detail);
      contractList.append(row);
    });

    contractScore.textContent = `${passed}/${contract.inputs.length}`;
    contractScore.classList.toggle("good", passed === contract.inputs.length);
    contractMessage.textContent = passed === contract.inputs.length
      ? "PocketPal 리그 계약을 모두 만족했습니다. 소울과 꾸미기 제어가 활성화됐어요."
      : isPocketPal
        ? "일부 입력이 빠졌습니다. Rive Editor에서 계약 이름과 타입을 맞춰야 합니다."
        : "현재는 공식 대체 샘플입니다. 전용 pocketpal.riv을 열면 실제 계약을 검사합니다.";
    return passed === contract.inputs.length;
  }

  function setControls(enabled) {
    document.querySelectorAll("[data-action], [data-style]").forEach((item) => { item.disabled = !enabled; });
  }

  function input(name) {
    return activeInputs.find((item) => item.name === name);
  }

  function setNumber(name, value) {
    const target = input(name);
    if (!target || typeName(target) !== "Number") return false;
    target.value = value;
    return true;
  }

  function setBoolean(name, value) {
    const target = input(name);
    if (!target || typeName(target) !== "Boolean") return false;
    target.value = value;
    return true;
  }

  function fire(name) {
    const target = input(name);
    if (!target || typeName(target) !== "Trigger") return false;
    target.fire();
    return true;
  }

  function applyAction(action) {
    let ok = false;
    if (action === "calm") ok = setNumber("mood", contract.moods.calm);
    if (action === "curious") ok = setNumber("mood", contract.moods.curious) || fire("notice");
    if (action === "happy") ok = setNumber("mood", contract.moods.happy);
    if (action === "sleepy") ok = setNumber("mood", contract.moods.sleepy) || setBoolean("sleepy", true);
    if (action === "talk") {
      ok = setBoolean("talking", true);
      setTimeout(() => setBoolean("talking", false), 1800);
    }
    if (action === "pet") ok = fire("pet");
    if (action === "wave") ok = fire("wave");
    if (action === "jump") ok = fire("jump");
    actionMessage.textContent = ok ? `‘${action}’ 명령을 캐릭터에 전달했습니다.` : "이 파일에는 필요한 입력이 없습니다.";
  }

  function instantiate(buffer, meta, token) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) reject(new Error("Rive 파일 로드 시간 초과"));
      }, 15000);
      const fail = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      try {
        rive = new window.rive.Rive({
          buffer,
          canvas,
          autoplay: true,
          autoBind: true,
          artboard: meta.isPocketPal ? contract.artboard : undefined,
          stateMachines: meta.isPocketPal ? contract.stateMachine : undefined,
          layout: new window.rive.Layout({ fit: window.rive.Fit.Contain, alignment: window.rive.Alignment.Center }),
          onLoad: () => {
            if (token !== loadToken) return;
            try { rive.resizeDrawingSurfaceToCanvas(); } catch (error) { console.warn(error); }
            activeMachine = meta.isPocketPal ? contract.stateMachine : "";
            try { activeInputs = activeMachine ? rive.stateMachineInputs(activeMachine) || [] : []; }
            catch (error) { activeInputs = []; }
            const complete = renderContract(meta.isPocketPal);
            setControls(complete);
            pauseButton.disabled = false;
            assetBadge.textContent = meta.label;
            status("ready", "실행 중");
            showStage(meta.label, meta.isPocketPal ? "PocketPal 캐릭터 리그를 실행 중입니다." : "공식 샘플로 Rive 엔진을 실행 중입니다.", false);
            requestAnimationFrame(() => requestAnimationFrame(() => {
              if (token === loadToken) status("ready", "실행 성공");
            }));
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve();
            }
          },
          onLoadError: (event) => fail(new Error(`Rive onLoadError: ${String(event)}`))
        });
      } catch (error) {
        fail(error);
      }
    });
  }

  async function loadUrl(url, meta) {
    const token = ++loadToken;
    cleanup();
    status("loading", "불러오는 중");
    assetBadge.textContent = meta.label;
    showStage(meta.label, "Rive 파일을 내려받고 있어요.", true);
    try {
      await ensureRuntime();
      const buffer = await fetchBuffer(url);
      if (token !== loadToken) return;
      await instantiate(buffer, meta, token);
    } catch (error) {
      if (token !== loadToken) return;
      status("error", "로드 실패");
      showStage("캐릭터 파일을 열지 못했어요", String(error.message || error), true);
      renderContract(false);
      throw error;
    }
  }

  async function loadPocketPalOrFallback() {
    try {
      await loadUrl(`${contract.localAsset}?v=${Date.now()}`, { label: "pocketpal.riv", isPocketPal: true });
    } catch (error) {
      await loadUrl(contract.fallbackAsset, { label: "공식 대체 샘플", isPocketPal: false });
    }
  }

  async function loadFile(file) {
    const token = ++loadToken;
    cleanup();
    status("loading", "파일 확인 중");
    showStage(file.name, "아이폰 파일을 읽고 있어요.", true);
    try {
      await ensureRuntime();
      const buffer = await file.arrayBuffer();
      if (token !== loadToken) return;
      await instantiate(buffer, { label: file.name, isPocketPal: true }, token);
    } catch (error) {
      status("error", "파일 오류");
      showStage("선택한 파일을 열지 못했어요", String(error.message || error), true);
    }
  }

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => applyAction(button.dataset.action));
  });

  document.querySelectorAll("[data-style]").forEach((select) => {
    select.addEventListener("change", () => {
      const ok = setNumber(select.dataset.style, Number(select.value));
      actionMessage.textContent = ok ? `${select.dataset.style} = ${select.value}` : "꾸미기 입력을 찾지 못했습니다.";
    });
  });

  localFile.addEventListener("change", () => {
    const file = localFile.files?.[0];
    if (file) loadFile(file);
  });
  document.querySelector("#reloadLocal").addEventListener("click", loadPocketPalOrFallback);
  document.querySelector("#loadFallback").addEventListener("click", () => loadUrl(contract.fallbackAsset, { label: "공식 대체 샘플", isPocketPal: false }));
  pauseButton.addEventListener("click", () => {
    if (!rive) return;
    paused = !paused;
    paused ? rive.pause() : rive.play();
    pauseButton.textContent = paused ? "계속 재생" : "일시정지";
  });

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(() => {
      try { rive?.resizeDrawingSurfaceToCanvas(); } catch (error) { console.warn(error); }
    });
    observer.observe(canvas);
    window.addEventListener("beforeunload", () => observer.disconnect());
  }
  window.addEventListener("beforeunload", cleanup);

  renderContract(false);
  loadPocketPalOrFallback();
})();
