"use strict";

(() => {
  const JOB_STORAGE_KEY = "pocketpal.3d.job.v1";

  const createButton = document.querySelector("#character3dCreate");
  const previewButton = document.querySelector("#character3dPreview");
  const jobDownloadButton = document.querySelector("#characterJobDownload");
  const sourceDownloadButton = document.querySelector("#characterSourceDownload");
  const statusCard = document.querySelector("#character3dCard");
  const status2d = document.querySelector("#character2dStatus");
  const status3d = document.querySelector("#character3dStatus");

  if (!createButton || !previewButton || !statusCard || !status2d || !status3d) return;

  let currentJob = loadJob();

  function loadJob() {
    try {
      return JSON.parse(localStorage.getItem(JOB_STORAGE_KEY) || "null");
    } catch (error) {
      console.warn("3D 작업 정보를 읽지 못했습니다.", error);
      return null;
    }
  }

  function saveJob(job) {
    currentJob = job;
    localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(job));
  }

  function statusMessage(status) {
    const messages = {
      none: "아직 3D를 만들지 않았어요",
      queued: "3D 변환 요청이 준비됐어요 · NAS/PC 작업기 연결 대기",
      processing: "3D 캐릭터를 만드는 중이에요",
      done: "3D 생성 완료",
      failed: "3D 생성에 실패했어요"
    };
    return messages[status] || messages.none;
  }

  async function getCharacter() {
    if (!window.PocketPalCharacter?.getCurrent) return null;
    return window.PocketPalCharacter.getCurrent();
  }

  function makeJobId() {
    const now = new Date();
    const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
    const time = [String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0"), String(now.getSeconds()).padStart(2, "0")].join("");
    return `char_${date}_${time}`;
  }

  function makeJob(character) {
    return {
      schema_version: "1.0",
      job_id: makeJobId(),
      character_name: character.name || "나의 친구",
      source_type: "drawing_or_photo",
      source_image: "source.png",
      requested_at: new Date().toISOString(),
      status: "queued",
      target: "pocketpal_character",
      output_contract: {
        preferred: "procedural_threejs_module",
        accepted: ["procedural_threejs_module", "glb", "gltf"],
        viewer_entry: "viewer-3d.html"
      },
      options: {
        style: "cute",
        preserve_silhouette: true,
        remove_background: true,
        create_preview: true,
        expose_attachment_points: ["head", "face", "chest", "back", "left_hand", "right_hand"],
        rigging: false
      }
    };
  }

  function dataUrlToBlob(dataUrl) {
    const [header, payload] = dataUrl.split(",");
    const mime = header.match(/data:([^;]+)/)?.[1] || "image/png";
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mime });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function updateUi() {
    const character = await getCharacter();
    const hasCharacter = Boolean(character?.imageData);
    const status = currentJob?.status || "none";

    status2d.textContent = hasCharacter
      ? `현재 상태: ${character.name || "나의 친구"} 2D 캐릭터 적용됨`
      : "현재 상태: 기본 캐릭터 사용 중";
    status3d.textContent = `3D 상태: ${statusMessage(status)}`;
    statusCard.dataset.status = status;

    createButton.disabled = !hasCharacter;
    previewButton.disabled = !hasCharacter;
    jobDownloadButton.disabled = !currentJob;
    sourceDownloadButton.disabled = !hasCharacter;

    createButton.textContent = currentJob ? "3D 다시 요청" : "3D 만들기";
  }

  createButton.addEventListener("click", async () => {
    const character = await getCharacter();
    if (!character?.imageData) {
      status3d.textContent = "3D 상태: 먼저 그림이나 사진을 캐릭터로 적용해 주세요";
      return;
    }

    const job = makeJob(character);
    saveJob(job);
    await updateUi();

    if (typeof window.say === "function") {
      window.say("3D 캐릭터를 만들 준비를 했어! 컴퓨터 작업기와 연결하면 변환을 시작할 수 있어.", true);
    }
  });

  previewButton.addEventListener("click", () => {
    window.location.href = "viewer-3d.html";
  });

  jobDownloadButton.addEventListener("click", () => {
    if (!currentJob) return;
    const text = JSON.stringify(currentJob, null, 2);
    downloadBlob(new Blob([text], { type: "application/json;charset=utf-8" }), `${currentJob.job_id}.job.json`);
  });

  sourceDownloadButton.addEventListener("click", async () => {
    const character = await getCharacter();
    if (!character?.imageData) return;
    downloadBlob(dataUrlToBlob(character.imageData), `${currentJob?.job_id || "pocketpal-character"}.source.png`);
  });

  window.addEventListener("pocketpal:character-changed", async () => {
    currentJob = null;
    localStorage.removeItem(JOB_STORAGE_KEY);
    await updateUi();
  });

  window.addEventListener("storage", () => {
    currentJob = loadJob();
    updateUi();
  });

  window.PocketPalJobs = {
    getCurrentJob: () => currentJob,
    setStatus(status, extra = {}) {
      if (!currentJob) return;
      saveJob({ ...currentJob, ...extra, status, updated_at: new Date().toISOString() });
      updateUi();
    }
  };

  updateUi();
})();
