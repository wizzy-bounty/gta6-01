// input.js — keyboard + mouse state for SOLMAR HEAT.
// One job: track which keys are held and expose edge-triggered "pressed" events.
// Mouse clicks are listened to on the game canvas only, so clicking a menu
// button never fires the pistol.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseClicked = false;
  let mouseX = 0;
  let mouseY = 0;

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyE: 'enter', KeyF: 'punch', Space: 'brake',
    ShiftLeft: 'run', ShiftRight: 'run',
    Escape: 'pause', KeyM: 'mute', KeyR: 'respawn',
  };

  function onKeyDown(e) {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (e.code === 'Space') e.preventDefault();
    if (!e.repeat) pressed.add(action);
    keys.add(action);
  }
  function onKeyUp(e) {
    const action = KEYMAP[e.code];
    if (action) keys.delete(action);
  }
  function onMouseDown(e) {
    if (e.button === 0) { mouseClicked = true; mouseX = e.clientX; mouseY = e.clientY; }
  }
  function onBlur() { keys.clear(); }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  (canvas || window).addEventListener('mousedown', onMouseDown);
  window.addEventListener('blur', onBlur);

  return {
    // Held this frame?
    held(action) { return keys.has(action); },
    // Pressed since the last endFrame()?
    pressed(action) { return pressed.has(action); },
    consumeClick() { const c = mouseClicked; mouseClicked = false; return c; },
    mousePos() { return { x: mouseX, y: mouseY }; },
    // Call once per frame after the game has read input.
    endFrame() { pressed.clear(); },
  };
}
