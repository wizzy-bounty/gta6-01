// Keyboard + mouse input: held keys, edge-triggered presses, mouse look/shoot.
export function createInput() {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false, clicked: false };
  let locked = false;

  function keyOf(e) {
    return e.code;
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(keyOf(e));
    pressed.add(keyOf(e));
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(keyOf(e)));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  window.addEventListener('mousemove', (e) => {
    mouse.dx += e.movementX || 0;
    mouse.dy += e.movementY || 0;
    mouse.x = e.clientX; mouse.y = e.clientY;
  });

  return {
    keys, mouse,
    isDown(code) { return keys.has(code); },
    // Edge-triggered: true once per physical press; consumed at end of frame.
    wasPressed(code) { return pressed.has(code); },
    axis() {
      let x = 0, z = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      return { x, z };
    },
    endFrame() { pressed.clear(); mouse.dx = 0; mouse.dy = 0; mouse.clicked = false; },
    get pointerLocked() { return locked; },
    set pointerLocked(v) { locked = v; },
  };
}
