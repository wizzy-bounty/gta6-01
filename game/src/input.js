// input.js — keyboard state for MARISOL BAY. One shared key map, edge
// detection for the interact key, and a hook that unlocks audio on the
// first real gesture.

export class Input {
  constructor(onFirstGesture) {
    this.down = new Set();
    this.pressed = new Set();
    let gestured = false;
    const gesture = () => {
      if (!gestured) {
        gestured = true;
        onFirstGesture?.();
      }
    };
    window.addEventListener('keydown', (e) => {
      gesture();
      const k = e.key.toLowerCase();
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.key.toLowerCase()));
    window.addEventListener('pointerdown', gesture);
    window.addEventListener('blur', () => this.down.clear());
  }

  /** end-of-frame housekeeping: edge presses last exactly one frame */
  postUpdate() {
    this.pressed.clear();
  }

  get forward() { return this.down.has('w') || this.down.has('arrowup'); }
  get back() { return this.down.has('s') || this.down.has('arrowdown'); }
  get left() { return this.down.has('a') || this.down.has('arrowleft'); }
  get right() { return this.down.has('d') || this.down.has('arrowright'); }
  get nitro() { return this.down.has('shift'); }
  get handbrake() { return this.down.has(' '); }
  get interact() { return this.pressed.has('e'); }
}
