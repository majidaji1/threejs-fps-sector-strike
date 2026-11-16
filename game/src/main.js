// Sector Strike — main game loop. Fixed 60Hz simulation, render at display rate. Glues world,
// player, bots, weapons, rounds, HUD, buy menu. Player is Team T (attacker), bots fill both teams.
// ?shot=start|play|plant|end sets up a deterministic frame for screenshot capture.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapon, WEAPONS } from './weapon.js';
import { createBot, createBots } from './bot.js';
import { createRound } from './rounds.js';
import { createHud } from './hud.js';
import { createBuyMenu, BUY_ITEMS } from './buyMenu.js';
import { raycastAll } from './physics.js';

const FIXED_STEP = 1 / 60;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

// Scene + camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.sky), 30, 60);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 150);
scene.add(camera);

// World
const world = createWorld(scene);

// Player
const player = createPlayer(world.colliders);
const playerBody = player.state;

// Weapons
const weapon = createWeapon('pistol');

// Bots (enemy team CT: 5 bots, friendly T: 4 bots)
const enemyBots = createBots(scene, world.colliders, 'CT', world.defenderSpawns, world.waypoints, 5, 0.5);
const friendlyBots = createBots(scene, world.colliders, 'T', world.attackerSpawns, world.waypoints, 4, 0.5);
const allBots = [...enemyBots, ...friendlyBots];

// All characters (player + bots) for raycasting
function getAllCharacters() {
  return [
    { position: playerBody.position, dead: false, crouching: playerBody.crouching, isPlayer: true, team: 'T' },
    ...allBots,
  ];
}

// Input
const input = createInput(renderer.domElement, onLockChange);

// HUD
const hud = createHud();

// Buy menu
const buyMenu = createBuyMenu(hud);

// Round
const round = createRound(world, 'T');
const roundState = round.state;

// Raycaster for player shooting
const raycaster = new THREE.Raycaster();
raycaster.far = 100;
const direction = new THREE.Vector3();

// Game state
let started = false;
let frozen = false;
let accumulator = 0;
let lastTime = performance.now();
let elapsed = 0;
const ownedItems = new Set(['pistol']);

// Init HUD
hud.setAmmo(weapon.state.mag, weapon.state.reserve);
hud.setHealth(100);
hud.setMoney(roundState.money);
hud.setScore(0);
hud.setRoundInfo('T', 'attacking');
hud.setObjective('Plant bomb at Site A or B');

hud.onStartPlay(() => {
  if (shot) return;
  if (!started) {
    started = true;
    round.startRound();
    round.startPlayPhase();
    hud.hideStart();
    input.requestLock();
  }
});

hud.onResultNext(() => {
  hud.hideResult();
  round.startRound();
  round.startPlayPhase();
  // Respawn player
  const spawn = world.attackerSpawns[0];
  playerBody.position.copy(spawn);
  playerBody.velocity.set(0, 0, 0);
  playerBody.health = 100;
  // Respawn bots
  for (let i = 0; i < enemyBots.length; i++) {
    enemyBots[i].respawn(world.defenderSpawns[i % world.defenderSpawns.length]);
  }
  for (let i = 0; i < friendlyBots.length; i++) {
    friendlyBots[i].respawn(world.attackerSpawns[(i + 1) % world.attackerSpawns.length]);
  }
  hud.showBuyMenu(roundState.money);
  buyMenu.state.open = true;
  buyMenu.render(roundState.money, ownedItems, handleBuy);
});

function handleBuy(itemId) {
  const result = buyMenu.purchase(itemId, roundState.money);
  if (!result) return;
  const { item, cost } = result;
  roundState.money -= cost;

  if (item.kind === 'weapon') {
    weapon.switchTo(item.weapon);
    ownedItems.add(item.id);
  } else if (item.id === 'armor') {
    playerArmor = item.armor;
    ownedItems.add(item.id);
  } else if (item.grenade) {
    playerGrenades++;
    ownedItems.add(item.id);
  }

  hud.setMoney(roundState.money);
  buyMenu.render(roundState.money, ownedItems, handleBuy);
}

let playerArmor = 0;
let playerGrenades = 0;

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideStart();
  }
}

