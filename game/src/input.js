// NEON TIDE — input.js: keyboard + mouse state with edge detection.
// The game loop polls `keys` for held state and `pressed` for one-shot actions.

export const keys = new Set();
export const pressed = new Set();
export const mouse = { x: 0, y: 0, down: false, clicked: false, wheel: 0 };

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyQ', 'KeyP', 'KeyM',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft',
  'ShiftRight', 'Digit1', 'Digit2', 'Digit3', 'Enter', 'Escape',
]);

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  canvas.addEventListener('wheel', (e) => {
    mouse.wheel += Math.sign(e.deltaY);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function endFrameInput() {
  pressed.clear();
  mouse.clicked = false;
  mouse.wheel = 0;
}

export function moveAxis() {
  let x = 0;
  let y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}
