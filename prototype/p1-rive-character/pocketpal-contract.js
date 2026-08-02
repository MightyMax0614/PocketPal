"use strict";

window.POCKETPAL_RIVE_CONTRACT = Object.freeze({
  version: "0.1",
  artboard: "PocketPal",
  stateMachine: "PocketPalState",
  localAsset: "/PocketPal/prototype/assets/rive/pocketpal.riv",
  fallbackAsset: "https://raw.githubusercontent.com/rive-app/rive-flutter/master/example/assets/rewards.riv",
  inputs: Object.freeze([
    { name: "mood", type: "Number" },
    { name: "energy", type: "Number" },
    { name: "look_x", type: "Number" },
    { name: "look_y", type: "Number" },
    { name: "talking", type: "Boolean" },
    { name: "sleepy", type: "Boolean" },
    { name: "pet", type: "Trigger" },
    { name: "wave", type: "Trigger" },
    { name: "jump", type: "Trigger" },
    { name: "notice", type: "Trigger" },
    { name: "face_style", type: "Number" },
    { name: "hat_style", type: "Number" },
    { name: "outfit_style", type: "Number" },
    { name: "badge_style", type: "Number" }
  ]),
  moods: Object.freeze({ calm: 0, curious: 1, happy: 2, sad: 3, sleepy: 4 })
});
