// Input: keyboard state as a Set, pointer-lock mouse deltas, fire/ADS buttons, wheel weapon cycle.
// ?shot=... captures skip pointer lock: they drive the body straight from the shot script.
export function createInput(element, onLockChange) {
  const keys = new Set();
  const input = {
    keys,
    firing: false,
    ads: false,
    wheel: 0,
    usePressed: false,
    buyPressed: false,
    grenadePressed: false,
  };

  const shot = new URLSearchParams(window.location.search).get('shot');

  const keyNames = {
    Space: 'Space',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
    ControlLeft: 'Control',
    ControlRight: 'Control',
    KeyW: 'KeyW',
    KeyA: 'KeyA',
    KeyS: 'KeyS',
    KeyD: 'KeyD',
    KeyR: 'KeyR',
    KeyG: 'KeyG',
    KeyC: 'KeyC',
    KeyB: 'KeyB',
    KeyF: 'KeyF',
    KeyQ: 'KeyQ',
    KeyE: 'KeyE',
  };

  window.addEventListener('keydown', (event) => {
    const name = keyNames[event.code] ?? event.code;
    keys.add(name);
    if (event.code === 'KeyF') input.usePressed = true;
    if (event.code === 'KeyB') input.buyPressed = true;
    if (event.code === 'KeyG') input.grenadePressed = true;
    if (event.code === 'Space' || event.code === 'KeyF' || event.code === 'KeyB') event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    const name = keyNames[event.code] ?? event.code;
    keys.delete(name);
  });

  window.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== element) return;
    input.lookDX = (input.lookDX ?? 0) + event.movementX;
    input.lookDY = (input.lookDY ?? 0) + event.movementY;
  });

  element.addEventListener('mousedown', (event) => {
    if (event.button === 0) input.firing = true;
    if (event.button === 2) input.ads = true;
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.firing = false;
    if (event.button === 2) input.ads = false;
  });

  element.addEventListener('wheel', (event) => {
    input.wheel += Math.sign(event.deltaY);
    event.preventDefault();
  }, { passive: false });

  window.addEventListener('contextmenu', (event) => event.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === element;
    onLockChange(locked);
    if (!locked) {
      keys.clear();
      input.firing = false;
      input.ads = false;
    }
  });

  function requestLock() {
    if (shot) return;
    element.requestPointerLock?.();
  }

  function takeLook() {
    const dx = input.lookDX ?? 0;
    const dy = input.lookDY ?? 0;
    input.lookDX = 0;
    input.lookDY = 0;
    return { x: dx, y: dy };
  }

  return {
    state: input,
    requestLock,
    takeLook,
  };
}