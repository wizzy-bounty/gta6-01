// input.js — keyboard + mouse state for SOLMAR HEAT (WASD drive/walk, E steal, F punch, mouse shoot).
export function createInput() {
  const keys = {};
  const mouse = { x: 0, y: 0, down: false, dx: 0, dy: 0, locked: false };
  const pressed = new Set(); // keys hit this frame (edge-triggered actions)
  const listeners = [];
  function onKey(e, down) {
    const k = e.key.toLowerCase();
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (down && !keys[k]) pressed.add(k);
    keys[k] = down;
  }
  const kd = (e) => onKey(e, true);
  const ku = (e) => onKey(e, false);
  const md = (e) => { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; };
  const mu = () => { mouse.down = false; };
  const mm = (e) => {
    if (mouse.locked) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; }
    mouse.x = e.clientX; mouse.y = e.clientY;
  };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  window.addEventListener('mousedown', md);
  window.addEventListener('mouseup', mu);
  window.addEventListener('mousemove', mm);
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === document.body;
  });
  listeners.push(kd, ku, md, mu, mm);
  return {
    keys, mouse, pressed,
    wasPressed(k) { return pressed.has(k); },
    consume(k) { pressed.delete(k); },
    endFrame() { pressed.clear(); mouse.dx = 0; mouse.dy = 0; },
    lockPointer() { if (document.body.requestPointerLock) document.body.requestPointerLock(); },
  };
}
