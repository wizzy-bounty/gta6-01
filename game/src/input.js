// MARISOL BAY — keyboard input state.
export const keys = Object.create(null);

export function initInput() {
  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
}

export const input = {
  get throttle() { return (keys.KeyW || keys.ArrowUp) ? 1 : 0; },
  get brake() { return (keys.KeyS || keys.ArrowDown) ? 1 : 0; },
  get steer() {
    let s = 0;
    if (keys.KeyA || keys.ArrowLeft) s -= 1;
    if (keys.KeyD || keys.ArrowRight) s += 1;
    return s;
  },
  get handbrake() { return !!keys.Space; },
  get nitro() { return !!(keys.ShiftLeft || keys.ShiftRight); },
  get enter() { return !!keys.KeyE; },
  moveAxis() {
    let x = 0, z = 0;
    if (keys.KeyW || keys.ArrowUp) z -= 1;
    if (keys.KeyS || keys.ArrowDown) z += 1;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    const len = Math.hypot(x, z) || 1;
    return { x: x / len, z: z / len, active: x !== 0 || z !== 0 };
  },
};
