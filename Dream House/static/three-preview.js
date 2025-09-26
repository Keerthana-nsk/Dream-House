// three-preview.js  (ES module)
// Basic 3D preview: walls as boxes, roof as pyramid, orbit controls
// Exposes window.renderThree(layout, color) and handles resizing & updates.

import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.152.2/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let container = document.getElementById('threeContainer');
let houseGroup = null;

function initThree() {
  if (scene) return; // already initialized
  scene = new THREE.Scene();
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 420;

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
  camera.position.set(12, 10, 16);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
  container.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 1, 0);

  // Light
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
  hemi.position.set(0, 20, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(-5, 10, 5);
  scene.add(dir);

  // Ground plane
  const groundMat = new THREE.MeshPhongMaterial({ color: 0xf0f0f0, depthWrite: true });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  // simple grid
  const grid = new THREE.GridHelper(40, 40, 0xdddddd, 0xeeeeee);
  scene.add(grid);

  window.addEventListener('resize', onWindowResize);
  animate();
}

function onWindowResize() {
  if (!renderer) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function clearHouse() {
  if (houseGroup) {
    scene.remove(houseGroup);
    houseGroup.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    houseGroup = null;
  }
}

// simple function to map layout rooms to 3D boxes
function buildHouse(layout, colorHex = '#8fbf8f') {
  clearHouse();
  houseGroup = new THREE.Group();
  houseGroup.name = 'house';

  // conversion scale: each 'unit' -> meters (arbitrary)
  const unit = 1.6; // make rooms visible - scale factor
  const roomHeight = 2.6; // wall height in meters

  // layout.rooms is an array of {type, id, w?, h?}
  const rooms = layout.rooms || [];
  // Place rooms in a nice arrangement: row-major with up to 3 per row (similar to SVG logic)
  const cols = 3;
  const perCol = Math.ceil(Math.max(1, rooms.length) / cols);

  const gap = 0.4; // gap between rooms
  let i = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < perCol; r++) {
      if (i >= rooms.length) break;
      const room = rooms[i];
      // base width/height (if provided) else defaults by type
      let rw = (room.w || (room.type === 'Hall' ? 4 : room.type === 'Bedroom' ? 3.5 : room.type === 'Kitchen' ? 3 : 2)) * unit;
      let rd = (room.h || (room.type === 'Hall' ? 4 : room.type === 'Bedroom' ? 3 : room.type === 'Kitchen' ? 3 : 2)) * unit;

      const x = c * (rw + gap + 0.2);
      const z = r * (rd + gap + 0.2);

      // box geometry: width (x), height (y), depth (z)
      const boxGeom = new THREE.BoxGeometry(rw, roomHeight, rd);
      const mat = new THREE.MeshPhongMaterial({ color: colorHex, side: THREE.DoubleSide });
      const box = new THREE.Mesh(boxGeom, mat);
      // place on ground (y = roomHeight/2)
      box.position.set(x, roomHeight / 2, z);
      box.userData = { type: room.type, id: room.id };
      houseGroup.add(box);

      // add label as a sprite
      const label = makeTextSprite(`${room.type}`, { fontsize: 36, borderColor: { r: 0, g: 0, b: 0, a: 0.6 }, backgroundColor: { r: 255, g: 255, b: 255, a: 0.0 } });
      label.position.set(x, roomHeight + 0.2, z);
      houseGroup.add(label);

      i++;
    }
  }

  // extras (garden/parking) add as flat patches
  const extras = layout.extras || [];
  let extraX = - (unit * 1.5);
  extras.forEach((ex) => {
    if (ex.type === 'Garden') {
      const gGeom = new THREE.PlaneGeometry(6 * unit, 4 * unit);
      const gMat = new THREE.MeshPhongMaterial({ color: 0x88cc77, side: THREE.DoubleSide });
      const gMesh = new THREE.Mesh(gGeom, gMat);
      gMesh.rotation.x = -Math.PI / 2;
      gMesh.position.set(extraX, 0.01, -2);
      houseGroup.add(gMesh);
    } else if (ex.type === 'Parking') {
      const pGeom = new THREE.PlaneGeometry(4 * unit, 3 * unit);
      const pMat = new THREE.MeshPhongMaterial({ color: 0xdddddd, side: THREE.DoubleSide });
      const pMesh = new THREE.Mesh(pGeom, pMat);
      pMesh.rotation.x = -Math.PI / 2;
      pMesh.position.set(extraX, 0.01, 2);
      houseGroup.add(pMesh);
    } else if (ex.type === 'Balcony') {
      const bGeom = new THREE.PlaneGeometry(2 * unit, 1.2 * unit);
      const bMat = new THREE.MeshPhongMaterial({ color: 0xeeddaa, side: THREE.DoubleSide });
      const bMesh = new THREE.Mesh(bGeom, bMat);
      bMesh.rotation.x = -Math.PI / 2;
      bMesh.position.set(extraX, 0.01, 0);
      houseGroup.add(bMesh);
    }
    extraX -= 4 * unit;
  });

  // Create a simple roof covering the whole group bounding box
  // compute bounding box of houseGroup children
  const bbox = new THREE.Box3().setFromObject(houseGroup);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const center = new THREE.Vector3();
  bbox.getCenter(center);

  // roof: pyramid using ConeGeometry with 4 radial segments (square pyramid)
  const roofWidth = Math.max(size.x, 1.5);
  const roofDepth = Math.max(size.z, 1.5);
  const roofHeight = Math.max(1.2, Math.min(roofWidth, roofDepth) * 0.35);

  // create pyramid approximated by a cone with 4 segments
  const roofGeom = new THREE.ConeGeometry(Math.max(roofWidth, roofDepth) * 0.6, roofHeight, 4);
  const roofMat = new THREE.MeshPhongMaterial({ color: 0xb5651d, flatShading: true });
  const roof = new THREE.Mesh(roofGeom, roofMat);

  // align pyramid to sit centered and rotated 45 degrees so square base aligns with boxes
  roof.rotation.y = Math.PI / 4;
  roof.position.set(center.x, bbox.max.y + roofHeight / 2 - 0.1, center.z);
  houseGroup.add(roof);

  // slightly center houseGroup for nicer view
  houseGroup.position.set(-center.x, 0, -center.z);

  scene.add(houseGroup);

  // adjust camera to fit
  fitCameraToObject(camera, houseGroup, 1.6, controls);
}

