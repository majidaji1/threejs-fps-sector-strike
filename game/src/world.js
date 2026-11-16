// Original map: "Sector Delta" — a bomb-defusal layout with two sites (A and B), mid corridor,
// attacker and defender spawns, choke points, crates, and lighting. Layout designed for
// tactical play: sightlines, corners, rotations. Geometry is boxes only, no external assets.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

// Map dimensions: 60m x 60m arena. Y is up, floor at y=0.
const MAP_HALF = 30;

export function createWorld(scene) {
  const colliders = []; // AABB boxes for physics and raycasting
  const shootables = []; // meshes that block bullets (same as colliders, for THREE.Raycaster)

  // Materials
  const matFloor = new THREE.MeshLambertMaterial({ color: new THREE.Color(PALETTE.floor) });
  const matWall = new THREE.MeshLambertMaterial({ color: new THREE.Color(PALETTE.wall) });
  const matWallAccent = new THREE.MeshLambertMaterial({ color: new THREE.Color(PALETTE.wallAccent) });
  const matCeiling = new THREE.MeshLambertMaterial({ color: new THREE.Color(PALETTE.ceiling) });
  const matCrate = new THREE.MeshLambertMaterial({ color: new THREE.Color(PALETTE.crate) });
  const matMetal = new THREE.MeshLambertMaterial({ color: new THREE.Color(PALETTE.metal) });
  const matLight = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.light) });

  function addBox(x, y, z, width, height, depth, material, isShootable = true) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    if (isShootable) {
      mesh.updateMatrixWorld(true);
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox.clone();
      box.applyMatrix4(mesh.matrixWorld);
      colliders.push(box);
      shootables.push(mesh);
    }
    return mesh;
  }

  // Floor
  const floorGeo = new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2);
  const floor = new THREE.Mesh(floorGeo, matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);

  // Outer walls (4)
  addBox(0, 5, -MAP_HALF, MAP_HALF * 2, 10, 1, matWall);
  addBox(0, 5, MAP_HALF, MAP_HALF * 2, 10, 1, matWall);
  addBox(-MAP_HALF, 5, 0, 1, 10, MAP_HALF * 2, matWall);
  addBox(MAP_HALF, 5, 0, 1, 10, MAP_HALF * 2, matWall);

  // Central corridor (mid): two long walls with gaps
  addBox(-6, 3, 0, 1, 6, 24, matWall);
  addBox(6, 3, 0, 1, 6, 24, matWall);

  // Site A building (left side): walls forming a partial enclosure
  addBox(-18, 3, -12, 12, 6, 1, matWallAccent); // north wall
  addBox(-24, 3, -6, 1, 6, 12, matWall);        // west wall
  addBox(-12, 3, -6, 1, 6, 12, matWall);        // east wall (partial, leaves opening)
  addBox(-18, 3, 0, 12, 6, 1, matWallAccent);   // south wall

  // Site A platform (bomb plant zone)
  addBox(-18, 0.5, -6, 6, 1, 6, matMetal);

  // Site B building (right side): mirrored
  addBox(18, 3, -12, 12, 6, 1, matWallAccent);
  addBox(24, 3, -6, 1, 6, 12, matWall);
  addBox(12, 3, -6, 1, 6, 12, matWall);
  addBox(18, 3, 0, 12, 6, 1, matWallAccent);

  // Site B platform
  addBox(18, 0.5, -6, 6, 1, 6, matMetal);

  // Attacker spawn (south): open area
  // Defender spawn (north): open area behind both sites

  // Crates and cover (various sizes, some climbable)
  addBox(-3, 0.75, 8, 1.5, 1.5, 1.5, matCrate);
  addBox(3, 0.75, 8, 1.5, 1.5, 1.5, matCrate);
  addBox(-3, 0.75, -8, 1.5, 1.5, 1.5, matCrate);
  addBox(3, 0.75, -8, 1.5, 1.5, 1.5, matCrate);
  addBox(-10, 0.75, 3, 1.5, 1.5, 1.5, matCrate);
  addBox(10, 0.75, 3, 1.5, 1.5, 1.5, matCrate);
  addBox(-10, 0.75, -3, 1.5, 1.5, 1.5, matCrate);
  addBox(10, 0.75, -3, 1.5, 1.5, 1.5, matCrate);

  // Mid pillars
  addBox(-2, 2, -2, 1, 4, 1, matMetal);
  addBox(2, 2, -2, 1, 4, 1, matMetal);
  addBox(-2, 2, 2, 1, 4, 1, matMetal);
  addBox(2, 2, 2, 1, 4, 1, matMetal);

  // Attacker spawn walls (partial)
  addBox(-10, 3, 22, 10, 6, 1, matWall);
  addBox(10, 3, 22, 10, 6, 1, matWall);

  // Defender spawn walls (partial)
  addBox(-10, 3, -22, 10, 6, 1, matWall);
  addBox(10, 3, -22, 10, 6, 1, matWall);

  // Long sightline walls (rotate cover)
  addBox(-14, 3, 15, 1, 6, 10, matWallAccent);
  addBox(14, 3, 15, 1, 6, 10, matWallAccent);
  addBox(-14, 3, -15, 1, 6, 10, matWallAccent);
  addBox(14, 3, -15, 1, 6, 10, matWallAccent);

  // Lighting: hemisphere + directional (sun) + point lights at key spots
  const hemi = new THREE.HemisphereLight(0xe8e4dc, 0x1a1d22, 0.6);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe8c0, 0.8);
  sun.position.set(20, 30, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  scene.add(sun);

  // Point lights at sites
  const lightA = new THREE.PointLight(0xe8c890, 2, 20);
  lightA.position.set(-18, 8, -6);
  scene.add(lightA);

  const lightB = new THREE.PointLight(0xe8c890, 2, 20);
  lightB.position.set(18, 8, -6);
  scene.add(lightB);

  // Mid overhead light
  const lightMid = new THREE.PointLight(0xe8c890, 1.5, 16);
  lightMid.position.set(0, 8, 0);
  scene.add(lightMid);

  // Spawn points
  const attackerSpawns = [
    new THREE.Vector3(-5, 0, 25),
    new THREE.Vector3(0, 0, 25),
    new THREE.Vector3(5, 0, 25),
    new THREE.Vector3(-8, 0, 23),
    new THREE.Vector3(8, 0, 23),
  ];
  const defenderSpawns = [
    new THREE.Vector3(-5, 0, -25),
    new THREE.Vector3(0, 0, -25),
    new THREE.Vector3(5, 0, -25),
    new THREE.Vector3(-8, 0, -23),
    new THREE.Vector3(8, 0, -23),
  ];

  // Bomb site positions
  const siteA = new THREE.Vector3(-18, 1, -6);
  const siteB = new THREE.Vector3(18, 1, -6);

  // Waypoint graph for bot navigation (simplified: list of key positions)
  const waypoints = [
    // Attacker approach to mid
    new THREE.Vector3(0, 0, 18),
    new THREE.Vector3(0, 0, 10),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(0, 0, -18),
    // Mid to A
    new THREE.Vector3(-8, 0, -6),
    new THREE.Vector3(-14, 0, -6),
    siteA.clone(),
    // Mid to B
    new THREE.Vector3(8, 0, -6),
    new THREE.Vector3(14, 0, -6),
    siteB.clone(),
    // Side routes
    new THREE.Vector3(-18, 0, 12),
    new THREE.Vector3(18, 0, 12),
    new THREE.Vector3(-18, 0, -12),
    new THREE.Vector3(18, 0, -12),
  ];

  return {
    colliders,
    shootables,
    attackerSpawns,
    defenderSpawns,
    siteA,
    siteB,
    waypoints,
  };
}