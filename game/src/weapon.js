// Weapon definitions and runtime state: fire rate, spread/recoil, magazine, reload, ADS.
// Multiple weapons: pistol, SMG, rifle, sniper. Buy menu lets player pick per round.
export const WEAPONS = {
  pistol: {
    name: 'P220',
    kind: 'pistol',
    price: 0,
    damage: 26,
    headshotMultiplier: 3.0,
    fireRate: 0.18,
    magSize: 12,
    reserveSize: 48,
    reloadTime: 1.6,
    spread: 0.008,
    spreadMove: 0.025,
    spreadAds: 0.003,
    recoilPitch: 0.012,
    recoilYaw: 0.005,
    recoilRecover: 8,
    auto: false,
    adsFov: 60,
    adsSpread: 0.003,
    penetration: 0,
  },
  smg: {
    name: 'MP9',
    kind: 'smg',
    price: 1250,
    damage: 22,
    headshotMultiplier: 2.8,
    fireRate: 0.07,
    magSize: 30,
    reserveSize: 90,
    reloadTime: 2.0,
    spread: 0.012,
    spreadMove: 0.03,
    spreadAds: 0.005,
    recoilPitch: 0.008,
    recoilYaw: 0.004,
    recoilRecover: 10,
    auto: true,
    adsFov: 55,
    adsSpread: 0.005,
    penetration: 0,
  },
  rifle: {
    name: 'AK-7',
    kind: 'rifle',
    price: 2700,
    damage: 38,
    headshotMultiplier: 3.2,
    fireRate: 0.1,
    magSize: 30,
    reserveSize: 90,
    reloadTime: 2.4,
    spread: 0.006,
    spreadMove: 0.04,
    spreadAds: 0.002,
    recoilPitch: 0.018,
    recoilYaw: 0.006,
    recoilRecover: 7,
    auto: true,
    adsFov: 50,
    adsSpread: 0.002,
    penetration: 1,
  },
  sniper: {
    name: 'LR-50',
    kind: 'sniper',
    price: 4750,
    damage: 95,
    headshotMultiplier: 2.0,
    fireRate: 1.2,
    magSize: 5,
    reserveSize: 25,
    reloadTime: 3.2,
    spread: 0.002,
    spreadMove: 0.12,
    spreadAds: 0.0,
    recoilPitch: 0.05,
    recoilYaw: 0.01,
    recoilRecover: 5,
    auto: false,
    adsFov: 20,
    adsSpread: 0.0,
    penetration: 2,
  },
};

export function createWeapon(initialKind = 'pistol') {
  const state = {
    kind: initialKind,
    mag: 0,
    reserve: 0,
    reloadTimer: 0,
    fireCooldown: 0,
    adsAmount: 0,
    recoilPitch: 0,
    recoilYaw: 0,
    lastFireTime: 0,
  };

  function def() {
    return WEAPONS[state.kind];
  }

  function switchTo(kind) {
    state.kind = kind;
    state.mag = WEAPONS[kind].magSize;
    state.reserve = WEAPONS[kind].reserveSize;
    state.reloadTimer = 0;
    state.fireCooldown = 0;
    state.adsAmount = 0;
    state.recoilPitch = 0;
    state.recoilYaw = 0;
  }

  function ready() {
    return state.reloadTimer <= 0 && state.fireCooldown <= 0 && state.mag > 0;
  }

  function takeRound() {
    if (state.mag <= 0 || state.reloadTimer > 0) return false;
    state.mag -= 1;
    state.fireCooldown = def().fireRate;
    return true;
  }

  function reload() {
    const d = def();
    if (state.mag >= d.magSize || state.reserve <= 0 || state.reloadTimer > 0) return;
    state.reloadTimer = d.reloadTime;
  }

  function finishReload() {
    const d = def();
    const needed = d.magSize - state.mag;
    const taken = Math.min(needed, state.reserve);
    state.mag += taken;
    state.reserve -= taken;
    state.reloadTimer = 0;
  }

  function pullTrigger() {
    const d = def();
    state.recoilPitch += d.recoilPitch;
    state.recoilYaw += (Math.random() - 0.5) * d.recoilYaw * 2;
  }

  function step(dt) {
    if (state.reloadTimer > 0) {
      state.reloadTimer -= dt;
      if (state.reloadTimer <= 0) finishReload();
    }
    if (state.fireCooldown > 0) state.fireCooldown -= dt;

    // Recover recoil
    const d = def();
    const recover = d.recoilRecover * dt;
    state.recoilPitch = Math.max(0, state.recoilPitch - state.recoilPitch * recover);
    state.recoilYaw = Math.max(0, state.recoilYaw - state.recoilYaw * recover);
  }

  // Spread based on movement, ADS, crouch
  function currentSpread(isMoving, isCrouching) {
    const d = def();
    let s = d.spread;
    if (isMoving) s += d.spreadMove;
    if (isCrouching) s *= 0.7;
    if (state.adsAmount > 0.5) s = d.adsSpread;
    return s;
  }

  function refill() {
    const d = def();
    state.mag = d.magSize;
    state.reserve = d.reserveSize;
    state.reloadTimer = 0;
    state.fireCooldown = 0;
  }

  return {
    state,
    def,
    switchTo,
    ready,
    takeRound,
    reload,
    pullTrigger,
    step,
    currentSpread,
    refill,
  };
}