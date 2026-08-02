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
  guide.textContent = "휠을 크게 원으로 돌리거나 ◀ ▶를 톡 눌러도 돼";
  controlsElement.prepend(guide);

  if (coarsePointer && homeHint) {
    homeHint.textContent = "휠을 크게 원으로 돌리거나 ◀ ▶를 눌러줘";
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

    event.preventDefault();
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

    event.preventDefault();
    event.stopImmediatePropagation();

    const dx = event.clientX - previousX;
    const dy = event.clientY - previousY;
    totalMovement += Math.hypot(dx, dy);
    previousX = event.clientX;
    previousY = event.clientY;

    const geometry = wheelGeometry(event);

    // 중앙 버튼 근처에서는 각도가 급변하므로 회전 입력에서 제외한다.
    if (geometry.radius < geometry.wheelRadius * 0.22) {
      previousAngle = geometry.angle;
      return;
    }

    let delta = normalizeDelta(geometry.angle - previousAngle);
    previousAngle = geometry.angle;

    // 손가락이 순간적으로 중심을 가로지를 때 생기는 큰 점프를 억제한다.
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

    event.preventDefault();
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

  wheelElement.addEventListener("pointerdown", onPointerDown, { capture: true });
  wheelElement.addEventListener("pointermove", onPointerMove, { capture: true });
  wheelElement.addEventListener("pointerup", releasePointer, { capture: true });
  wheelElement.addEventListener("pointercancel", releasePointer, { capture: true });

  // iOS Safari가 휠 동작을 페이지 스크롤로 해석하지 않도록 막는다.
  wheelElement.addEventListener(
    "touchmove",
    (event) => event.preventDefault(),
    { passive: false, capture: true }
  );
})();
