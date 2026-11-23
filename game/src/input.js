// input.js — keyboard + mouse state for driving and walking.
// WASD/arrows drive, Space brakes, E enters/leaves a car, Shift runs,
// M mutes, Enter starts. Nothing fancy, everything responsive.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // one-frame presses
    this.mouseX = 0;
    this.mouseDX = 0;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('mousemove', (e) => {
      this.mouseDX = e.movementX || 0;
      this.mouseX = e.clientX;
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(code) { return this.keys.has(code); }
  hit(code) { const h = this.pressed.has(code); if (h) this.pressed.delete(code); return h; }

  get throttle() { return (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0); }
  get steer() { return (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0) - (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0); }
  get brake() { return this.down('Space'); }
  get run() { return this.down('ShiftLeft') || this.down('ShiftRight'); }

  endFrame() { this.pressed.clear(); }
}
