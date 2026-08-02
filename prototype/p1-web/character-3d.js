"use strict";

(() => {
  const DB_NAME = "pocketpal-assets";
  const DB_STORE = "assets";
  const DB_KEYS = {
    front: "character-3d-front-v2",
    side: "character-3d-side-v2",
    back: "character-3d-back-v2",
    model: "character-3d-model-glb-v2"
  };
  const STATE_KEY = "pocketpal.character3d.state.v2";
  const JOB_KEY = "pocketpal.character3d.job.v2";

  const elements = {
    frontInput: document.querySelector("#character3dFrontInput"),
    sideInput: document.querySelector("#character3dSideInput"),
    backInput: document.querySelector("#character3dBackInput"),
    frontPreview: document.querySelector("#character3dFrontPreview"),
    sidePreview: document.querySelector("#character3dSidePreview"),
    backPreview: document.querySelector("#character3dBackPreview"),
    useCurrent: document.querySelector("#character3dUseCurrent"),
    name: document.querySelector("#character3dName"),
    description: document.querySelector("#character3dDescription"),
    color: document.querySelector("#character3dColor"),
    personality: document.querySelector("#character3dPersonality"),
    tail: document.querySelector("#character3dTail"),
    wings: document.querySelector("#character3dWings"),
    buildJob: document.querySelector("#character3dBuildJob"),
    prepResult: document.querySelector("#character3dPrepResult"),
    statusCard: document.querySelector("#character3dStatusCard"),
    statusTitle: document.querySelector("#character3dStatusTitle"),
    statusDetail: document.querySelector("#character3dStatusDetail"),
    statusName: document.querySelector("#character3dStatusName"),
    statusViews: document.querySelector("#character3dStatusViews"),
    statusJobId: document.querySelector("#character3dStatusJobId"),
    statusModel: document.querySelector("#character3dStatusModel"),
    downloadJob: document.querySelector("#character3dDownloadJob"),
    downloadInputs: document.querySelector("#character3dDownloadInputs"),
    modelInput: document.querySelector("#character3dModelInput"),
    modelName: document.querySelector("#character3dModelName"),
    openViewer: document.querySelector("#character3dOpenViewer"),
    clearModel: document.querySelector("#character3dClearModel"),
    resultMessage: document.querySelector("#character3dResultMessage")
  };

  if (!elements.frontInput || !elements.buildJob) return;

  const defaultState = {
    name: "",
    description: "",
    mainColor: "",
    personality: "",
    hasTail: false,
    hasWings: false,
    hasFront: false,
    hasSide: false,
    hasBack: false,
    status: "none",
    jobId: "",
    requestedAt: "",
    modelName: "",
    modelSize: 0,
    modelStoredAt: ""
  };

  let state = loadState();
  let currentJob = loadJob();

  function loadState() {
    try {
      return { ...defaultState, ...JSON.parse(localStorage.getItem(STATE_KEY) || "{}") };
    } catch (error) {
      console.warn(error);
      return { ...defaultState };
    }
  }

  function loadJob() {
    try {
      return JSON.parse(localStorage.getItem(JOB_KEY) || "null");
    } catch (error) {
      console.warn(error);
      return null;
    }
  }

  function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  function saveJob(job) {
    currentJob = job;
    localStorage.setItem(JOB_KEY, JSON.stringify(job));
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("이 브라우저는 IndexedDB를 지원하지 않습니다."));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DB_STORE)) database.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("저장소를 열지 못했습니다."));
    });
  }

  async function dbSet(key, value) {
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, "readwrite");
      transaction.objectStore(DB_STORE).put(value, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("저장하지 못했습니다."));
    });
    database.close();
  }

  async function dbGet(key) {
    const database = await openDatabase();
    const value = await new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, "readonly");
      const request = transaction.objectStore(DB_STORE).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error || new Error("저장값을 읽지 못했습니다."));
    });
    database.close();
    return value;
  }

  async function dbDelete(key) {
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, "readwrite");
      transaction.objectStore(DB_STORE).delete(key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("삭제하지 못했습니다."));
    });
    database.close();
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error("이미지를 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("이미지 형식을 읽지 못했습니다."));
      image.src = source;
    });
  }

  async function resizeImage(file) {
    const source = await fileToDataUrl(file);
    const image = await loadImage(source);
    const maxSide = 720;
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return source;
    context.drawImage(image, 0, 0, width, height);
    const webp = canvas.toDataURL("image/webp", 0.86);
    return webp && webp !== "data:," ? webp : canvas.toDataURL("image/png");
  }

  function previewFor(kind) {
    return elements[`${kind}Preview`];
  }

  function setPreview(kind, dataUrl) {
    const preview = previewFor(kind);
    if (!preview) return;
    preview.src = dataUrl;
    preview.hidden = false;
    preview.closest(".turnaround-card")?.classList.add("has-image");
  }

  function clearPreview(kind) {
    const preview = previewFor(kind);
    if (!preview) return;
    preview.removeAttribute("src");
    preview.hidden = true;
    preview.closest(".turnaround-card")?.classList.remove("has-image");
  }

  async function setViewImage(kind, dataUrl) {
    await dbSet(DB_KEYS[kind], dataUrl);
    state[`has${kind[0].toUpperCase()}${kind.slice(1)}`] = true;
    saveState();
    setPreview(kind, dataUrl);
    updateUi();
  }

  async function bindImageInput(input, kind) {
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      elements.prepResult.textContent = `${kind === "front" ? "정면" : kind === "side" ? "측면" : "뒷면"} 이미지를 정리하는 중이에요…`;
      try {
        const dataUrl = await resizeImage(file);
        await setViewImage(kind, dataUrl);
        elements.prepResult.textContent = "입력 이미지를 저장했어요. 정면이 준비되면 작업 요청을 만들 수 있어요.";
      } catch (error) {
        console.error(error);
        elements.prepResult.textContent = error.message || "이미지를 저장하지 못했어요.";
      }
    });
  }

  function collectForm() {
    state.name = elements.name.value.trim().slice(0, 20);
    state.description = elements.description.value.trim();
    state.mainColor = elements.color.value.trim();
    state.personality = elements.personality.value.trim();
    state.hasTail = elements.tail.checked;
    state.hasWings = elements.wings.checked;
    saveState();
  }

  function makeJobId() {
    const now = new Date();
    const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
    const time = [String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0"), String(now.getSeconds()).padStart(2, "0")].join("");
    return `char3d_${date}_${time}`;
  }

  function personalityList() {
    return state.personality.split(/[,，]/).map((value) => value.trim()).filter(Boolean);
  }

  function buildJob() {
    const jobId = makeJobId();
    return {
      schema_version: "2.0",
      job_id: jobId,
      character_name: state.name || "나의 친구",
      requested_at: new Date().toISOString(),
      status: "queued",
      target: "pocketpal_character_3d",
      inputs: {
        front_image: "front.png",
        side_image: state.hasSide ? "side.png" : null,
        back_image: state.hasBack ? "back.png" : null,
        source_type: "drawing_or_photo"
      },
      metadata: {
        description: state.description,
        main_color: state.mainColor,
        personality: personalityList(),
        has_tail: state.hasTail,
        has_wings: state.hasWings,
        missing_views: [!state.hasSide ? "side" : null, !state.hasBack ? "back" : null].filter(Boolean)
      },
      options: {
        remove_background: true,
        estimate_missing_views: true,
        generate_full_360_mesh: true,
        generate_glb: true,
        generate_preview_images: true,
        rigging: false,
        attachment_points: ["head", "face", "chest", "back", "left_hand", "right_hand"]
      },
      output_contract: {
        model_file: "character.glb",
        manifest_file: "character_manifest.json",
        previews: ["preview_front.png", "preview_side.png", "preview_back.png"]
      }
    };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function dataUrlToBlob(dataUrl) {
    const [header, payload] = dataUrl.split(",");
    const mime = header.match(/data:([^;]+)/)?.[1] || "image/png";
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mime });
  }

  async function downloadInputs() {
    const entries = [
      ["front", "front.png"],
      ["side", "side.png"],
      ["back", "back.png"]
    ];
    for (const [kind, filename] of entries) {
      const dataUrl = await dbGet(DB_KEYS[kind]);
      if (!dataUrl) continue;
      downloadBlob(dataUrlToBlob(dataUrl), filename);
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
  }

  function statusCopy() {
    const copies = {
      none: ["아직 요청 전", "3D 준비 화면에서 정면 이미지를 등록해 주세요."],
      queued: ["작업 요청 준비 완료", "job_v2.json과 입력 그림을 PC·NAS 작업기에 전달할 수 있어요."],
      processing: ["실제 3D 생성 중", "PC·NAS 작업기가 360도 메시를 만드는 중이에요."],
      done: ["실제 3D 결과 준비 완료", "저장된 GLB를 360도 뷰어에서 확인할 수 있어요."],
      failed: ["3D 생성 실패", "작업 로그를 확인한 뒤 다시 요청해 주세요."]
    };
    return copies[state.status] || copies.none;
  }

  function updateUi() {
    elements.name.value = state.name;
    elements.description.value = state.description;
    elements.color.value = state.mainColor;
    elements.personality.value = state.personality;
    elements.tail.checked = state.hasTail;
    elements.wings.checked = state.hasWings;

    const [title, detail] = statusCopy();
    elements.statusTitle.textContent = title;
    elements.statusDetail.textContent = detail;
    elements.statusCard.dataset.status = state.status;
    elements.statusName.textContent = state.name || "-";
    elements.statusViews.textContent = [state.hasFront ? "정면" : null, state.hasSide ? "측면" : null, state.hasBack ? "뒷면" : null].filter(Boolean).join(" · ") || "-";
    elements.statusJobId.textContent = state.jobId || "-";
    elements.statusModel.textContent = state.modelName || "없음";
    elements.downloadJob.disabled = !currentJob;
    elements.downloadInputs.disabled = !state.hasFront;

    const hasModel = Boolean(state.modelName);
    elements.modelName.textContent = hasModel
      ? `${state.modelName} · ${(state.modelSize / 1024 / 1024).toFixed(1)} MB`
      : "저장된 GLB 없음";
    elements.openViewer.disabled = !hasModel;
    elements.clearModel.disabled = !hasModel;
    elements.buildJob.disabled = !state.hasFront;
  }

  async function restorePreviews() {
    for (const kind of ["front", "side", "back"]) {
      try {
        const dataUrl = await dbGet(DB_KEYS[kind]);
        if (dataUrl) setPreview(kind, dataUrl);
        else clearPreview(kind);
      } catch (error) {
        console.warn(error);
      }
    }
  }

  elements.useCurrent.addEventListener("click", async () => {
    const character = await window.PocketPalCharacter?.getCurrent?.();
    if (!character?.imageData) {
      elements.prepResult.textContent = "먼저 ‘그림·사진 적용’에서 캐릭터를 등록해 주세요.";
      return;
    }
    await setViewImage("front", character.imageData);
    if (!state.name) state.name = character.name || "나의 친구";
    saveState();
    updateUi();
    elements.prepResult.textContent = "현재 2D 캐릭터를 정면 입력으로 사용했어요.";
  });

  elements.buildJob.addEventListener("click", () => {
    collectForm();
    if (!state.hasFront) {
      elements.prepResult.textContent = "정면 이미지는 꼭 필요해요.";
      return;
    }
    const job = buildJob();
    saveJob(job);
    state.status = "queued";
    state.jobId = job.job_id;
    state.requestedAt = job.requested_at;
    saveState();
    updateUi();
    elements.prepResult.textContent = "실제 360도 3D 작업 요청을 만들었어요. 상태 화면에서 파일을 저장할 수 있어요.";
    window.say?.("3D 캐릭터를 만들 준비가 됐어!", true);
  });

  elements.downloadJob.addEventListener("click", () => {
    if (!currentJob) return;
    downloadBlob(
      new Blob([JSON.stringify(currentJob, null, 2)], { type: "application/json;charset=utf-8" }),
      `${currentJob.job_id}.job_v2.json`
    );
  });

  elements.downloadInputs.addEventListener("click", () => {
    downloadInputs().catch((error) => {
      console.error(error);
      elements.statusDetail.textContent = "입력 그림을 저장하지 못했어요.";
    });
  });

  elements.modelInput.addEventListener("change", async () => {
    const file = elements.modelInput.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      elements.resultMessage.textContent = "한 파일에 텍스처가 포함된 GLB 형식만 선택해 주세요.";
      elements.modelInput.value = "";
      return;
    }
    elements.resultMessage.textContent = "실제 3D 결과를 기기에 저장하는 중이에요…";
    try {
      await dbSet(DB_KEYS.model, file);
      state.modelName = file.name;
      state.modelSize = file.size;
      state.modelStoredAt = new Date().toISOString();
      state.status = "done";
      saveState();
      if (currentJob) {
        currentJob = {
          ...currentJob,
          status: "done",
          result: { model_file: file.name, origin: "local_glb", stored_at: state.modelStoredAt }
        };
        saveJob(currentJob);
      }
      updateUi();
      elements.resultMessage.textContent = "실제 GLB 결과를 저장했어요. 이제 360도로 확인할 수 있어요.";
    } catch (error) {
      console.error(error);
      elements.resultMessage.textContent = "GLB를 저장하지 못했어요. 파일 크기와 Safari 저장 공간을 확인해 주세요.";
    }
  });

  elements.openViewer.addEventListener("click", () => {
    if (!state.modelName) return;
    window.location.href = "viewer-3d.html?source=stored";
  });

  elements.clearModel.addEventListener("click", async () => {
    await dbDelete(DB_KEYS.model);
    state.modelName = "";
    state.modelSize = 0;
    state.modelStoredAt = "";
    state.status = currentJob ? "queued" : "none";
    saveState();
    updateUi();
    elements.modelInput.value = "";
    elements.resultMessage.textContent = "저장된 실제 3D 결과를 삭제했어요.";
  });

  [elements.name, elements.description, elements.color, elements.personality].forEach((element) => {
    element.addEventListener("input", collectForm);
  });
  [elements.tail, elements.wings].forEach((element) => {
    element.addEventListener("change", collectForm);
  });

  bindImageInput(elements.frontInput, "front");
  bindImageInput(elements.sideInput, "side");
  bindImageInput(elements.backInput, "back");

  window.addEventListener("pocketpal:view-changed", (event) => {
    if (["character-3d-prep", "character-3d-status", "character-3d-result"].includes(event.detail?.view)) {
      state = loadState();
      currentJob = loadJob();
      updateUi();
    }
  });

  window.PocketPal3D = {
    getState: () => ({ ...state }),
    getJob: () => currentJob,
    setStatus(status, details = {}) {
      state = { ...state, ...details, status };
      saveState();
      if (currentJob) saveJob({ ...currentJob, status, updated_at: new Date().toISOString() });
      updateUi();
    }
  };

  restorePreviews().finally(updateUi);
})();
