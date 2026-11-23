// MARISOL BAY — keyboard and mouse input state.

export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseDown = false;
    this.mouseDX = 0;
    this._onKeyDown = (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      this._presses.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = (e) => { this.mouseDown = true; this._presses.add('Mouse0'); };
    this._onMouseUp = () => { this.mouseDown = false; };
    this._onMouseMove = (e) => { this.mouseDX += e.movementX || 0; };
    this._presses = new Set();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // True once per physical press; consumed by the game loop each frame.
  pressed(code) {
    return this._presses.has(code);
  }

  endFrame() {
    this._presses.clear();
    this.mouseDX = 0;
  }
}
