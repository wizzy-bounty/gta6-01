// input.js — keyboard and mouse state for SOLMAR HEAT.
// One shared state object: `keys` holds what is down right now, `pressed` holds
// what went down this frame (for one-shot actions like entering a car), and the
// mouse deltas accumulate between frames for the orbit camera.

export const input = {
  keys: new Set(),
  pressed: new Set(),
  mouseDX: 0,
  mouseDY: 0,
  mouseDown: false,
  clicked: false,
  pointerLocked: false,
};

let targetCanvas = null;

export function initInput(canvas) {
  targetCanvas = canvas;
  window.addEventListener('keydown', (ev) => {
    if (!ev.repeat) input.pressed.add(ev.code);
    input.keys.add(ev.code);
    if (ev.code === 'Space') ev.preventDefault();
  });
  window.addEventListener('keyup', (ev) => {
    input.keys.delete(ev.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });
  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button === 0) {
      input.mouseDown = true;
      input.clicked = true;
    }
  });
  window.addEventListener('mouseup', (ev) => {
    if (ev.button === 0) input.mouseDown = false;
  });
  document.addEventListener('pointerlockchange', () => {
    input.pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (ev) => {
    if (input.pointerLocked) {
      input.mouseDX += ev.movementX || 0;
      input.mouseDY += ev.movementY || 0;
    }
  });
}

export function lockPointer() {
  if (targetCanvas && document.pointerLockElement !== targetCanvas) {
    targetCanvas.requestPointerLock();
  }
}

export function unlockPointer() {
  if (document.pointerLockElement) document.exitPointerLock();
}

export function keyDown(code) {
  return input.keys.has(code);
}

export function keyPressed(code) {
  return input.pressed.has(code);
}

// Called once at the end of every frame: one-shot state resets, held state stays.
export function endFrameInput() {
  input.pressed.clear();
  input.mouseDX = 0;
  input.mouseDY = 0;
  input.clicked = false;
}
