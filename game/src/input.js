// NEON TIDE — keyboard + mouse state. Systems read `keys` and `mouse`;
// edge-triggered presses are queued in `pressed` and drained once per frame.

export const keys = new Set();
export const pressed = new Set();
export const mouse = { x: 640, y: 360, down: false, clicked: false };

const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
}

export function wasPressed(code) { return pressed.has(code); }
export function endFrameInput() { pressed.clear(); mouse.clicked = false; }
