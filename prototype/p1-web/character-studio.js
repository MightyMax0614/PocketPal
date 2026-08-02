"use strict";

(() => {
  const soul = window.PocketPalSoul;
  if (!soul) return;

  const studioResult = document.querySelector("#palStudioResult");
  const nameInput = document.querySelector("#palNameInput");
  const studioApply = document.querySelector("#palStudioApply");
  const studioReset = document.querySelector("#palStudioReset");
  const motionResult = document.querySelector("#motionResult");
  const personalityResult = document.querySelector("#palPersonalityResult");
  const personalityApply = document.querySelector("#palPersonalityApply");
  const childNameInput = document.querySelector("#palChildNameInput");
  const favoriteTopicInput = document.querySelector("#palFavoriteTopicInput");

  const giftImage = document.querySelector("#giftImage");
  const giftPreview = document.querySelector("#giftPreview");
  const giftSlot = document.querySelector("#giftSlot");
  const giftButton = document.querySelector("#giftButton");
  const giftClear = document.querySelector("#giftClear");
  const giftResult = document.querySelector("#giftResult");

  let savedState = soul.getState();
  let draftAppearance = { ...savedState.appearance };
  let draftName = savedState.name;
  let draftPersonality = { ...savedState.personality };
  let pendingGiftData = "";

  function setSelected(groupName, value) {
    const group = document.querySelector(`[data-option-group="${groupName}"]`);
    if (!group) return;
    group.querySelectorAll("button[data-value]").forEach((button) => {
      button.classList.toggle("selected", button.dataset.value === value);
      button.setAttribute("aria-pressed", String(button.dataset.value === value));
    });
  }

  function initializeControls() {
    savedState = soul.getState();
    draftAppearance = { ...savedState.appearance };
    draftName = savedState.name;
    draftPersonality = { ...savedState.personality };

    if (nameInput) nameInput.value = savedState.name;
    if (childNameInput) childNameInput.value = savedState.personality.childName || "";
    if (favoriteTopicInput) favoriteTopicInput.value = savedState.personality.favoriteTopic || "";

    Object.entries(savedState.appearance).forEach(([key, value]) => setSelected(key, value));
    setSelected("personality", savedState.personality.core);
    setSelected("speechStyle", savedState.personality.speechStyle);
  }

  document.querySelectorAll(".option-group[data-option-group]").forEach((group) => {
    group.querySelectorAll("button[data-value]").forEach((button) => {
      button.addEventListener("click", () => {
        const groupName = group.dataset.optionGroup;
        const value = button.dataset.value;
        setSelected(groupName, value);

        if (["eyes", "mouth", "hat", "outfit", "badge"].includes(groupName)) {
          draftAppearance[groupName] = value;
          soul.applyAppearance(draftAppearance, false);
          soul.playMotion(groupName === "hat" || groupName === "outfit" ? "happy" : "curious");
          if (studioResult) studioResult.textContent = "홈 캐릭터에 미리보기했어요. ‘이 모습으로 적용’을 누르면 저장돼요.";
          return;
        }

        if (groupName === "personality") draftPersonality.core = value;
        if (groupName === "speechStyle") draftPersonality.speechStyle = value;
        if (personalityResult) personalityResult.textContent = "아직 미리 선택 상태예요. 아래에서 소울 설정을 저장해 주세요.";
      });
    });
  });

  nameInput?.addEventListener("input", () => {
    draftName = nameInput.value.trim() || "포켓";
    soul.applyName(draftName, false);
  });

  studioApply?.addEventListener("click", () => {
    soul.applyName(draftName, true);
    soul.applyAppearance(draftAppearance, true);
    soul.playMotion("happy");
    window.say?.(`${draftName}, 이제 이 모습이 마음에 들어! 네가 직접 꾸며 줬잖아.`, true);
    if (studioResult) studioResult.textContent = `${draftName}의 얼굴과 옷을 저장했어요.`;
  });

  studioReset?.addEventListener("click", () => {
    soul.reset();
    initializeControls();
    if (studioResult) studioResult.textContent = "하얀 기본 바디와 기본 얼굴로 돌아왔어요.";
    window.say?.("처음의 하얀 모습으로 돌아왔어. 다시 천천히 꾸며 줘!", false);
  });

  document.querySelectorAll("button[data-motion]").forEach((button) => {
    button.addEventListener("click", () => {
      const motion = button.dataset.motion;
      const motionData = {
        wave: ["손 흔들기", "안녕! 나 여기 있어!"],
        jump: ["통통 뛰기", "기분이 좋아서 몸이 먼저 뛰어 버렸어!"],
        happy: ["기쁨", "네가 같이 놀아 줘서 정말 좋아!"],
        curious: ["궁금함", "그게 뭐야? 나도 자세히 보여줘!"],
        sleepy: ["졸림", "조금 졸려도 네 이야기는 더 듣고 싶어."],
        pet: ["쓰다듬기", "헤헤, 그렇게 쓰다듬어 주는 거 좋아."]
      }[motion] || ["움직임", "나 움직이고 있어!"];

      soul.playMotion(motion);
      window.say?.(motionData[1], false);
      if (motionResult) motionResult.textContent = `${motionData[0]} 애니메이션을 재생했어요.`;
    });
  });

  personalityApply?.addEventListener("click", () => {
    draftPersonality.childName = childNameInput?.value.trim() || "";
    draftPersonality.favoriteTopic = favoriteTopicInput?.value.trim() || "";
    soul.updatePersonality(draftPersonality);
    soul.playMotion("curious");
    const state = soul.getState();
    const label = {
      gentle: "다정한",
      curious: "호기심 많은",
      cheerful: "명랑한",
      calm: "차분한"
    }[state.personality.core] || "호기심 많은";
    if (personalityResult) personalityResult.textContent = `${label} 성격과 말투를 저장했어요.`;
    window.say?.("이제 어떻게 말하고 반응할지 조금 더 또렷하게 알겠어.", true);
  });

  function readImageForGift(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error("이미지를 읽지 못했습니다."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("이 이미지 형식은 표시할 수 없습니다."));
        image.onload = () => {
          const maxSide = 420;
          const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
          const context = canvas.getContext("2d", { alpha: true });
          if (!context) {
            resolve(String(reader.result));
            return;
          }
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/webp", 0.78);
          resolve(dataUrl && dataUrl !== "data:," ? dataUrl : String(reader.result));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  giftImage?.addEventListener("change", async () => {
    const file = giftImage.files?.[0];
    if (!file) return;
    if (giftResult) giftResult.textContent = "그림을 작게 정리하는 중이에요…";
    giftButton.disabled = true;

    try {
      pendingGiftData = await readImageForGift(file);
      if (giftPreview) {
        giftPreview.src = pendingGiftData;
        giftPreview.hidden = false;
      }
      giftButton.disabled = false;
      if (giftResult) giftResult.textContent = `${file.name}을 선택했어요. 선물할 위치를 골라 주세요.`;
    } catch (error) {
      console.error(error);
      pendingGiftData = "";
      if (giftResult) giftResult.textContent = error.message || "그림을 읽지 못했어요.";
    }
  });

  giftButton?.addEventListener("click", () => {
    if (!pendingGiftData) return;
    const slot = giftSlot?.value || "head";
    soul.attachGift(pendingGiftData, slot);
    giftClear.disabled = false;
    if (giftResult) giftResult.textContent = "선물을 착용했어요. 홈에서 위치와 움직임을 확인해 주세요.";
    window.say?.("이거 네가 직접 만든 거야? 내가 잘 간직하고 있을게!", true);
  });

  giftClear?.addEventListener("click", () => {
    soul.clearGift();
    giftClear.disabled = true;
    if (giftResult) giftResult.textContent = "선물을 벗었어요. 그림 파일은 다시 선택할 수 있어요.";
    window.say?.("선물은 잘 보관해 둘게. 다음에 또 입혀 줘!", false);
  });

  window.addEventListener("pocketpal:view-changed", (event) => {
    if (["character-studio", "character-motion", "character-personality"].includes(event.detail?.view)) {
      initializeControls();
    }
  });

  initializeControls();
})();
