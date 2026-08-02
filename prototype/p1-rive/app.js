"use strict";

(() => {
  const RUNTIME_VERSION = "2.38.5";
  const RUNTIME_SOURCES = [
    `https://unpkg.com/@rive-app/canvas-single@${RUNTIME_VERSION}/rive.js`,
    `https://cdn.jsdelivr.net/npm/@rive-app/canvas-single@${RUNTIME_VERSION}/rive.js`,
    `https://unpkg.com/@rive-app/canvas-single@${RUNTIME_VERSION}`
  ];

  const ASSETS = {
    github: {
      label: "공식 GitHub rewards.riv",
      url: "https://raw.githubusercontent.com/rive-app/rive-flutter/master/example/assets/rewards.riv",
      machine: ""
    },
    vehicles: {
      label: "공식 Rive CDN vehicles.riv",
      url: "https://cdn.rive.app/animations/vehicles.riv",
      machine: "bumpy"
    }
  };

  const canvas = document.querySelector("#riveCanvas");
  const stageMessage = document.querySelector("#stageMessage");
  const healthDot = document.querySelector("#healthDot");
  const healthText = document.querySelector("#healthText");
  const fpsValue = document.querySelector("#fpsValue");
  const diagnosticSummary = document.querySelector("#diagnosticSummary");
  const inputInspector = document.querySelector("#inputInspector");
  const bindingBadge = document.querySelector("#bindingBadge");
  const eventLog = document.querySelector("#eventLog");
  const pauseButton = document.querySelector("#pauseButton");
  const soulMessage = document.querySelector("#soulMessage");
  const localRiveFile = document.querySelector("#localRiveFile");
  const deviceBuild = document.querySelector("#deviceBuild");

  const steps = {
    runtime: document.querySelector("#stepRuntime"),
    asset: document.querySelector("#stepAsset"),
    parse: document.querySelector("#stepParse"),
    render: document.querySelector("#stepRender"),
    machine: document.querySelector("#stepMachine")
  };

  let riveInstance = null;
  let currentMachine = "";
  let currentRuntimeSource = "";
  let currentAsset = "";
  let currentBytes = 0;
  let paused = false;
  let runToken = 0;
  let firstAdvanceSeen = false;
  let resizeObserver = null;

  function nowLabel() {
    return new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  }

  function log(message) {
    const item = document.createElement("li");
    const time = document.createElement("time");
    time.textContent = nowLabel();
    item.append(time, document.createTextNode(message));
    eventLog.prepend(item);
    while (eventLog.children.length > 50) eventLog.lastElementChild?.remove();
  }

  function setStep(name, state, detail) {
    const item = steps[name];
    if (!item) return;
    item.dataset.state = state;
    const icon = item.querySelector(".diagnostic-icon");
    const text = item.querySelector("span");
    if (icon) icon.textContent = state === "ok" ? "✓" : state === "error" ? "!" : "…";
    if (text) text.textContent = detail;
  }

  function resetSteps() {
    setStep("runtime", "pending", "런타임 스크립트를 확인합니다.");
    setStep("asset", "pending", ".riv 파일을 직접 내려받아 확인합니다.");
    setStep("parse", "pending", "다운로드 후 파일 해석을 확인합니다.");
    setStep("render", "pending", "첫 렌더 프레임을 확인합니다.");
    setStep("machine", "pending", "상태 머신 정보를 확인합니다.");
  }

  function setHealth(state, text) {
    healthDot.className = `health-dot ${state}`;
    healthText.textContent = text;
  }

  function setStage(title, detail, visible = true) {
    stageMessage.querySelector("strong").textContent = title;
    stageMessage.querySelector("span").textContent = detail;
    stageMessage.classList.toggle("hidden", !visible);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function errorText(error) {
    if (!error) return "알 수 없는 오류";
    if (error.name === "AbortError") return "시간 초과";
    return String(error.message || error);
  }

  function cleanupRive() {
    if (riveInstance) {
      try { riveInstance.disableFPSCounter?.(); } catch (error) { console.warn(error); }
      try { riveInstance.cleanup(); } catch (error) { console.warn(error); }
    }
    riveInstance = null;
    currentMachine = "";
    firstAdvanceSeen = false;
    fpsValue.textContent = "--";
    pauseButton.disabled = true;
    pauseButton.textContent = "일시정지";
    paused = false;
    document.querySelectorAll("[data-soul]").forEach((button) => { button.disabled = true; });
  }

  function loadScript(url, timeoutMs = 18000) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => {
        script.remove();
        reject(new Error(`런타임 스크립트 시간 초과: ${url}`));
      }, timeoutMs);
      script.src = url;
      script.async = true;
      script.onload = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      script.onerror = () => {
        window.clearTimeout(timeout);
        script.remove();
        reject(new Error(`런타임 스크립트 다운로드 실패: ${url}`));
      };
      document.head.append(script);
    });
  }

  async function ensureRuntime(token) {
    if (window.rive?.Rive) {
      currentRuntimeSource = "이미 로드됨";
      setStep("runtime", "ok", "Rive API가 이미 준비돼 있습니다.");
      return;
    }

    for (const source of RUNTIME_SOURCES) {
      if (token !== runToken) throw new Error("검사가 교체됨");
      setStep("runtime", "pending", `시도 중: ${source}`);
      log(`런타임 시도: ${source}`);
      try {
        await loadScript(source);
        if (!window.rive?.Rive) throw new Error("스크립트는 받았지만 window.rive.Rive가 없습니다.");
        currentRuntimeSource = source;
        setStep("runtime", "ok", `준비 완료 · canvas-single ${RUNTIME_VERSION}`);
        log("Rive 런타임 API 확인 완료");
        return;
      } catch (error) {
        log(`런타임 실패: ${errorText(error)}`);
      }
    }
    throw new Error("unpkg와 jsDelivr 모두에서 Rive 런타임을 받지 못했습니다.");
  }

  async function fetchBuffer(url, token, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    const started = performance.now();
    try {
      const response = await fetch(url, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        signal: controller.signal
      });
      if (token !== runToken) throw new Error("검사가 교체됨");
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 32) throw new Error(`파일이 너무 작습니다: ${buffer.byteLength} bytes`);
      const elapsed = Math.round(performance.now() - started);
      return { buffer, elapsed, contentType: response.headers.get("content-type") || "알 수 없음" };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function inspectInputs(machineName) {
    inputInspector.innerHTML = "";
    if (!machineName || !riveInstance?.stateMachineInputs) {
      inputInspector.innerHTML = '<p class="empty-state">이 샘플은 상태 머신 이름을 자동 확정하지 않았어요. 렌더링 성공 여부는 위 진단에서 확인할 수 있습니다.</p>';
      return 0;
    }

    let inputs = [];
    try { inputs = riveInstance.stateMachineInputs(machineName) || []; }
    catch (error) { log(`입력 조회 실패: ${errorText(error)}`); }

    if (!inputs.length) {
      inputInspector.innerHTML = '<p class="empty-state">상태 머신은 실행됐지만 외부에서 조작할 Input이 없습니다.</p>';
      return 0;
    }

    inputs.forEach((input) => {
      const row = document.createElement("div");
      row.className = "input-row";
      const meta = document.createElement("div");
      meta.className = "input-meta";
      const title = document.createElement("strong");
      title.textContent = input.name;
      const type = document.createElement("span");
      const typeName = input.type === window.rive.StateMachineInputType?.Number ? "Number"
        : input.type === window.rive.StateMachineInputType?.Boolean ? "Boolean"
          : input.type === window.rive.StateMachineInputType?.Trigger ? "Trigger" : `Type ${input.type}`;
      type.textContent = typeName;
      meta.append(title, type);
      row.append(meta);

      const button = document.createElement("button");
      button.type = "button";
      if (typeName === "Trigger") {
        button.textContent = "FIRE";
        button.addEventListener("click", () => input.fire());
      } else if (typeName === "Boolean") {
        const update = () => { button.textContent = input.value ? "TRUE" : "FALSE"; };
        update();
        button.addEventListener("click", () => { input.value = !input.value; update(); });
      } else {
        button.textContent = String(Number(input.value) || 0);
        button.addEventListener("click", () => { input.value = (Number(input.value) || 0) + 1; button.textContent = String(input.value); });
      }
      row.append(button);
      inputInspector.append(row);
    });
    return inputs.length;
  }

  function instantiateBuffer(buffer, asset, token) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("Rive 파일 해석 또는 onLoad 콜백이 15초 안에 완료되지 않았습니다."));
      }, 15000);

      const finishReject = (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error(errorText(error)));
      };

      try {
        riveInstance = new window.rive.Rive({
          buffer,
          canvas,
          autoplay: true,
          autoBind: true,
          stateMachines: asset.machine || undefined,
          layout: new window.rive.Layout({ fit: window.rive.Fit.Contain, alignment: window.rive.Alignment.Center }),
          onLoad: () => {
            if (token !== runToken) return;
            try { riveInstance.resizeDrawingSurfaceToCanvas(); } catch (error) { log(`리사이즈 경고: ${errorText(error)}`); }
            setStep("parse", "ok", "Rive 파일 해석 완료 · onLoad 수신");
            setStep("render", "pending", "첫 애니메이션 프레임을 기다리는 중");
            log("Rive onLoad 콜백 수신");
            if (!settled) {
              settled = true;
              window.clearTimeout(timeout);
              resolve();
            }
          },
          onLoadError: (event) => finishReject(new Error(`Rive onLoadError: ${errorText(event)}`)),
          onPlay: () => log("Rive 재생 시작 이벤트"),
          onStateChange: (event) => log(`State: ${Array.isArray(event?.data) ? event.data.join(", ") : String(event?.data || "변경")}`),
          onAdvance: () => {
            if (token !== runToken || firstAdvanceSeen) return;
            firstAdvanceSeen = true;
            setStep("render", "ok", "렌더 루프가 실제 프레임을 생성하고 있습니다.");
            setHealth("ready", "실행 성공");
            setStage(asset.label, "Rive 애니메이션이 아이폰에서 실행 중입니다.", false);
            diagnosticSummary.textContent = "Rive 엔진과 파일 렌더링이 모두 성공했습니다.";
            pauseButton.disabled = false;
          }
        });
      } catch (error) {
        finishReject(error);
      }
    });
  }

  async function runAsset(assetKey) {
    const token = ++runToken;
    const asset = ASSETS[assetKey];
    cleanupRive();
    resetSteps();
    currentAsset = asset.label;
    currentBytes = 0;
    setHealth("loading", "진단 중");
    setStage("Rive 런타임 확인", "엔진과 애니메이션 파일을 분리해서 검사합니다.", true);
    diagnosticSummary.textContent = `${asset.label} 검사를 시작합니다.`;
    log(`검사 시작: ${asset.label}`);

    try {
      await ensureRuntime(token);
      if (token !== runToken) return;

      setStep("asset", "pending", `${asset.url} 다운로드 중`);
      setStage(".riv 파일 다운로드", asset.url, true);
      const fetched = await fetchBuffer(asset.url, token);
      currentBytes = fetched.buffer.byteLength;
      setStep("asset", "ok", `${formatBytes(currentBytes)} · ${fetched.elapsed}ms · ${fetched.contentType}`);
      log(`애셋 다운로드 완료: ${formatBytes(currentBytes)}, ${fetched.elapsed}ms`);

      setStep("parse", "pending", "다운로드한 ArrayBuffer를 Rive 엔진에 전달했습니다.");
      setStage("Rive 파일 해석", "파일 구조와 Artboard를 읽고 있어요.", true);
      await instantiateBuffer(fetched.buffer, asset, token);
      if (token !== runToken) return;

      if (asset.machine) {
        currentMachine = asset.machine;
        const count = inspectInputs(currentMachine);
        setStep("machine", "ok", `${asset.machine} 실행 · Input ${count}개`);
        bindingBadge.textContent = `${asset.machine} · ${count} inputs`;
        bindingBadge.classList.add("bound");
        document.querySelectorAll("[data-soul]").forEach((button) => { button.disabled = false; });
      } else {
        currentMachine = "";
        inspectInputs("");
        setStep("machine", "ok", "기본 Artboard/선형 애니메이션으로 실행");
        bindingBadge.textContent = "기본 재생";
        bindingBadge.classList.remove("bound");
      }

      window.setTimeout(() => {
        if (token !== runToken || firstAdvanceSeen) return;
        setStep("render", "error", "onLoad는 성공했지만 렌더 프레임 이벤트가 확인되지 않았습니다.");
        setHealth("error", "렌더 확인 필요");
        setStage("파일은 열렸지만 화면이 움직이지 않아요", "상세 실행 기록을 복사해 보내 주세요.", true);
      }, 3500);

      try {
        riveInstance.enableFPSCounter?.((fps) => { fpsValue.textContent = Number.isFinite(fps) ? String(Math.round(fps)) : "--"; });
      } catch (error) { log(`FPS 측정 미지원: ${errorText(error)}`); }
    } catch (error) {
      if (token !== runToken) return;
      const message = errorText(error);
      log(`검사 실패: ${message}`);
      setHealth("error", "실패 지점 표시됨");
      diagnosticSummary.textContent = message;
      setStage("Rive 실행 실패", message, true);

      const runtimeOk = window.rive?.Rive;
      if (!runtimeOk) setStep("runtime", "error", message);
      else if (steps.asset.dataset.state !== "ok") setStep("asset", "error", message);
      else if (steps.parse.dataset.state !== "ok") setStep("parse", "error", message);
      else setStep("render", "error", message);
    }
  }

  async function runLocalFile(file) {
    const token = ++runToken;
    cleanupRive();
    resetSteps();
    currentAsset = file.name;
    setHealth("loading", "로컬 파일 검사");
    setStage("아이폰 파일 읽기", file.name, true);
    try {
      await ensureRuntime(token);
      const started = performance.now();
      const buffer = await file.arrayBuffer();
      currentBytes = buffer.byteLength;
      setStep("asset", "ok", `아이폰 로컬 파일 · ${formatBytes(currentBytes)} · ${Math.round(performance.now() - started)}ms`);
      setStep("parse", "pending", "로컬 ArrayBuffer를 Rive 엔진에 전달했습니다.");
      await instantiateBuffer(buffer, { label: file.name, machine: "" }, token);
      setStep("machine", "ok", "기본 Artboard/애니메이션으로 실행");
      inspectInputs("");
    } catch (error) {
      const message = errorText(error);
      setHealth("error", "로컬 파일 실패");
      setStage("로컬 .riv 실행 실패", message, true);
      diagnosticSummary.textContent = message;
      if (!window.rive?.Rive) setStep("runtime", "error", message);
      else if (steps.parse.dataset.state !== "ok") setStep("parse", "error", message);
      else setStep("render", "error", message);
      log(`로컬 파일 실패: ${message}`);
    }
  }

  function findInputs() {
    if (!riveInstance || !currentMachine) return [];
    try { return riveInstance.stateMachineInputs(currentMachine) || []; }
    catch (error) { return []; }
  }

  function applySoulPreset(preset) {
    const inputs = findInputs();
    if (!inputs.length) {
      soulMessage.textContent = "현재 샘플에 조작 가능한 Input이 없습니다.";
      return;
    }
    let matched = false;
    inputs.forEach((input) => {
      const name = input.name.toLowerCase();
      const triggerNames = preset === "pet" ? ["pet", "tap", "press", "wave"]
        : preset === "happy" ? ["happy", "jump", "celebrate"]
          : preset === "talking" ? ["talk", "speak"]
            : preset === "sleepy" ? ["sleep", "yawn"]
              : preset === "curious" ? ["look", "curious", "notice"] : ["idle", "calm"];
      if (!triggerNames.some((word) => name.includes(word))) return;
      if (input.type === window.rive.StateMachineInputType?.Trigger) input.fire();
      else if (input.type === window.rive.StateMachineInputType?.Boolean) input.value = true;
      else input.value = (Number(input.value) || 0) + 1;
      matched = true;
    });
    soulMessage.textContent = matched ? `‘${preset}’ 명령을 Rive Input에 전달했습니다.` : "이 공식 샘플에는 같은 이름의 Input이 없습니다.";
  }

  function diagnosticText() {
    const lines = [
      "PocketPal Rive P1.5.1",
      `시간: ${new Date().toISOString()}`,
      `페이지: ${location.href}`,
      `온라인: ${navigator.onLine}`,
      `브라우저: ${navigator.userAgent}`,
      `런타임: ${currentRuntimeSource || "없음"}`,
      `애셋: ${currentAsset || "없음"}`,
      `크기: ${currentBytes}`
    ];
    document.querySelectorAll(".diagnostic-item").forEach((item) => {
      lines.push(`${item.querySelector("strong")?.textContent}: ${item.dataset.state} / ${item.querySelector("span")?.textContent}`);
    });
    [...eventLog.children].reverse().forEach((item) => lines.push(item.textContent.trim()));
    return lines.join("\n");
  }

  document.querySelector("#retryAll").addEventListener("click", () => runAsset("github"));
  document.querySelector("#testGithubAsset").addEventListener("click", () => runAsset("github"));
  document.querySelector("#testRiveCdn").addEventListener("click", () => runAsset("vehicles"));
  document.querySelector("#clearLog").addEventListener("click", () => { eventLog.innerHTML = ""; });
  document.querySelector("#copyDiagnostics").addEventListener("click", async () => {
    const text = diagnosticText();
    try { await navigator.clipboard.writeText(text); diagnosticSummary.textContent = "진단 내용을 복사했습니다."; }
    catch (error) { diagnosticSummary.textContent = "복사 권한이 없어 아래 실행 기록을 캡처해 주세요."; }
  });

  localRiveFile.addEventListener("change", () => {
    const file = localRiveFile.files?.[0];
    if (file) runLocalFile(file);
  });

  pauseButton.addEventListener("click", () => {
    if (!riveInstance) return;
    paused = !paused;
    if (paused) riveInstance.pause(); else riveInstance.play();
    pauseButton.textContent = paused ? "계속 재생" : "일시정지";
  });

  document.querySelectorAll("[data-soul]").forEach((button) => {
    button.addEventListener("click", () => applySoulPreset(button.dataset.soul));
  });

  resizeObserver = new ResizeObserver(() => {
    try { riveInstance?.resizeDrawingSurfaceToCanvas(); } catch (error) { console.warn(error); }
  });
  resizeObserver.observe(canvas);

  deviceBuild.textContent = `${navigator.platform || "device"} · online ${navigator.onLine ? "yes" : "no"}`;
  window.addEventListener("unhandledrejection", (event) => log(`Unhandled: ${errorText(event.reason)}`));
  window.addEventListener("error", (event) => log(`Window error: ${event.message}`));
  window.addEventListener("beforeunload", () => { resizeObserver?.disconnect(); cleanupRive(); });

  resetSteps();
  runAsset("github");
})();