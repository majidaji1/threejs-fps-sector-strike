// Bot AI: patrol waypoints, detect enemies via line-of-sight, aim and fire, take damage, die,
// react to sounds. Bots are simple but tactical: hold positions, peek, engage when they see.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { hasLineOfSight, raycastAll } from './physics.js';
import { WEAPONS } from './weapon.js';

const BOT_SPEED = 4.5;
const BOT_CROUCH_SPEED = 2.0;
const BOT_VIEW_DISTANCE = 40;
const BOT_FIELD_OF_VIEW = Math.PI * 0.7; // ~126 degrees
const BOT_REACTION_TIME = 0.35; // seconds to aim before firing
const BOT_ACCURACY = 0.65; // chance to hit per shot
const BOT_FIRE_RATE = 0.12;

let nextBotId = 0;

export function createBot(scene, colliders, team, position, difficulty = 0.5) {
  const id = nextBotId++;

  // Visual: a capsule body + head sphere, colored by team.
  const bodyGeo = new THREE.CylinderGeometry(0.34, 0.34, 1.5, 12);
  const headGeo = new THREE.SphereGeometry(0.22, 12, 12);
  const teamColor = new THREE.Color(team === 'T' ? PALETTE.tColor : PALETTE.ctColor);

  const bodyMat = new THREE.MeshLambertMaterial({ color: teamColor });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.copy(position);
  bodyMesh.position.y += 0.75;
  bodyMesh.castShadow = true;
  scene.add(bodyMesh);

  const headMat = new THREE.MeshLambertMaterial({ color: teamColor.clone().multiplyScalar(1.2) });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.position.copy(bodyMesh.position);
  headMesh.position.y += 0.85;
  headMesh.castShadow = true;
  scene.add(headMesh);

  const bot = {
    id,
    team,
    position: position.clone(),
    yaw: 0,
    pitch: 0,
    health: 100,
    armor: 0,
    dead: false,
    crouching: false,
    weapon: 'rifle',
    ammo: WEAPONS.rifle.magSize,
    // AI state
    aiState: 'patrol', // patrol | engage | hold
    patrolTarget: null,
    patrolIndex: 0,
    reactionTimer: 0,
    fireTimer: 0,
    targetEnemy: null,
    lastSeenEnemyPos: null,
    path: [],
    pathIndex: 0,
    // Visual refs
    bodyMesh,
    headMesh,
    // Movement
    velocity: new THREE.Vector3(),
  };

  function findPatrolTarget(waypoints) {
    // Pick a random waypoint, prefer ones in our half of the map
    const half = team === 'T' ? 1 : -1; // T comes from south (+z), CT from north (-z)
    const valid = waypoints.filter((wp) => Math.sign(wp.z) === half || Math.abs(wp.z) < 5);
    if (valid.length === 0) return waypoints[0];
    return valid[Math.floor(Math.random() * valid.length)];
  }

  function seeEnemy(enemyPos, colliders) {
    const eyePos = new THREE.Vector3(
      bot.position.x,
      bot.position.y + (bot.crouching ? 1.1 : 1.5),
      bot.position.z,
    );
    const enemyEye = new THREE.Vector3(enemyPos.x, enemyPos.y + 1.5, enemyPos.z);
    const direction = new THREE.Vector3().subVectors(enemyEye, eyePos);
    const distance = direction.length();
    direction.normalize();

    if (distance > BOT_VIEW_DISTANCE) return false;

    // FOV check
    const forward = new THREE.Vector3(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw));
    const dot = forward.dot(new THREE.Vector3(direction.x, 0, direction.z).normalize());
    if (dot < Math.cos(BOT_FIELD_OF_VIEW / 2)) return false;

    // Line of sight
    return hasLineOfSight(eyePos, enemyEye, colliders);
  }

  function aimAt(point) {
    const eyePos = new THREE.Vector3(
      bot.position.x,
      bot.position.y + (bot.crouching ? 1.1 : 1.5),
      bot.position.z,
    );
    const dx = point.x - eyePos.x;
    const dy = point.y - eyePos.y;
    const dz = point.z - eyePos.z;
    const length = Math.hypot(dx, dy, dz) || 1;
    bot.yaw = Math.atan2(-dx, -dz);
    bot.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  }

  function fire(weapons, characters, colliders, onHit) {
    const dir = new THREE.Vector3(
      -Math.sin(bot.yaw) * Math.cos(bot.pitch),
      Math.sin(bot.pitch),
      -Math.cos(bot.yaw) * Math.cos(bot.pitch),
    );
    dir.normalize();

    // Accuracy: add spread based on difficulty
    const spread = (1 - BOT_ACCURACY) * 0.05;
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();

    const origin = new THREE.Vector3(
      bot.position.x,
      bot.position.y + (bot.crouching ? 1.1 : 1.5),
      bot.position.z,
    );

    const weaponDef = WEAPONS[bot.weapon];
    const hit = raycastAll(origin, dir, colliders, characters, 100);
    if (hit && hit.type === 'character') {
      const damage = hit.isHead
        ? weaponDef.damage * weaponDef.headshotMultiplier
        : weaponDef.damage;
      onHit(hit.character, damage, hit.isHead, bot);
    }

    bot.ammo -= 1;
    bot.fireTimer = BOT_FIRE_RATE;
  }

  function takeDamage(amount, isHead) {
    if (bot.dead) return;
    // Armor absorbs some damage
    let finalDamage = amount;
    if (bot.armor > 0) {
      const absorbed = Math.min(bot.armor, amount * 0.5);
      bot.armor -= absorbed;
      finalDamage = amount - absorbed;
    }
    bot.health -= finalDamage;
    if (bot.health <= 0) {
      bot.health = 0;
      bot.dead = true;
      bot.bodyMesh.visible = false;
      bot.headMesh.visible = false;
    }
  }

  function respawn(position) {
    bot.position.copy(position);
    bot.health = 100;
    bot.armor = 0;
    bot.dead = false;
    bot.ammo = WEAPONS[bot.weapon].magSize;
    bot.aiState = 'patrol';
    bot.targetEnemy = null;
    bot.bodyMesh.visible = true;
    bot.headMesh.visible = true;
    bot.bodyMesh.position.copy(bot.position);
    bot.headMesh.position.copy(bot.position);
  }

  function step(dt, enemies, allCharacters, colliders, waypoints, onHit) {
    if (bot.dead) return;

    // Detect enemies
    let visibleEnemy = null;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (seeEnemy(enemy.position, colliders)) {
        visibleEnemy = enemy;
        break;
      }
    }

    if (visibleEnemy) {
      if (bot.aiState !== 'engage') {
        bot.aiState = 'engage';
        bot.reactionTimer = BOT_REACTION_TIME * (1 - difficulty * 0.5);
      }
      bot.targetEnemy = visibleEnemy;
      bot.lastSeenEnemyPos = visibleEnemy.position.clone();

      // Aim at enemy (with some tracking delay)
      if (bot.reactionTimer > 0) {
        bot.reactionTimer -= dt;
        // Slowly turn toward enemy
        const targetYaw = Math.atan2(
          -(visibleEnemy.position.x - bot.position.x),
          -(visibleEnemy.position.z - bot.position.z),
        );
        bot.yaw += (targetYaw - bot.yaw) * Math.min(1, dt * 3);
      } else {
        // Aim at chest height
        const aimPoint = new THREE.Vector3(
          visibleEnemy.position.x,
          visibleEnemy.position.y + 1.2,
          visibleEnemy.position.z,
        );
        aimAt(aimPoint);

        // Fire
        if (bot.fireTimer <= 0 && bot.ammo > 0) {
          fire(weapons, allCharacters, colliders, onHit);
        }
      }
    } else {
      // Lost enemy
      if (bot.aiState === 'engage') {
        bot.aiState = 'patrol';
        bot.targetEnemy = null;
        if (bot.lastSeenEnemyPos) {
          // Investigate last seen position briefly
          bot.patrolTarget = bot.lastSeenEnemyPos;
          bot.path = [bot.lastSeenEnemyPos];
          bot.pathIndex = 0;
        }
      }

      // Patrol
      if (!bot.patrolTarget || bot.path.length === 0 || bot.pathIndex >= bot.path.length) {
        const target = findPatrolTarget(waypoints);
        bot.patrolTarget = target;
        // Simple path: go direct (bots ignore complex pathfinding for simplicity)
        bot.path = [target];
        bot.pathIndex = 0;
      }

      // Move toward patrol target
      if (bot.pathIndex < bot.path.length) {
        const target = bot.path[bot.pathIndex];
        const direction = new THREE.Vector3().subVectors(target, bot.position);
        direction.y = 0;
        const distance = direction.length();

        if (distance < 1.0) {
          bot.pathIndex++;
        } else {
          direction.normalize();
          const speed = bot.crouching ? BOT_CROUCH_SPEED : BOT_SPEED;
          bot.velocity.x = direction.x * speed;
          bot.velocity.z = direction.z * speed;
          // Face movement direction
          const targetYaw = Math.atan2(-direction.x, -direction.z);
          bot.yaw += (targetYaw - bot.yaw) * Math.min(1, dt * 5);
        }
      }
    }

    // Reload
    if (bot.ammo <= 0) {
      // Simple reload timer
      bot.fireTimer += dt;
      if (bot.fireTimer > 3.0) {
        bot.ammo = WEAPONS[bot.weapon].magSize;
        bot.fireTimer = 0;
      }
    } else if (bot.fireTimer > 0) {
      bot.fireTimer -= dt;
    }

    // Apply movement
    bot.position.x += bot.velocity.x * dt;
    bot.position.z += bot.velocity.z * dt;
    bot.velocity.x *= 0.85; // friction
    bot.velocity.z *= 0.85;

    // Simple collision: stay in bounds
    bot.position.x = Math.max(-29, Math.min(29, bot.position.x));
    bot.position.z = Math.max(-29, Math.min(29, bot.position.z));

    // Update visual
    bot.bodyMesh.position.set(bot.position.x, bot.position.y + 0.75, bot.position.z);
    bot.headMesh.position.set(
      bot.position.x - Math.sin(bot.yaw) * 0.1,
      bot.position.y + 1.6,
      bot.position.z - Math.cos(bot.yaw) * 0.1,
    );
    bot.bodyMesh.rotation.y = bot.yaw;
  }

  return {
    ...bot,
    step,
    takeDamage,
    respawn,
    seeEnemy,
  };
}

export function createBots(scene, colliders, team, spawnPoints, waypoints, count = 4, difficulty = 0.5) {
  const bots = [];
  for (let i = 0; i < count; i++) {
    const spawnIndex = i % spawnPoints.length;
    const bot = createBot(scene, colliders, team, spawnPoints[spawnIndex], difficulty);
    bots.push(bot);
  }
  return bots;
}