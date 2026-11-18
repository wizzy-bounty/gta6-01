// input.js — keyboard + mouse input for SOLMAR HEAT.
// Tracks held keys, edge-triggered presses, mouse movement for the orbit
// camera, and click events for shooting. Pointer lock is requested on the
// game canvas when the player clicks it during play.

export class Input {
  constructor(canvas) {
    this.keys = Object.create(null);
    this.pressed = Object.create(null);
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.clicked = false;
    this.locked = false;
    this.canvas = canvas;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      this.pressed[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => { this.keys[e.code] = false; };
    this._onMouseMove = (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    };
    this._onMouseDown = (e) => {
      if (e.button !== 0) return;
      // Only clicks on the game canvas itself count as shots: clicks on
      // menu buttons (Start, Resume, ...) must not fire the player's gun.
      if (e.target !== this.canvas) return;
      if (!this.locked && document.pointerLockElement !== this.canvas) {
        try { this.canvas.requestPointerLock(); } catch { /* pointer lock unavailable */ }
      }
      this.clicked = true;
    };
    this._onLockChange = () => { this.locked = document.pointerLockElement === this.canvas; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('pointerlockchange', this._onLockChange);
  }

  /** True while the key is held down. */
  down(code) { return !!this.keys[code]; }

  /** True only on the frame the key was pressed. Consumed by endFrame(). */
  wasPressed(code) { return !!this.pressed[code]; }

  /** True only on the frame the mouse was clicked. Consumed by endFrame(). */
  wasClicked() { return this.clicked; }

  /** Mouse orbit deltas since the last frame; consumed by endFrame(). */
  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }

  /** Call once per frame after the game has read the input. */
  endFrame() {
    this.pressed = Object.create(null);
    this.clicked = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('pointerlockchange', this._onLockChange);
  }
}