function syncCamera() {
  const eye = playerBody.crouching ? 1.02 : 1.6;
  camera.position.set(
    playerBody.position.x,
    playerBody.position.y + eye,
    playerBody.position.z,
  );
  // Apply recoil
  camera.rotation.set(
    playerBody.pitch - weapon.state.recoilPitch,
    playerBody.yaw - weapon.state.recoilYaw,
    0,
    'YXZ',
  );

  // ADS zoom
  const def = weapon.def();
  const targetFov = weapon.state.adsAmount > 0.5 ? def.adsFov : 74;
  camera.fov += (targetFov - camera.fov) * 0.3;
  camera.updateProjectionMatrix();
}

function playerShoot() {
  if (!weapon.ready()) return;

  const isMoving = player.groundSpeed() > 0.5;
  const isCrouching = playerBody.crouching;
  const spread = weapon.currentSpread(isMoving, isCrouching);

  if (!weapon.takeRound()) return;

  camera.getWorldDirection(direction);
  direction.x += (random() * 2 - 1) * spread;
  direction.y += (random() * 2 - 1) * spread;
  direction.z += (random() * 2 - 1) * spread;
  direction.normalize();

  scene.updateMatrixWorld(true);
  const characters = getAllCharacters();
  // Exclude player from hitscan
  const enemiesOnly = characters.filter((c) => !c.isPlayer && c.team !== 'T');
  const hit = raycastAll(camera.position, direction, world.colliders, enemiesOnly, 100);

  if (hit && hit.type === 'character') {
    const def = weapon.def();
    const damage = hit.isHead ? def.damage * def.headshotMultiplier : def.damage;
    hit.character.takeDamage?.(damage, hit.isHead);
    hud.hitMarker();
    if (hit.character.dead) {
      roundState.kills++;
      hud.setScore(roundState.kills * 100);
      hud.addKillFeed(`You eliminated ${hit.character.id} ${hit.isHead ? '(headshot)' : ''}`);
    }
  }

  weapon.pullTrigger();
  player.recoil(
    weapon.def().recoilPitch + random() * 0.004,
    (random() * 2 - 1) * weapon.def().recoilYaw,
  );
  hud.setAmmo(weapon.state.mag, weapon.state.reserve);
}

function onPlayerDeath() {
  roundState.deaths++;
  hud.addKillFeed('You were eliminated');
  // Respawn in 3s (simplified: instant respawn for now)
  const spawn = world.attackerSpawns[0];
  playerBody.position.copy(spawn);
  playerBody.velocity.set(0, 0, 0);
}

