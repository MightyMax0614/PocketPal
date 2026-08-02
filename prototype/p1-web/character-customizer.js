"use strict";

(() => {
  const STORAGE_IMAGE = "pocketpal.character.image.v1";
  const STORAGE_NAME = "pocketpal.character.name.v1";

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

  function announce(message) {
    if (typeof window.say === "function") {
      window.say(message, true);
    }
  }

  function applyCharacter(imageData, name, persist = true) {
    if (!imageData) return;

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

    if (persist) {
      try {
        localStorage.setItem(STORAGE_IMAGE, imageData);
        localStorage.setItem(STORAGE_NAME, safeName);
      } catch (error) {
        console.error(error);
        if (result) {
          result.textContent = "사진이 너무 커서 저장하지 못했어요. 더 작은 이미지로 다시 시도해 주세요.";
        }
        return;
      }
    }

    if (result) result.textContent = `${safeName}이(가) PocketPal 캐릭터가 되었어요.`;
  }

  function resetCharacter() {
    localStorage.removeItem(STORAGE_IMAGE);
    localStorage.removeItem(STORAGE_NAME);
    pendingImageData = null;

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
    if (fileInput) fileInput.value = "";
    applyButton.disabled = true;
    if (result) result.textContent = "기본 캐릭터로 돌아왔어요.";
    announce("기본 모습으로 돌아왔어!");
  }

  function loadImageElement(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
      image.src = url;
    });
  }

  async function makeStorageImage(file) {
    const objectUrl = URL.createObjectURL(file);

    try {
      const image = await loadImageElement(objectUrl);
      const maxSide = 720;
      const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * ratio));
      const height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("이미지 처리 기능을 사용할 수 없습니다.");

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      let dataUrl = canvas.toDataURL("image/webp", 0.86);
      if (!dataUrl.startsWith("data:image/webp")) {
        dataUrl = canvas.toDataURL("image/jpeg", 0.84);
      }

      // Safari localStorage 용량을 넘지 않도록 한 번 더 축소한다.
      if (dataUrl.length > 3_200_000) {
        const smallerRatio = Math.min(1, 480 / Math.max(width, height));
        const smallCanvas = document.createElement("canvas");
        smallCanvas.width = Math.max(1, Math.round(width * smallerRatio));
        smallCanvas.height = Math.max(1, Math.round(height * smallerRatio));
        const smallContext = smallCanvas.getContext("2d", { alpha: true });
        smallContext.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
        dataUrl = smallCanvas.toDataURL("image/webp", 0.76);
      }

      return dataUrl;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      if (result) result.textContent = "그림이나 사진 파일을 선택해 주세요.";
      return;
    }

    if (result) result.textContent = "그림을 PocketPal 화면에 맞게 준비하는 중이에요…";
    applyButton.disabled = true;

    try {
      pendingImageData = await makeStorageImage(file);
      preview.src = pendingImageData;
      preview.hidden = false;
      if (previewFrame) previewFrame.hidden = false;
      applyButton.disabled = false;

      const suggestedName = file.name.replace(/\.[^.]+$/, "").slice(0, 20);
      if (nameInput && !nameInput.value.trim()) nameInput.value = suggestedName;
      if (result) result.textContent = "이 그림을 캐릭터로 사용할 수 있어요. 이름을 정하고 적용해 주세요.";
    } catch (error) {
      console.error(error);
      pendingImageData = null;
      if (result) result.textContent = "이미지를 읽지 못했어요. 다른 사진이나 그림으로 다시 시도해 주세요.";
    }
  });

  applyButton.addEventListener("click", () => {
    if (!pendingImageData) {
      if (result) result.textContent = "먼저 그림이나 사진을 선택해 주세요.";
      return;
    }

    const name = nameInput?.value || "나의 친구";
    applyCharacter(pendingImageData, name, true);
    announce(`안녕! 나는 ${name.trim() || "나의 친구"}야. 우리 오래오래 같이 놀자!`);

    if (typeof window.showView === "function") {
      window.setTimeout(() => window.showView("home"), 350);
    }
  });

  resetButton?.addEventListener("click", resetCharacter);

  const savedImage = localStorage.getItem(STORAGE_IMAGE);
  const savedName = localStorage.getItem(STORAGE_NAME) || "나의 친구";
  if (savedImage) {
    pendingImageData = savedImage;
    applyCharacter(savedImage, savedName, false);
    preview.src = savedImage;
    preview.hidden = false;
    if (previewFrame) previewFrame.hidden = false;
    applyButton.disabled = false;
  }
})();