function fitCameraToObject(camera, object, offset = 1.25, controlsLocal) {
  const boundingBox = new THREE.Box3();
  boundingBox.setFromObject(object);

  const center = new THREE.Vector3();
  boundingBox.getCenter(center);

  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2)); // rough heuristic
  cameraZ *= offset;

  camera.position.set(center.x + cameraZ, center.y + cameraZ / 3, center.z + cameraZ);
  camera.lookAt(center);

  if (controlsLocal) {
    controlsLocal.target.copy(center);
    controlsLocal.update();
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer) renderer.render(scene, camera);
}

// small helper: make text sprite
function makeTextSprite(message, parameters) {
  if (parameters === undefined) parameters = {};
  const fontface = parameters.fontface || 'Arial';
  const fontsize = parameters.fontsize || 18;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = fontsize + "px " + fontface;
  const metrics = context.measureText(message);
  const textWidth = metrics.width;

  canvas.width = textWidth + 20;
  canvas.height = fontsize + 20;
  // background
  context.fillStyle = "rgba(255,255,255,0.0)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  // text
  context.fillStyle = "rgba(0,0,0,1.0)";
  context.fillText(message, 10, fontsize + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: true });
  const sprite = new THREE.Sprite(spriteMaterial);
  const scaleFactor = 0.01;
  sprite.scale.set(canvas.width * scaleFactor, canvas.height * scaleFactor, 1);
  return sprite;
}

// Public function to render a layout
window.renderThree = function (layout, colorHex = '#8fbf8f') {
  initThree();
  // if no layout or empty, clear
  if (!layout || !layout.rooms) {
    clearHouse();
    return;
  }
  buildHouse(layout, colorHex);
};
