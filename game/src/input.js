// input.js — keyboard + mouse state for NEON TIDE.
// One Input object polls keys by code; edge-triggered presses are queued so the
// game loop can ask "was E pressed this frame?" without missing taps.

export class Input {
  constructor() {
    this.down = new Set();       // codes currently held
    this.pressed = new Set();    // codes pressed since last consumePresses()
    this.mouseDown = false;      // left button held (shooting)
    this.mouseClicked = false;   // left button clicked since last frame
    this.mouseX = 0; this.mouseY = 0;
    this.enabled = true;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      if (['ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); this.mouseDown = false; });
    addEventListener('mousemove', (e) => { this.mouseX = e.clientX; this.mouseY = e.clientY; });
    addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.mouseDown = true; this.mouseClicked = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
  }
  held(...codes) { return codes.some((c) => this.down.has(c)); }
  wasPressed(...codes) { return codes.some((c) => this.pressed.has(c)); }
  /** Movement axes from WASD/arrows: x = strafe right, z = forward. */
  axes() {
    const x = (this.held('KeyD', 'ArrowRight') ? 1 : 0) - (this.held('KeyA', 'ArrowLeft') ? 1 : 0);
    const z = (this.held('KeyW', 'ArrowUp') ? 1 : 0) - (this.held('KeyS', 'ArrowDown') ? 1 : 0);
    return { x, z };
  }
  /** Call once at the end of each frame: clears the per-frame press queues. */
  endFrame() { this.pressed.clear(); this.mouseClicked = false; }
}
