// input.js — keyboard + mouse state for SOLMAR HEAT. One job: raw input only.
export function createInput() {
  const keys = new Set();
  const state = {
    keys,
    mouseDown: false,
    mouseClicked: false,
    dragDX: 0,
    dragDY: 0,
    dragging: false,
    pointerLocked: false,
  };
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) { state.mouseDown = true; state.mouseClicked = true; }
    state.dragging = true; lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) state.mouseDown = false;
    state.dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (state.dragging) {
      state.dragDX += e.clientX - lastX;
      state.dragDY += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
    }
  });
  document.addEventListener('pointerlockchange', () => {
    state.pointerLocked = document.pointerLockElement != null;
  });
  return state;
}

export function consumeClick(input) {
  const c = input.mouseClicked;
  input.mouseClicked = false;
  return c;
}

export function consumeDrag(input) {
  const dx = input.dragDX;
  const dy = input.dragDY;
  input.dragDX = 0;
  input.dragDY = 0;
  return { dx, dy };
}

export function pressedOnce(input, code) {
  if (input.keys.has(code)) {
    input.keys.delete(code);
    return true;
  }
  return false;
}
