"use strict";

(() => {
  const STORAGE_NAME = "pocketpal.character.name.v2";
  const STORAGE_IMAGE_FALLBACK = "pocketpal.character.image.v2";
  const DB_NAME = "pocketpal-assets";
  const DB_STORE = "assets";
  const DB_KEY = "character-image";

  const character = document.querySelector("#character");
  const characterImage = document.querySelector("#customCharacterImage");
  const characterNameBadge = document.querySelector("#characterNameBadge");
  const fileInput = document.querySelector("#characterImageInput");
  const nameInput = document.querySelector("#characterNameInput");
  const preview = document.querySelector("#characterPreview");
  const previewFrame = document.querySelector("#characterPreviewFrame");
  const applyButton = document.querySelector("#characterApply");
  const resetButton = document.querySelector("#characterReset");
  const result = document.querySelector("#characterResult");

  if (!character || !characterImage || !fileInput || !applyButton) return;

  let pendingImageData = null;
  let pendingName = "";

  function announce(message) {
    if (typeof window.say === "function") window.say(message, true);
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }

      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("DB open failed"));
    });
  }

  async function dbSet(value) {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(value, DB_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("DB write failed"));
    });
    db.close();
  }

  async function dbGet() {
    const db = await openDatabase();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const request = tx.objectStore(DB_STORE).get(DB_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("DB read failed"));
    });
    db.close();
    return value;
  }

  async function dbDelete() {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(DB_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("DB delete failed"));
    });
    db.close();
  }

  function displayCharacter(imageData, name) {
    const safeName = (name || "나의 친구").trim().slice(0, 20) || "나의 친구";

    characterImage.src = imageData;
    characterImage.hidden = false;
    character.classList.add("has-custom");
    character.setAttribute("aria-label", `${safeName} 캐릭터`);

    if (characterNameBadge) {
      characterNameBadge.textContent = safeName;
      characterNameBadge.hidden = false;
    }

    if (nameInput) nameInput.value = safeName;
    return safeName;
  }

  async function persistCharacter(imageData, name) {
    localStorage.setItem(STORAGE_NAME, name);

    try {
      await dbSet(imageData);
      localStorage.removeItem(STORAGE_IMAGE_FALLBACK);
      return;
    } catch (error) {
      console.warn("IndexedDB 저장 실패, localStorage로 대체합니다.", error);
    }

    try {
      localStorage.setItem(STORAGE_IMAGE_FALLBACK, imageData);
    } catch (error) {
      console.error(error);
      throw new Error("이미지를 저장할 공간이 부족합니다.");
    }
  }

  async function applyCharacter(imageData, name, persist = true) {
    if (!imageData) return false;

    const safeName = displayCharacter(imageData, name);

    if (persist) {
      try {
        await persistCharacter(imageData, safeName);
      } catch (error) {
        if (result) result.textContent = "화면에는 적용됐지만 Safari 저장 공간이 부족해 재접속 후에는 사라질 수 있어요.";
        return true;
      }
    }

    if (result) result.textContent = `${safeName}이(가) 2D PocketPal 캐릭터로 적용됐어요. 3D 변환은 다음 단계에서 연결합니다.`;
    return true;
  }

  async function resetCharacter() {
    localStorage.removeItem(STORAGE_NAME);
    localStorage.removeItem(STORAGE_IMAGE_FALLBACK);
    try { await dbDelete(); } catch (error) { console.warn(error); }

    pendingImageData = null;
    pendingName = "";
    characterImage.removeAttribute("src");
    characterImage.hidden = true;
    character.classList.remove("has-custom");
    character.setAttribute("aria-label", "PocketPal 기본 캐릭터");

    if (characterNameBadge) {
      characterNameBadge.textContent = "";
      characterNameBadge.hidden = true;
    }
    if (preview) {
      preview.removeAttribute("src");
      preview.hidden = true;
    }
    if (previewFrame) previewFrame.hidden = true;
    if (nameInput) nameInput.value = "";
    fileInput.value = "";
    applyButton.disabled = true;
    if (result) result.textContent = "기본 캐릭터로 돌아왔어요.";
    announce("기본 모습으로 돌아왔어!");
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error("파일을 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });
  }

  function loadImageElement(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("이미지를 표시할 수 없습니다."));
      image.src = source;
    });
  }

  async function makeStorageImage(file) {
    const rawDataUrl = await readFileAsDataUrl(file);
    let image;

    try {
      image = await loadImageElement(rawDataUrl);
    } catch (error) {
      throw new Error("이 사진 형식은 Safari에서 변환할 수 없습니다. 사진 앱에서 스크린샷을 찍어 다시 선택해 주세요.");
    }

    const maxSide = 480;
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const ratio = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * ratio));
    const height = Math.max(1, Math.round(sourceHeight * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return rawDataUrl;

    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    let dataUrl = canvas.toDataURL("image/webp", 0.76);
    if (!dataUrl || dataUrl === "data:," || !dataUrl.startsWith("data:image/")) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.74);
    }

    return dataUrl || rawDataUrl;
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (result) result.textContent = "사진을 읽고 작게 변환하는 중이에요…";
    applyButton.disabled = true;

    try {
      pendingImageData = await makeStorageImage(file);
      pendingName = (nameInput?.value.trim() || file.name.replace(/\.[^.]+$/, "").slice(0, 20) || "나의 친구");

      if (preview) {
        preview.src = pendingImageData;
        preview.hidden = false;
      }
      if (previewFrame) previewFrame.hidden = false;
      if (nameInput && !nameInput.value.trim()) nameInput.value = pendingName;
      applyButton.disabled = false;

      // 아이폰에서는 선택 후 별도 버튼을 놓치기 쉬워 즉시 캐릭터로 적용한다.
      await applyCharacter(pendingImageData, pendingName, true);
      if (result) result.textContent = "사진이 2D 캐릭터로 바로 적용됐어요. 이름을 바꾼 뒤 ‘다시 적용’을 누를 수도 있어요.";
    } catch (error) {
      console.error(error);
      pendingImageData = null;
      if (result) result.textContent = error.message || "이미지를 읽지 못했어요. 다른 사진이나 그림으로 다시 시도해 주세요.";
    }
  });

  applyButton.addEventListener("click", async () => {
    if (!pendingImageData) {
      if (result) result.textContent = "먼저 그림이나 사진을 선택해 주세요.";
      return;
    }

    const name = nameInput?.value || pendingName || "나의 친구";
    await applyCharacter(pendingImageData, name, true);
    announce(`안녕! 나는 ${name.trim() || "나의 친구"}야. 우리 오래오래 같이 놀자!`);

    if (typeof window.showView === "function") {
      window.setTimeout(() => window.showView("home"), 250);
    }
  });

  resetButton?.addEventListener("click", resetCharacter);

  async function restoreSavedCharacter() {
    const savedName = localStorage.getItem(STORAGE_NAME) || "나의 친구";
    let savedImage = null;

    try { savedImage = await dbGet(); } catch (error) { console.warn(error); }
    if (!savedImage) savedImage = localStorage.getItem(STORAGE_IMAGE_FALLBACK);
    if (!savedImage) return;

    pendingImageData = savedImage;
    pendingName = savedName;
    displayCharacter(savedImage, savedName);

    if (preview) {
      preview.src = savedImage;
      preview.hidden = false;
    }
    if (previewFrame) previewFrame.hidden = false;
    applyButton.disabled = false;
    if (result) result.textContent = `${savedName} 캐릭터를 불러왔어요.`;
  }

  restoreSavedCharacter();
})();
