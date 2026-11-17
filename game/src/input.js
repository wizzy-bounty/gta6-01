// input.js — keyboard + mouse state for SOLMAR HEAT.
// Tracks held keys, edge-triggered presses, and mouse clicks (for shooting).

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouseDown = false;
    this.mouseClicked = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedKeys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    // Prevent the context menu from breaking aim on right click.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Held this frame? */
  isDown(code) {
    return this.keys.has(code);
  }

  /** Pressed since the last endFrame()? Edge-triggered, consumed once. */
  wasPressed(code) {
    return this.pressedKeys.has(code);
  }

  /** Mouse button pressed since the last endFrame()? */
  clicked() {
    return this.mouseClicked;
  }

  /** Call once at the end of every game-loop tick. */
  endFrame() {
    this.pressedKeys.clear();
    this.mouseClicked = false;
  }

  /** WASD / arrows as a -1..1 steering + throttle pair. */
  driveAxes() {
    const throttle =
      (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0) -
      (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0);
    const steer =
      (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0) -
      (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0);
    return { throttle, steer };
  }

  /** WASD / arrows as a movement vector on the ground plane. */
  moveAxes() {
    const fwd =
      (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0) -
      (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0);
    const strafe =
      (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0) -
      (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    return { fwd, strafe };
  }
}
