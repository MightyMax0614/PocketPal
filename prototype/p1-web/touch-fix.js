"use strict";

(() => {
  const wheelElement = document.querySelector("#wheel");
  const controlsElement = document.querySelector(".controls");
  const homeHint = document.querySelector(".home-hint");

  if (!wheelElement || !controlsElement) return;

  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const stepAngle = coarsePointer ? 14 : 24;

  let activePointerId = null;
  let previousAngle = 0;
  let accumulatedAngle = 0;
  let visualAngle = 0;
  let totalMovement = 0;
  let previousX = 0;
  let previousY = 0;
  let guideTimer = null;

  const guide = document.createElement("div");
  guide.className = "mobile-wheel-guide";
  guide.textContent = "페이지는 움직이지 않아. 휠만 크게 원으로 돌려줘";
  controlsElement.prepend(guide);

  if (coarsePointer && homeHint) {
    homeHint.textContent = "페이지는 고정돼 있어. 휠을 크게 원으로 돌려줘";
  }

  function stopBrowserGesture(event) {
    if (event.cancelable) event.preventDefault();
  }

  function showGuide() {
    if (!coarsePointer) return;
    controlsElement.classList.add("guide-visible");
    window.clearTimeout(guideTimer);
    guideTimer = window.setTimeout(() => {
      controlsElement.classList.remove("guide-visible");
    }, 1800);
  }

  function wheelGeometry(event) {
    const rect = wheelElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = event.clientX - centerX;
    const y = event.clientY - centerY;

    return {
      angle: Math.atan2(y, x) * (180 / Math.PI),
      radius: Math.hypot(x, y),
      wheelRadius: rect.width / 2
    };
  }

  function normalizeDelta(delta) {
    if (delta > 180) return delta - 360;
    if (delta < -180) return delta + 360;
    return delta;
  }

  function move(direction) {
    if (typeof window.moveMenu === "function") {
      window.moveMenu(direction);
    }
  }

  function select() {
    if (typeof window.selectCurrent === "function") {
      window.selectCurrent();
    }
  }

  function openMenu() {
    if (typeof window.showView === "function") {
      window.showView("menu");
    } else {
      move(1);
    }
  }

  function handleSectorTap(event) {
    const { angle } = wheelGeometry(event);

    if (angle >= -135 && angle < -45) {
      openMenu();
      return;
    }

    if (angle >= -45 && angle < 45) {
      move(1);
      return;
    }

    if (angle >= 45 && angle < 135) {
      select();
      return;
    }

    move(-1);
  }

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    stopBrowserGesture(event);
    event.stopImmediatePropagation();

    activePointerId = event.pointerId;
    const geometry = wheelGeometry(event);
    previousAngle = geometry.angle;
    accumulatedAngle = 0;
    totalMovement = 0;
    previousX = event.clientX;
    previousY = event.clientY;

    wheelElement.classList.add("is-touching");
    wheelElement.setPointerCapture?.(event.pointerId);
    showGuide();
  }

  function onPointerMove(event) {
    if (activePointerId !== event.pointerId) return;

    stopBrowserGesture(event);
    event.stopImmediatePropagation();

    const dx = event.clientX - previousX;
    const dy = event.clientY - previousY;
    totalMovement += Math.hypot(dx, dy);
    previousX = event.clientX;
    previousY = event.clientY;

    const geometry = wheelGeometry(event);

    if (geometry.radius < geometry.wheelRadius * 0.22) {
      previousAngle = geometry.angle;
      return;
    }

    let delta = normalizeDelta(geometry.angle - previousAngle);
    previousAngle = geometry.angle;

    delta = Math.max(-32, Math.min(32, delta));
    accumulatedAngle += delta;
    visualAngle += delta;
    wheelElement.style.setProperty("--wheel-angle", `${visualAngle}deg`);

    while (Math.abs(accumulatedAngle) >= stepAngle) {
      const direction = accumulatedAngle > 0 ? 1 : -1;
      move(direction);
      accumulatedAngle -= direction * stepAngle;
      controlsElement.classList.remove("guide-visible");
    }
  }

  function releasePointer(event) {
    if (activePointerId !== event.pointerId) return;

    stopBrowserGesture(event);
    event.stopImmediatePropagation();

    if (totalMovement < 10) {
      handleSectorTap(event);
    }

    if (wheelElement.hasPointerCapture?.(event.pointerId)) {
      wheelElement.releasePointerCapture(event.pointerId);
    }

    activePointerId = null;
    accumulatedAngle = 0;
    wheelElement.classList.remove("is-touching");
  }

  wheelElement.addEventListener("pointerdown", onPointerDown, { capture: true, passive: false });
  wheelElement.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });
  wheelElement.addEventListener("pointerup", releasePointer, { capture: true, passive: false });
  wheelElement.addEventListener("pointercancel", releasePointer, { capture: true, passive: false });

  // iOS Safari가 휠 동작을 스크롤, 당겨서 새로고침, 확대 제스처로 해석하지 못하게 한다.
  document.addEventListener(
    "touchmove",
    (event) => {
      if (activePointerId !== null) stopBrowserGesture(event);
    },
    { passive: false, capture: true }
  );

  wheelElement.addEventListener("touchstart", stopBrowserGesture, { passive: false, capture: true });
  wheelElement.addEventListener("touchmove", stopBrowserGesture, { passive: false, capture: true });
  wheelElement.addEventListener("gesturestart", stopBrowserGesture, { passive: false, capture: true });
  wheelElement.addEventListener("gesturechange", stopBrowserGesture, { passive: false, capture: true });

  // Safari가 주소창 높이를 바꾸더라도 문서 위치는 항상 0으로 유지한다.
  window.addEventListener("scroll", () => {
    if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
  }, { passive: true });
})();
