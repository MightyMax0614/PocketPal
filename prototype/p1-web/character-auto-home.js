"use strict";

(() => {
  const image = document.querySelector("#customCharacterImage");
  const result = document.querySelector("#characterResult");
  if (!image) return;

  let firstRestore = true;
  let timer = null;

  const showAppliedCharacter = () => {
    if (image.hidden || !image.getAttribute("src")) return;

    // 저장된 캐릭터를 첫 화면에서 복원할 때는 이미 홈이므로 이동하지 않는다.
    if (firstRestore) {
      firstRestore = false;
      return;
    }

    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (typeof window.showView === "function") {
        window.showView("home");
      }
      if (result) result.textContent = "2D 캐릭터 적용 완료! 홈 화면에서 새 친구를 확인해 주세요.";
    }, 650);
  };

  const observer = new MutationObserver(showAppliedCharacter);
  observer.observe(image, {
    attributes: true,
    attributeFilter: ["src", "hidden"]
  });

  // 페이지 최초 실행 후부터는 새 업로드로 판단한다.
  window.setTimeout(() => {
    firstRestore = false;
  }, 1200);
})();
