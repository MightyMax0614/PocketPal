"use strict";
(() => {
  const records = window.POCKETPAL_CATALOG;
  const originals = window.POCKETPAL_ORIGINALS || [];
  const palette = ["#efdbec", "#f4edc9", "#e7edd8", "#edece1", "#e0eaf0", "#efe2d7"];
  const dialog = document.querySelector("#detail");
  const large = document.querySelector("#detailSprite");
  const pause = document.querySelector("#pauseDetail");
  const flip = document.querySelector("#flip");
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let paused = motionPreference.matches;
  let detailPaused = motionPreference.matches;
  let flipped = false;
  let selected = null;
  let activeClip = 0;

  function paint(el, clip, big = false) {
    const [x, y, right, bottom] = clip.box;
    const width = right - x, height = bottom - y;
    const availableWidth = big ? Math.max(90, Math.min(360, window.innerWidth - 96)) : 116;
    const availableHeight = big ? 238 : 101;
    const fit = Math.min(availableWidth / width, availableHeight / height);
    const scale = clip.concept ? fit : Math.max(0.25, fit >= 1 ? Math.floor(fit) : fit);
    const fps = clip.fps || 20;
    el.classList.toggle("concept", Boolean(clip.concept));
    el.style.cssText = `width:${width}px;height:${height}px;--scale:${scale};--frames:${clip.n};--duration:${clip.n / fps}s;--start-x:${-x}px;--start-y:${-y}px;--end-x:${-clip.w * clip.n - x}px;--flip:${big && flipped ? -1 : 1}`;
    el.style.backgroundImage = `url("${clip.data}")`;
    el.style.backgroundSize = `${clip.imageW || clip.w * clip.n}px ${clip.imageH || clip.h}px`;
    if (clip.n === 1) el.style.animation = "none";
    if (big) el.style.animationPlayState = detailPaused ? "paused" : "running";
  }

  function selectClip(index) {
    activeClip = index;
    const clip = selected.clips[index];
    paint(large, clip, true);
    document.querySelectorAll("#clips button").forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    const prefix = selected.source === "pocketpal-original" ? "동작 초안" : "작가 원본";
    document.querySelector("#frameInfo").textContent = clip.concept
      ? "정지 도트 시안 · 이 친구의 동작은 아직 제작 전이에요."
      : `${prefix} · ${clip.w}×${clip.h}px · ${clip.n}프레임${clip.n > 1 ? ` · ${clip.fps || 20} FPS` : " · 한 장의 포즈"}`;
    pause.hidden = clip.n === 1;
  }

  function open(record, index) {
    selected = record;
    flipped = false;
    detailPaused = motionPreference.matches;
    document.querySelector("#detailTitle").textContent = record.ko;
    document.querySelector("#detailOriginal").textContent = record.source === "pocketpal-original"
      ? `${record.id} · PocketPal 오리지널`
      : `${record.name} · Pixel Adventure ${record.pack}`;
    document.querySelector("#detailNote").textContent = record.note;
    document.querySelector("#detailStage").style.setProperty("--scene", record.background || palette[index % palette.length]);
    pause.textContent = detailPaused ? "이 동작 다시 시작" : "이 동작 멈추기";
    pause.setAttribute("aria-pressed", String(detailPaused));
    flip.setAttribute("aria-pressed", "false");
    const clips = document.querySelector("#clips");
    clips.replaceChildren();
    record.clips.forEach((clip, i) => {
      const button = document.createElement("button");
      button.textContent = clip.label;
      button.addEventListener("click", () => selectClip(i));
      clips.append(button);
    });
    selectClip(0);
    document.body.classList.add("dialog-open");
    dialog.showModal();
  }

  function addCards(items, gallery, original = false) {
    items.forEach((record, index) => {
      const card = document.createElement("button");
      card.className = "card";
      card.setAttribute("aria-label", `${record.ko} 크게 보기${original ? record.animated ? ", 동작 초안" : ", 정지 시안" : ""}`);
      card.style.setProperty("--scene", record.background || palette[index % palette.length]);
      const area = document.createElement("span");
      area.className = "art-area";
      const sprite = document.createElement("span");
      sprite.className = "sprite";
      sprite.setAttribute("aria-hidden", "true");
      paint(sprite, record.clips[0]);
      area.append(sprite);
      const label = document.createElement("span");
      label.className = "card-label";
      const name = document.createElement("strong");
      name.textContent = record.ko;
      const subtitle = document.createElement("small");
      subtitle.textContent = original ? `${record.id} · ${record.animated ? "4가지 동작 초안" : "정지 도트 시안"}` : record.name;
      label.append(name, subtitle);
      card.append(area, label);
      card.addEventListener("click", () => open(record, index));
      gallery.append(card);
    });
  }

  addCards(originals, document.querySelector("#originalGallery"), true);
  addCards(records, document.querySelector("#gallery"));
  const moving = originals.filter(record => record.animated).length;
  document.querySelector("#originalCount").textContent = `동작 초안 ${moving}종 · 정지 시안 ${originals.length - moving}종`;

  function updatePauseAll() {
    document.body.classList.toggle("paused", paused);
    const button = document.querySelector("#pauseAll");
    button.setAttribute("aria-pressed", String(paused));
    button.textContent = paused ? "목록 움직임 다시 시작" : "목록 움직임 멈추기";
  }
  updatePauseAll();
  document.querySelector("#pauseAll").addEventListener("click", () => { paused = !paused; updatePauseAll(); });
  document.querySelector("#closeDetail").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => document.body.classList.remove("dialog-open"));
  flip.addEventListener("click", () => {
    flipped = !flipped;
    large.style.setProperty("--flip", flipped ? -1 : 1);
    flip.setAttribute("aria-pressed", String(flipped));
  });
  pause.addEventListener("click", () => {
    detailPaused = !detailPaused;
    large.style.animationPlayState = detailPaused ? "paused" : "running";
    pause.setAttribute("aria-pressed", String(detailPaused));
    pause.textContent = detailPaused ? "이 동작 다시 시작" : "이 동작 멈추기";
  });
  motionPreference.addEventListener("change", event => {
    paused = event.matches;
    detailPaused = event.matches;
    updatePauseAll();
    if (selected) selectClip(activeClip);
    pause.textContent = detailPaused ? "이 동작 다시 시작" : "이 동작 멈추기";
    pause.setAttribute("aria-pressed", String(detailPaused));
  });
  window.addEventListener("resize", () => { if (dialog.open && selected) paint(large, selected.clips[activeClip], true); });
  document.addEventListener("visibilitychange", () => document.body.classList.toggle("hidden-tab", document.hidden));
})();
