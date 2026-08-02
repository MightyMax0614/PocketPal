"use strict";

(() => {
  const SAMPLES = {
    skills: {
      label: "공식 skills.riv",
      src: "https://cdn.rive.app/animations/skills.riv",
      machine: "skill-controller",
      fallback: "vehicles"
    },
    vehicles: {
      label: "공식 vehicles.riv",
      src: "https://cdn.rive.app/animations/vehicles.riv",
      machine: "bumpy"
    }
  };

  const canvas = document.querySelector("#riveCanvas");
  const stageMessage = document.querySelector("#stageMessage");
  const healthDot = document.querySelector("#healthDot");
  const healthText = document.querySelector("#healthText");
  const fpsValue = document.querySelector("#fpsValue");
  const soulMessage = document.querySelector("#soulMessage");
  const pauseButton = document.querySelector("#pauseButton");
  const localRiveFile = document.querySelector("#localRiveFile");
  const artboardSelect = document.querySelector("#artboardSelect");
  const machineSelect = document.querySelector("#machineSelect");
  const applyMachine = document.querySelector("#applyMachine");
  const inputInspector = document.querySelector("#inputInspector");
  const bindingBadge = document.querySelector("#bindingBadge");
  const eventLog = document.querySelector("#eventLog");
  const clearLog = document.querySelector("#clearLog");
  const loadSkillsButton = document.querySelector("#loadSkills");
  const loadVehiclesButton = document.querySelector("#loadVehicles");

  let riveInstance = null;
  let currentSource = null;
  let currentMachine = "";
  let currentArtboard = "";
  let currentObjectUrl = null;
  let paused = false;
  let failedSampleFallbackUsed = false;
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
    while (eventLog.children.length > 30) eventLog.lastElementChild?.remove();
  }

  function setHealth(state, text) {
    healthDot.className = `health-dot ${state}`;
    healthText.textContent = text;
  }

  function setStageMessage(title, detail, visible = true) {
    stageMessage.querySelector("strong").textContent = title;
    stageMessage.querySelector("span").textContent = detail;
    stageMessage.classList.toggle("hidden", !visible);
  }

  function selectSampleButton(sampleName) {
    loadSkillsButton.classList.toggle("selected", sampleName === "skills");
    loadVehiclesButton.classList.toggle("selected", sampleName === "vehicles");
  }

  function cleanupRive() {
    if (riveInstance) {
      try { riveInstance.disableFPSCounter?.(); } catch (error) { console.warn(error); }
      try { riveInstance.cleanup(); } catch (error) { console.warn(error); }
      riveInstance = null;
    }
    fpsValue.textContent = "--";
    paused = false;
    pauseButton.textContent = "일시정지";
  }

  function releaseObjectUrl() {
    if (!currentObjectUrl) return;
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  function inputTypeName(type) {
    const types = window.rive?.StateMachineInputType;
    if (type === types?.Number || type === 56) return "Number";
    if (type === types?.Trigger || type === 58) return "Trigger";
    if (type === types?.Boolean || type === 59) return "Boolean";
    return `Type ${type}`;
  }

  function populateArtboards(contents, preferredArtboard = "", preferredMachine = "") {
    const artboards = contents?.artboards || [];
    artboardSelect.innerHTML = "";

    if (!artboards.length) {
      artboardSelect.append(new Option("Artboard 정보 없음", ""));
      artboardSelect.disabled = true;
      machineSelect.innerHTML = "";
      machineSelect.append(new Option("State Machine 정보 없음", ""));
      machineSelect.disabled = true;
      applyMachine.disabled = true;
      return;
    }

    artboards.forEach((artboard) => artboardSelect.append(new Option(artboard.name, artboard.name)));
    artboardSelect.disabled = false;

    const targetArtboard = artboards.some((artboard) => artboard.name === preferredArtboard)
      ? preferredArtboard
      : artboards[0].name;
    artboardSelect.value = targetArtboard;
    populateMachines(contents, targetArtboard, preferredMachine);
  }

  function populateMachines(contents, artboardName, preferredMachine = "") {
    const artboard = contents?.artboards?.find((item) => item.name === artboardName);
    const machines = artboard?.stateMachines || [];
    machineSelect.innerHTML = "";

    if (!machines.length) {
      machineSelect.append(new Option("상태 머신 없음", ""));
      machineSelect.disabled = true;
      applyMachine.disabled = true;
      return;
    }

    machines.forEach((machine) => machineSelect.append(new Option(machine.name, machine.name)));
    machineSelect.disabled = false;
    machineSelect.value = machines.some((machine) => machine.name === preferredMachine)
      ? preferredMachine
      : machines[0].name;
    applyMachine.disabled = false;
  }

  function renderInputInspector(machineName) {
    inputInspector.innerHTML = "";
    const inputs = riveInstance?.stateMachineInputs?.(machineName) || [];

    if (!inputs.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "이 상태 머신에는 직접 조작 가능한 기존 Input이 없어요. 새 PocketPal 파일은 Rive Data Binding으로 설계할 예정입니다.";
      inputInspector.append(empty);
      return;
    }

    inputs.forEach((input) => {
      const row = document.createElement("div");
      row.className = "input-row";

      const meta = document.createElement("div");
      meta.className = "input-meta";
      const name = document.createElement("strong");
      name.textContent = input.name;
      const type = document.createElement("span");
      type.textContent = inputTypeName(input.type);
      meta.append(name, type);
      row.append(meta);

      const typeName = inputTypeName(input.type);
      if (typeName === "Number") {
        const control = document.createElement("div");
        control.className = "number-control";
        const minus = document.createElement("button");
        minus.type = "button";
        minus.textContent = "−";
        const value = document.createElement("input");
        value.type = "number";
        value.step = "1";
        value.value = String(Number(input.value) || 0);
        const plus = document.createElement("button");
        plus.type = "button";
        plus.textContent = "+";

        const commit = (next) => {
          const numeric = Number(next);
          if (!Number.isFinite(numeric)) return;
          input.value = numeric;
          value.value = String(numeric);
          log(`${input.name} = ${numeric}`);
        };

        minus.addEventListener("click", () => commit(Number(value.value) - 1));
        plus.addEventListener("click", () => commit(Number(value.value) + 1));
        value.addEventListener("change", () => commit(value.value));
        control.append(minus, value, plus);
        row.append(control);
      } else if (typeName === "Boolean") {
        const toggle = document.createElement("button");
        toggle.type = "button";
        const updateLabel = () => { toggle.textContent = input.value ? "TRUE" : "FALSE"; };
        updateLabel();
        toggle.addEventListener("click", () => {
          input.value = !input.value;
          updateLabel();
          log(`${input.name} = ${input.value}`);
        });
        row.append(toggle);
      } else if (typeName === "Trigger") {
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.textContent = "FIRE";
        trigger.addEventListener("click", () => {
          input.fire();
          log(`${input.name} trigger`);
        });
        row.append(trigger);
      }

      inputInspector.append(row);
    });
  }

  function updateBindingBadge() {
    if (riveInstance?.viewModelInstance) {
      bindingBadge.textContent = "Data Binding 연결됨";
      bindingBadge.classList.add("bound");
    } else {
      bindingBadge.textContent = "State Machine Inputs";
      bindingBadge.classList.remove("bound");
    }
  }

  function activateMachine(artboardName, machineName) {
    if (!riveInstance || !machineName) return;
    currentArtboard = artboardName || "";
    currentMachine = machineName;

    try {
      riveInstance.reset({
        artboard: currentArtboard || undefined,
        stateMachines: currentMachine,
        autoplay: true,
        autoBind: true
      });
      paused = false;
      pauseButton.textContent = "일시정지";
      window.setTimeout(() => {
        renderInputInspector(currentMachine);
        updateBindingBadge();
      }, 120);
      log(`상태 머신 실행: ${currentMachine}`);
    } catch (error) {
      console.error(error);
      log(`상태 머신 실행 실패: ${error.message || error}`);
    }
  }

  function inspectLoadedFile(preferredArtboard = "", preferredMachine = "") {
    const contents = riveInstance?.contents;
    populateArtboards(contents, preferredArtboard, preferredMachine);

    const selectedArtboard = artboardSelect.value;
    const selectedMachine = machineSelect.value;
    if (selectedMachine) {
      currentArtboard = selectedArtboard;
      currentMachine = selectedMachine;
      if (!preferredMachine || selectedMachine !== preferredMachine) {
        activateMachine(selectedArtboard, selectedMachine);
      } else {
        renderInputInspector(selectedMachine);
        updateBindingBadge();
      }
    } else {
      currentMachine = "";
      renderInputInspector("");
      updateBindingBadge();
    }

    const artboardCount = contents?.artboards?.length || 0;
    const machineCount = (contents?.artboards || []).reduce(
      (sum, artboard) => sum + (artboard.stateMachines?.length || 0),
      0
    );
    log(`파일 분석: Artboard ${artboardCount}개, State Machine ${machineCount}개`);
  }

  function loadRiveAsset({ src, label, machine = "", artboard = "", sampleName = "" }) {
    cleanupRive();
    currentSource = { src, label, machine, artboard, sampleName };
    currentMachine = machine;
    currentArtboard = artboard;
    setHealth("loading", "불러오는 중");
    setStageMessage(label, "Rive 파일과 WebAssembly 런타임을 준비하고 있어요.", true);
    inputInspector.innerHTML = '<p class="empty-state">Rive 파일을 분석하는 중이에요.</p>';
    bindingBadge.textContent = "분석 중";
    bindingBadge.classList.remove("bound");
    if (sampleName) selectSampleButton(sampleName);
    else selectSampleButton("");

    try {
      riveInstance = new window.rive.Rive({
        src,
        canvas,
        autoplay: true,
        autoBind: true,
        artboard: artboard || undefined,
        stateMachines: machine || undefined,
        layout: new window.rive.Layout({
          fit: window.rive.Fit.Contain,
          alignment: window.rive.Alignment.Center
        }),
        onLoad: () => {
          riveInstance.resizeDrawingSurfaceToCanvas();
          setHealth("ready", "실행 중");
          setStageMessage(label, "실제 Rive 파일이 실행 중입니다.", false);
          log(`로드 완료: ${label}`);
          inspectLoadedFile(artboard, machine);
          try {
            riveInstance.enableFPSCounter((fps) => {
              fpsValue.textContent = Number.isFinite(fps) ? String(Math.round(fps)) : "--";
            });
          } catch (error) {
            console.warn("FPS counter unavailable", error);
          }
        },
        onLoadError: (event) => {
          console.error(event);
          setHealth("error", "로드 실패");
          setStageMessage("Rive 파일을 열지 못했어요", "네트워크나 파일 형식을 확인해 주세요.", true);
          log(`로드 실패: ${label}`);

          if (sampleName === "skills" && !failedSampleFallbackUsed) {
            failedSampleFallbackUsed = true;
            log("skills.riv 대신 vehicles.riv로 자동 전환합니다.");
            window.setTimeout(() => loadSample("vehicles"), 500);
          }
        },
        onStateChange: (event) => {
          const states = Array.isArray(event?.data) ? event.data.join(", ") : String(event?.data || "상태 변경");
          log(`State: ${states}`);
        }
      });
    } catch (error) {
      console.error(error);
      setHealth("error", "초기화 실패");
      setStageMessage("Rive 런타임 초기화 실패", error.message || String(error), true);
      log(`초기화 실패: ${error.message || error}`);
    }
  }

  function loadSample(name) {
    const sample = SAMPLES[name];
    if (!sample) return;
    if (name !== "skills") failedSampleFallbackUsed = false;
    releaseObjectUrl();
    localRiveFile.value = "";
    loadRiveAsset({ ...sample, sampleName: name });
  }

  function findInputs() {
    return riveInstance?.stateMachineInputs?.(currentMachine) || [];
  }

  function setNumericByNames(inputs, names, value) {
    let changed = false;
    inputs.forEach((input) => {
      const lower = input.name.toLowerCase();
      if (inputTypeName(input.type) !== "Number") return;
      if (!names.some((name) => lower.includes(name))) return;
      input.value = value;
      changed = true;
      log(`${input.name} = ${value}`);
    });
    return changed;
  }

  function setBooleanByNames(inputs, names, value) {
    let changed = false;
    inputs.forEach((input) => {
      const lower = input.name.toLowerCase();
      if (inputTypeName(input.type) !== "Boolean") return;
      if (!names.some((name) => lower.includes(name))) return;
      input.value = value;
      changed = true;
      log(`${input.name} = ${value}`);
    });
    return changed;
  }

  function fireByNames(inputs, names) {
    let changed = false;
    inputs.forEach((input) => {
      const lower = input.name.toLowerCase();
      if (inputTypeName(input.type) !== "Trigger") return;
      if (!names.some((name) => lower.includes(name))) return;
      input.fire();
      changed = true;
      log(`${input.name} trigger`);
    });
    return changed;
  }

  function applySoulPreset(preset) {
    if (!riveInstance || !currentMachine) {
      soulMessage.textContent = "먼저 State Machine이 있는 Rive 파일을 불러와 주세요.";
      return;
    }

    const inputs = findInputs();
    let matched = false;

    setBooleanByNames(inputs, ["talk", "speak"], false);
    setBooleanByNames(inputs, ["sleep", "drowsy"], false);
    setBooleanByNames(inputs, ["happy", "joy"], false);

    if (preset === "calm") {
      matched = setNumericByNames(inputs, ["level", "mood", "emotion", "state"], 0) || matched;
      matched = setBooleanByNames(inputs, ["calm", "idle"], true) || matched;
    }
    if (preset === "curious") {
      matched = setNumericByNames(inputs, ["level", "mood", "emotion", "state"], 1) || matched;
      matched = fireByNames(inputs, ["curious", "look", "notice"]) || matched;
    }
    if (preset === "happy") {
      matched = setNumericByNames(inputs, ["level", "mood", "emotion", "state"], 2) || matched;
      matched = setBooleanByNames(inputs, ["happy", "joy"], true) || matched;
      matched = fireByNames(inputs, ["happy", "celebrate", "jump"]) || matched;
    }
    if (preset === "talking") {
      matched = setBooleanByNames(inputs, ["talk", "speak"], true) || matched;
      matched = fireByNames(inputs, ["talk", "speak"]) || matched;
      window.setTimeout(() => {
        setBooleanByNames(findInputs(), ["talk", "speak"], false);
      }, 1800);
    }
    if (preset === "sleepy") {
      matched = setBooleanByNames(inputs, ["sleep", "drowsy"], true) || matched;
      matched = setNumericByNames(inputs, ["energy"], 15) || matched;
      matched = fireByNames(inputs, ["sleep", "yawn"]) || matched;
    }
    if (preset === "pet") {
      matched = fireByNames(inputs, ["pet", "touch", "press", "tap", "wave"]) || matched;
      if (!matched) matched = setNumericByNames(inputs, ["level", "mood"], 2) || matched;
    }

    if (matched) {
      soulMessage.textContent = `소울 명령 ‘${preset}’을 현재 Rive 입력에 전달했어요.`;
      log(`Soul preset: ${preset}`);
      window.setTimeout(() => renderInputInspector(currentMachine), 80);
    } else {
      soulMessage.textContent = "현재 샘플에 같은 이름의 입력이 없어요. 아래 입력값 검사에서 직접 조작할 수 있어요.";
      log(`Soul preset 미매칭: ${preset}`);
    }
  }

  artboardSelect.addEventListener("change", () => {
    populateMachines(riveInstance?.contents, artboardSelect.value, "");
  });

  applyMachine.addEventListener("click", () => {
    activateMachine(artboardSelect.value, machineSelect.value);
  });

  loadSkillsButton.addEventListener("click", () => loadSample("skills"));
  loadVehiclesButton.addEventListener("click", () => loadSample("vehicles"));

  localRiveFile.addEventListener("change", () => {
    const file = localRiveFile.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".riv")) {
      setHealth("error", "형식 오류");
      setStageMessage(".riv 파일이 아니에요", "Rive Editor에서 내보낸 .riv 파일을 선택해 주세요.", true);
      return;
    }

    releaseObjectUrl();
    currentObjectUrl = URL.createObjectURL(file);
    failedSampleFallbackUsed = true;
    loadRiveAsset({ src: currentObjectUrl, label: file.name });
  });

  pauseButton.addEventListener("click", () => {
    if (!riveInstance) return;
    paused = !paused;
    if (paused) riveInstance.pause();
    else riveInstance.play();
    pauseButton.textContent = paused ? "계속 재생" : "일시정지";
    log(paused ? "재생 일시정지" : "재생 재개");
  });

  document.querySelectorAll("[data-soul]").forEach((button) => {
    button.addEventListener("click", () => applySoulPreset(button.dataset.soul));
  });

  clearLog.addEventListener("click", () => { eventLog.innerHTML = ""; });

  function waitForRiveRuntime(attempt = 0) {
    if (window.rive?.Rive) {
      log("Rive WebGL2 런타임 준비 완료");
      loadSample("skills");
      return;
    }

    if (attempt > 80) {
      setHealth("error", "런타임 실패");
      setStageMessage("Rive 런타임을 받지 못했어요", "인터넷 연결 후 페이지를 다시 열어 주세요.", true);
      log("Rive CDN 로드 시간 초과");
      return;
    }
    window.setTimeout(() => waitForRiveRuntime(attempt + 1), 100);
  }

  resizeObserver = new ResizeObserver(() => {
    try { riveInstance?.resizeDrawingSurfaceToCanvas(); } catch (error) { console.warn(error); }
  });
  resizeObserver.observe(canvas);

  window.addEventListener("beforeunload", () => {
    resizeObserver?.disconnect();
    cleanupRive();
    releaseObjectUrl();
  });

  waitForRiveRuntime();
})();
