// input.js — keyboard + mouse state for SOLMAR HEAT. One job: tell the game
// which keys are down right now, and queue single-press actions (E, F, P, M).
export function createInput() {
  const keys = new Set();
  const pressed = new Set(); // single-frame presses, drained by main loop
  let mouseDown = false;
  let mouseClicked = false; // one-shot: a click this frame
  let mouseX = 0;
  let mouseY = 0;

  const onKeyDown = (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onMouseDown = (e) => { mouseDown = true; mouseClicked = true; mouseX = e.clientX; mouseY = e.clientY; };
  const onMouseUp = () => { mouseDown = false; };
  const onBlur = () => { keys.clear(); mouseDown = false; };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  return {
    // Held keys (WASD + arrows + Shift + Space).
    get forward() { return keys.has('KeyW') || keys.has('ArrowUp'); },
    get back() { return keys.has('KeyS') || keys.has('ArrowDown'); },
    get left() { return keys.has('KeyA') || keys.has('ArrowLeft'); },
    get right() { return keys.has('KeyD') || keys.has('ArrowRight'); },
    get run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    get jump() { return keys.has('Space'); },
    get mouseDown() { return mouseDown; },
    get mouseClicked() { return mouseClicked; },
    get mouseX() { return mouseX; },
    get mouseY() { return mouseY; },
    // One-shot press consumed by whoever reads it first.
    wasPressed(code) { if (pressed.has(code)) { pressed.delete(code); return true; } return false; },
    // End of frame: forget one-shot presses and clicks.
    endFrame() { pressed.clear(); mouseClicked = false; },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
