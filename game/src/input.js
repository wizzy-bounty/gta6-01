// Keyboard + mouse state. One shared object, no framework.
export const keys = Object.create(null);
export const pressed = Object.create(null); // edge-triggered, consumed by game each frame
export const mouse = { dx: 0, dy: 0, down: false };

export function bindInput() {
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    pressed[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  addEventListener('mousedown', (e) => { mouse.down = true; });
  addEventListener('mouseup', () => { mouse.down = false; });
  addEventListener('mousemove', (e) => { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; });
}

export function endFrameInput() {
  for (const k in pressed) delete pressed[k];
  mouse.dx = 0; mouse.dy = 0;
}

export function isDown(...codes) { return codes.some((c) => keys[c]); }
export function wasPressed(...codes) { return codes.some((c) => pressed[c]); }
