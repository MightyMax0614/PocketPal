"use strict";

(() => {
  const wheel = document.querySelector("#wheel");
  if (!wheel) return;

  let wheelGestureActive = false;

  const stopBrowserGesture = (event) => {
    if (event.cancelable) event.preventDefault();
  };

  wheel.addEventListener(
    "pointerdown",
    (event) => {
      wheelGestureActive = true;
      stopBrowserGesture(event);
    },
    { passive: false }
  );

  wheel.addEventListener(
    "pointermove",
    (event) => {
      if (wheelGestureActive) stopBrowserGesture(event);
    },
    { passive: false }
  );

  const endWheelGesture = () => {
    wheelGestureActive = false;
  };

  window.addEventListener("pointerup", endWheelGesture, { passive: true });
  window.addEventListener("pointercancel", endWheelGesture, { passive: true });

  // iOS Safari의 페이지 스크롤·당겨서 새로고침·확대 제스처를 휠 위에서 차단한다.
  wheel.addEventListener("touchmove", stopBrowserGesture, { passive: false });
  wheel.addEventListener("gesturestart", stopBrowserGesture, { passive: false });
  wheel.addEventListener("gesturechange", stopBrowserGesture, { passive: false });

  document.addEventListener(
    "touchmove",
    (event) => {
      if (wheelGestureActive) stopBrowserGesture(event);
    },
    { passive: false }
  );
})();
