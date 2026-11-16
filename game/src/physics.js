// Simple box-based physics helpers: raycast against colliders (walls, floors, boxes) and
// characters (capsule approximated as a vertical cylinder). Used for hitscan shooting, bot
// line-of-sight and grenade trajectory.
import * as THREE from 'three';

const raycaster = new THREE.Raycaster();

// Raycast against a list of AABB colliders. Returns the closest hit { point, normal, distance, collider }.
export function raycastBoxes(origin, direction, colliders, maxDistance = 200) {
  let best = null;
  let bestDistance = maxDistance;
  for (const box of colliders) {
    const hit = rayAABB(origin, direction, box, bestDistance);
    if (hit && hit.distance < bestDistance) {
      best = { point: hit.point, normal: hit.normal, distance: hit.distance, collider: box };
      bestDistance = hit.distance;
    }
  }
  return best;
}

function rayAABB(origin, direction, box, maxDistance) {
  const min = box.min;
  const max = box.max;
  let tmin = -Infinity;
  let tmax = Infinity;
  let hitNormal = null;

  for (let axis = 0; axis < 3; axis++) {
    const o = axis === 0 ? origin.x : axis === 1 ? origin.y : origin.z;
    const d = axis === 0 ? direction.x : axis === 1 ? direction.y : direction.z;
    const mn = axis === 0 ? min.x : axis === 1 ? min.y : min.z;
    const mx = axis === 0 ? max.x : axis === 1 ? max.y : max.z;

    if (Math.abs(d) < 1e-8) {
      if (o < mn || o > mx) return null;
    } else {
      let t1 = (mn - o) / d;
      let t2 = (mx - o) / d;
      let sign = -1;
      if (t1 > t2) {
        [t1, t2] = [t2, t1];
        sign = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        hitNormal = new THREE.Vector3();
        hitNormal.setComponent(axis, sign);
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
      if (tmax < 0 || tmin > maxDistance) return null;
    }
  }

  if (tmin < 0) return null;
  const point = new THREE.Vector3();
  point.copy(direction).multiplyScalar(tmin).add(origin);
  return { point, normal: hitNormal, distance: tmin };
}

// Ray vs vertical cylinder (character capsule approximation).
export function raycastCylinder(origin, direction, characterPos, radius, height) {
  const ox = origin.x - characterPos.x;
  const oz = origin.z - characterPos.z;
  const dx = direction.x;
  const dz = direction.z;

  // Solve 2D circle intersection in XZ plane
  const a = dx * dx + dz * dz;
  if (a < 1e-8) return null; // ray is vertical, no XZ component
  const b = 2 * (ox * dx + oz * dz);
  const c = ox * ox + oz * oz - radius * radius;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const sqrtD = Math.sqrt(discriminant);
  let t = (-b - sqrtD) / (2 * a);
  if (t < 0) t = (-b + sqrtD) / (2 * a);
  if (t < 0) return null;

  const point = new THREE.Vector3();
  point.copy(direction).multiplyScalar(t).add(origin);

  // Check Y range
  if (point.y < characterPos.y || point.y > characterPos.y + height) return null;

  return { point, distance: t };
}

// Ray vs sphere (head hitbox).
export function raycastSphere(origin, direction, center, radius) {
  const oc = new THREE.Vector3();
  oc.subVectors(origin, center);
  const a = direction.dot(direction);
  const b = 2 * oc.dot(direction);
  const c = oc.dot(oc) - radius * radius;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const sqrtD = Math.sqrt(discriminant);
  let t = (-b - sqrtD) / (2 * a);
  if (t < 0) t = (-b + sqrtD) / (2 * a);
  if (t < 0) return null;

  const point = new THREE.Vector3();
  point.copy(direction).multiplyScalar(t).add(origin);
  return { point, distance: t };
}

// Combined raycast: boxes (world) + characters (body + head). Returns { type, character, distance, point, isHead }.
export function raycastAll(origin, direction, colliders, characters, maxDistance = 200) {
  let best = null;
  let bestDistance = maxDistance;

  // World boxes
  const boxHit = raycastBoxes(origin, direction, colliders, bestDistance);
  if (boxHit) {
    best = { type: 'world', distance: boxHit.distance, point: boxHit.point };
    bestDistance = boxHit.distance;
  }

  // Characters (body cylinder + head sphere)
  for (const character of characters) {
    if (character.dead) continue;

    // Body: cylinder from feet to neck
    const bodyRadius = character.crouching ? 0.28 : 0.34;
    const bodyHeight = character.crouching ? 1.1 : 1.5;
    const bodyHit = raycastCylinder(origin, direction, character.position, bodyRadius, bodyHeight);
    if (bodyHit && bodyHit.distance < bestDistance) {
      best = { type: 'character', character, distance: bodyHit.distance, point: bodyHit.point, isHead: false };
      bestDistance = bodyHit.distance;
    }

    // Head: sphere at neck+0.2
    const headCenter = new THREE.Vector3(
      character.position.x,
      character.position.y + bodyHeight + 0.18,
      character.position.z,
    );
    const headHit = raycastSphere(origin, direction, headCenter, 0.22);
    if (headHit && headHit.distance < bestDistance) {
      best = { type: 'character', character, distance: headHit.distance, point: headHit.point, isHead: true };
      bestDistance = headHit.distance;
    }
  }

  return best;
}

// Line of sight check: does a ray from A to B hit any world collider?
export function hasLineOfSight(from, to, colliders) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const distance = direction.length();
  direction.normalize();
  const hit = raycastBoxes(from, direction, colliders, distance - 0.1);
  return !hit;
}