function step(dt) {
  elapsed += dt;

  // Round logic
  const aliveT = (playerBody.health > 0 ? 1 : 0) + friendlyBots.filter((b) => !b.dead).length;
  const aliveCT = enemyBots.filter((b) => !b.dead).length;
  round.step(dt, aliveT, aliveCT);

  // Round end
  if (roundState.phase === 'end' && !roundState.winner === false) {
    const winnerText = roundState.winner === 'T' ? 'Attackers win' : 'Defenders win';
    hud.showResult({
      title: 'Round Complete',
      subtitle: winnerText,
      kills: roundState.kills,
      deaths: roundState.deaths,
      objective: roundState.lastObjective,
      earnings: roundState.earnings,
    });
    if (document.pointerLockElement) document.exitPointerLock();
    return;
  }

  // Player movement + input
  if (started && playerBody.health > 0) {
    player.step(dt, input.state.keys);

    // Look
    const look = input.takeLook();
    player.look(look.x, look.y);

    // Fire
    if (input.state.firing && weapon.ready()) {
      playerShoot();
    }

    // ADS
    const adsTarget = input.state.ads ? 1 : 0;
    weapon.state.adsAmount += (adsTarget - weapon.state.adsAmount) * 0.2;

    // Reload
    if (input.state.keys.has('KeyR')) weapon.reload();

    // Buy menu toggle
    if (input.state.buyPressed) {
      input.state.buyPressed = false;
      if (roundState.phase === 'buy') {
        buyMenu.toggle();
        buyMenu.render(roundState.money, ownedItems, handleBuy);
      }
    }

    // Weapon cycle
    if (input.state.wheel !== 0) {
      input.state.wheel = 0;
    }

    // Objective: plant bomb (T team, near site)
    if (roundState.phase === 'play' && !roundState.bombPlanted) {
      const nearA = playerBody.position.distanceTo(world.siteA) < 3;
      const nearB = playerBody.position.distanceTo(world.siteB) < 3;
      if ((nearA || nearB) && input.state.usePressed) {
        input.state.usePressed = false;
        const site = nearA ? world.siteA : world.siteB;
        round.plantBomb(site);
        hud.setObjective('Defend the bomb!');
        hud.addKillFeed('Bomb planted!');
      } else if (nearA || nearB) {
        hud.setObjective('Press F to plant bomb');
      } else {
        hud.setObjective('Plant bomb at Site A or B');
      }
    }

    // Defuse (CT bot logic would go here; for player T team, skip)
  }

  // Weapon step
  weapon.step(dt);

  // Bots step
  const enemiesForPlayer = enemyBots;
  const allCharacters = getAllCharacters();

  // Friendly bots attack CT bots
  for (const bot of friendlyBots) {
    bot.step(dt, enemyBots, allCharacters, world.colliders, world.waypoints, (target, damage, isHead, shooter) => {
      target.takeDamage(damage, isHead);
      if (target.dead) {
        hud.addKillFeed(`Friendly eliminated enemy ${isHead ? '(headshot)' : ''}`);
      }
    });
  }

  // Enemy bots attack player + friendly bots
  for (const bot of enemyBots) {
    const targets = [allCharacters[0], ...friendlyBots];
    bot.step(dt, targets, allCharacters, world.colliders, world.waypoints, (target, damage, isHead, shooter) => {
      if (target.isPlayer) {
        // Player takes damage
        if (playerArmor > 0) {
          const absorbed = Math.min(playerArmor, damage * 0.5);
          playerArmor -= absorbed;
          damage -= absorbed;
        }
        playerBody.health -= damage;
        hud.setHealth(playerBody.health);
        if (playerBody.health <= 0) {
          playerBody.health = 0;
          onPlayerDeath();
        }
      } else {
        target.takeDamage(damage, isHead);
        if (target.dead) {
          hud.addKillFeed(`Enemy eliminated friendly ${isHead ? '(headshot)' : ''}`);
        }
      }
    });
  }

  // Buy menu step
  buyMenu.step(dt);

  // HUD updates
  if (roundState.phase !== 'end') {
    hud.setTimer(roundState.bombPlanted ? roundState.bombTimer : roundState.timer);
    hud.setMoney(roundState.money);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (!frozen) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
  }

  renderer.render(scene, camera);
}

// Screenshot capture mode (?shot=start|play|plant|end)
function settle(steps) {
  for (let i = 0; i < steps; i++) step(FIXED_STEP);
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

function runShot(name) {
  hud.hideStart();
  started = true;
  round.startRound();
  round.startPlayPhase();

  // Position player based on shot type
  if (name === 'start') {
    playerBody.position.set(0, 0, 22);
    playerBody.yaw = 0;
    playerBody.pitch = -0.1;
    weapon.switchTo('rifle');
    hud.setObjective('Plant bomb at Site A or B');
    settle(30);
  } else if (name === 'play') {
    playerBody.position.set(0, 0, 12);
    playerBody.yaw = 0;
    playerBody.pitch = -0.05;
    weapon.switchTo('rifle');
    settle(60);
    // Aim toward a bot
    if (enemyBots.length > 0) {
      const bot = enemyBots[0];
      const dx = bot.position.x - playerBody.position.x;
      const dz = bot.position.z - playerBody.position.z;
      playerBody.yaw = Math.atan2(-dx, -dz);
    }
    hud.setObjective('Plant bomb at Site A or B');
    settle(30);
  } else if (name === 'plant') {
    playerBody.position.set(-18, 1, -6);
    playerBody.yaw = 0;
    playerBody.pitch = -0.2;
    weapon.switchTo('rifle');
    settle(30);
    hud.setObjective('Bomb planted!');
    hud.addKillFeed('Bomb planted!');
    settle(30);
  } else if (name === 'end') {
    playerBody.position.set(-18, 1, -6);
    playerBody.yaw = Math.PI / 4;
    playerBody.pitch = -0.1;
    weapon.switchTo('rifle');
    settle(30);
    hud.showResult({
      title: 'Round Complete',
      subtitle: 'Attackers win',
      kills: 3,
      deaths: 1,
      objective: 'Bomb exploded',
      earnings: 4200,
    });
    settle(10);
  }

  hud.setScore(roundState.kills * 100);
  hud.setAmmo(weapon.state.mag, weapon.state.reserve);
  hud.setHealth(playerBody.health || 100);
  hud.setMoney(roundState.money);
  paintTwiceThenReady();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
if (shot) runShot(shot);
else requestAnimationFrame(frame);