// input.js — keyboard + mouse state for NEON TIDE.
// One shared Input object: held keys, edge-triggered presses, mouse delta and
// buttons. Pointer lock is requested by main.js on the canvas; this module
// only records what the player does.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();       // codes currently held, e.g. "KeyW"
    this.pressed = new Set();    // codes that went down since last consume
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.locked = false;

    addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    addEventListener('mousedown', (e) => { if (e.button === 0) this.mouseDown = true; });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }

  down(code) { return this.keys.has(code); }

  // Edge trigger: true once per physical press.
  hit(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  lock() { this.canvas.requestPointerLock?.(); }

  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }
}
