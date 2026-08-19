/**
 * The 3D table. Owns the renderer, the tile meshes, and pointer picking.
 *
 * Camera is fixed at a near-isometric angle looking at the player's hand rather
 * than free-orbit: readable faces matter more than freedom here. Users can
 * nudge the angle with drag, but it always eases back toward the reading pose.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { faceTexture } from './textures';
import { playPick } from './audio';

export const TILE_W = 0.78;
export const TILE_H = 1.06;
export const TILE_D = 0.52;

/** Reading pose: high enough to see the discard pool, close enough to read faces. */
const CAM_R = 11.0;
const CAM_Y = 7.8;
const CAM_LOOK_Z = 0.9;
/** Fixed viewing elevation; only the distance changes to fit the content. */
const CAM_ELEV = Math.atan2(CAM_Y, CAM_R);
/** Floor only — the fit normally drives the distance, so small layouts read large. */
const CAM_MIN_DIST = 9.5;

export interface TileHandle {
  mesh: THREE.Mesh;
  id: string;
  /** Index within whatever group it belongs to. */
  index: number;
  group: 'hand' | 'discard' | 'meld' | 'wall';
  target: THREE.Vector3;
  targetRot: THREE.Euler;
  lift: number;
  selected: boolean;
  dim: boolean;
  glow: THREE.Color | null;
}

const geometry = new RoundedBoxGeometry(TILE_W, TILE_H, TILE_D, 3, 0.055);

/** Scratch vector reused inside the per-frame loop to avoid an allocation per tile. */
const TMP_VEC = new THREE.Vector3();

/**
 * Each tile gets its own side/back materials rather than sharing one instance
 * across the whole table — opacity is animated per-tile (for the "dim the
 * others" hint), and a shared material's opacity would get stomped by
 * whichever tile last wrote to it, flickering every tile that uses it.
 */
function materialsFor(id: string): THREE.Material[] {
  const face = new THREE.MeshStandardMaterial({
    map: faceTexture(id),
    roughness: 0.35,
    metalness: 0.0,
  });
  const side = new THREE.MeshStandardMaterial({ color: 0xf3ecd9, roughness: 0.45, metalness: 0.0 });
  const back = new THREE.MeshStandardMaterial({ color: 0x2f9e6b, roughness: 0.55, metalness: 0.02 });
  // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
  return [side, side, side, side, face, back];
}

export class Table {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(-2, -2);
  private tiles: TileHandle[] = [];
  private hovered: TileHandle | null = null;
  private lookZ = CAM_LOOK_Z;
  private yaw = 0;
  private yawTarget = 0;
  private dragging = false;
  private dragged = 0;
  private lastX = 0;
  /**
   * Forces at least one more full update+render pass. Set on any call that
   * changes what the table should look like (layout, marks, clear). Not
   * strictly required for correctness — the per-property epsilon checks in
   * frame() catch essentially everything on their own — but it's a cheap,
   * explicit guarantee that a state change always gets drawn, and it reads
   * as documentation of exactly when a repaint is deliberately requested.
   */
  private dirty = true;

  onTileClick: ((t: TileHandle) => void) | null = null;
  onTileHover: ((t: TileHandle | null) => void) | null = null;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0d3b2e);
    this.scene.fog = new THREE.Fog(0x0d3b2e, 18, 34);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, CAM_Y, CAM_R);
    this.camera.lookAt(0, 0.4, CAM_LOOK_Z);

    this.buildEnvironment();
    this.bindEvents();
    this.resize();

    this.renderer.setAnimationLoop(() => this.frame());
  }

  private buildEnvironment() {
    this.scene.add(new THREE.HemisphereLight(0xdff3ea, 0x0a2b20, 1.05));

    const key = new THREE.DirectionalLight(0xfff6e2, 1.5);
    key.position.set(4, 10, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x9fd8ff, 0.35);
    fill.position.set(-6, 4, 2);
    this.scene.add(fill);

    const felt = new THREE.Mesh(
      new THREE.CircleGeometry(16, 64),
      new THREE.MeshStandardMaterial({ color: 0x11543f, roughness: 0.95 }),
    );
    felt.rotation.x = -Math.PI / 2;
    felt.receiveShadow = true;
    this.scene.add(felt);
  }

  private bindEvents() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';

    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      if (this.dragging) {
        this.dragged += Math.abs(e.clientX - this.lastX);
        this.yawTarget = THREE.MathUtils.clamp(
          this.yawTarget + (e.clientX - this.lastX) * 0.004,
          -0.5,
          0.5,
        );
        this.lastX = e.clientX;
      }
      this.updateHover();
    });

    el.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.dragged = 0;
      this.lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointerup', (e) => {
      this.dragging = false;
      this.yawTarget = 0;
      const r = el.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      this.updateHover();
      // A real drag should look around, not discard whatever it passed over.
      if (this.dragged < 6 && this.hovered && this.onTileClick) this.onTileClick(this.hovered);
    });

    el.addEventListener('pointerleave', () => {
      this.pointer.set(-2, -2);
      this.dragging = false;
    });

    // The container has no height until the stylesheet lands, so a one-shot
    // resize in the constructor would leave the camera at aspect 1 forever.
    new ResizeObserver(() => this.resize()).observe(this.container);
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /* ------------------------------------------------------------- contents -- */

  clear() {
    for (const t of this.tiles) {
      this.scene.remove(t.mesh);
      const mats = t.mesh.material as THREE.Material[];
      // mats[0..3] are the same `side` instance repeated, mats[5] is `back` —
      // dispose each unique material once, not the geometry (still shared).
      new Set(mats).forEach((m) => m.dispose());
    }
    this.tiles = [];
    this.hovered = null;
    this.dirty = true;
  }

  private spawn(id: string, group: TileHandle['group'], index: number): TileHandle {
    const mesh = new THREE.Mesh(geometry, materialsFor(id));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const h: TileHandle = {
      mesh,
      id,
      index,
      group,
      target: new THREE.Vector3(),
      targetRot: new THREE.Euler(),
      lift: 0,
      selected: false,
      dim: false,
      glow: null,
    };
    this.tiles.push(h);
    return h;
  }

  /** Replace everything on the table in one call. */
  setLayout(layout: {
    hand: string[];
    discards?: string[];
    melds?: string[][];
    wall?: number;
  }) {
    this.clear();

    const hand = layout.hand;
    const gap = TILE_W + 0.035;
    const originX = -((hand.length - 1) * gap) / 2;
    hand.forEach((id, i) => {
      const h = this.spawn(id, 'hand', i);
      h.target.set(originX + i * gap, TILE_H / 2, 3.1);
      h.targetRot.set(-0.22, 0, 0);
      h.mesh.position.copy(h.target).add(new THREE.Vector3(0, 6, 0));
      h.mesh.rotation.copy(h.targetRot);
    });

    (layout.melds ?? []).forEach((meld, mi) => {
      meld.forEach((id, i) => {
        const h = this.spawn(id, 'meld', mi);
        h.target.set(4.3 + i * (TILE_W + 0.04), TILE_H / 2, 2.0 - mi * (TILE_D + 0.12));
        h.targetRot.set(-0.18, 0, 0);
        h.mesh.position.copy(h.target).add(new THREE.Vector3(0, 4, 0));
      });
    });

    const discards = layout.discards ?? [];
    const PER_ROW = 8;
    const dGap = TILE_W + 0.06;
    const dOrigin = -((Math.min(discards.length, PER_ROW) - 1) * dGap) / 2;
    discards.forEach((id, i) => {
      const h = this.spawn(id, 'discard', i);
      const col = i % PER_ROW;
      const row = Math.floor(i / PER_ROW);
      h.target.set(dOrigin + col * dGap, TILE_D / 2, -0.7 + row * (TILE_H + 0.08));
      h.targetRot.set(-Math.PI / 2, 0, 0);
      h.mesh.position.copy(h.target).add(new THREE.Vector3(0, 3, 0));
      h.mesh.rotation.copy(h.targetRot);
    });

    // A suggestion of the wall behind the discards, purely for atmosphere.
    const wallLen = Math.round(layout.wall ?? 0);
    const wGap = TILE_W + 0.02;
    const wOrigin = -((wallLen - 1) * wGap) / 2;
    for (let i = 0; i < wallLen; i++) {
      const h = this.spawn('c1', 'wall', i);
      // A wall tile shows its back on every visible face — reuse this tile's
      // own back material for the "face" slot too, and drop the face texture
      // material spawn() made for it so it isn't leaked.
      const mats = h.mesh.material as THREE.Material[];
      mats[4].dispose();
      mats[4] = mats[5];
      h.target.set(wOrigin + i * wGap, TILE_D / 2, -3.3);
      h.targetRot.set(-Math.PI / 2, 0, 0);
      h.mesh.position.copy(h.target);
      h.mesh.rotation.copy(h.targetRot);
    }
  }

  handTiles(): TileHandle[] {
    return this.tiles.filter((t) => t.group === 'hand');
  }

  /** Visually mark hand positions: glow colour, or null to clear. */
  markHand(marks: Record<number, string | null>, dimOthers = false) {
    for (const t of this.handTiles()) {
      const m = marks[t.index];
      t.glow = m ? new THREE.Color(m) : null;
      t.dim = dimOthers && !m;
    }
    this.dirty = true;
  }

  clearMarks() {
    for (const t of this.tiles) {
      t.glow = null;
      t.dim = false;
    }
    this.dirty = true;
  }

  /**
   * Distance that keeps the widest and deepest content on screen. The elevation
   * stays fixed, so a 14-tile hand simply pushes the camera back rather than
   * changing the reading angle.
   */
  private fitDistance(): number {
    let halfW = 0;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const t of this.tiles) {
      halfW = Math.max(halfW, Math.abs(t.target.x) + TILE_W * 0.6);
      minZ = Math.min(minZ, t.target.z);
      maxZ = Math.max(maxZ, t.target.z);
    }
    if (!this.tiles.length) {
      minZ = maxZ = CAM_LOOK_Z;
    }
    // Aim at the middle of the content so a lone hand is not stranded low.
    this.lookZ = (minZ + maxZ) / 2;
    const halfD = (maxZ - minZ) / 2 + TILE_H * 0.7;
    halfW += 0.5;

    const vFov = (this.camera.fov * Math.PI) / 180;
    const tanV = Math.tan(vFov / 2);
    const tanH = tanV * this.camera.aspect;

    // Depth on the table foreshortens by sin(elevation) at this viewing angle.
    // The hand sits nearer than the look-at point, so it needs the extra reach.
    const needW = halfW / tanH + 3.2;
    const needD = (halfD * Math.sin(CAM_ELEV)) / tanV;
    return Math.max(CAM_MIN_DIST, needW, needD);
  }

  /* ---------------------------------------------------------------- frame -- */

  /**
   * Resolve what is under the pointer. Called from the pointer handlers rather
   * than the render loop so a click never depends on a frame having run first
   * (background tabs and reduced-motion contexts throttle rAF).
   */
  private updateHover() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = this.handTiles().map((t) => t.mesh);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    const next = hit ? (this.tiles.find((t) => t.mesh === hit.object) ?? null) : null;
    if (next === this.hovered) return;
    this.hovered = next;
    this.renderer.domElement.style.cursor = next ? 'pointer' : 'default';
    if (next) playPick();
    this.onTileHover?.(next);
  }

  // Below this, a lerp step snaps straight to its target instead of taking
  // another asymptotic sliver of it — otherwise floating-point lerps never
  // quite arrive, and the tile (or camera) technically keeps "moving" by an
  // imperceptible amount forever, which is exactly what forces a re-render
  // every frame even when nothing has actually changed.
  private static readonly POS_EPS = 0.0005;
  private static readonly ROT_EPS = 0.0008;
  private static readonly LIFT_EPS = 0.001;
  private static readonly OPACITY_EPS = 0.003;
  private static readonly EMISSIVE_EPS = 0.01;
  private static readonly CAM_EPS = 0.0008;
  private static readonly BLACK = new THREE.Color(0x000000);

  private frame() {
    let active = this.dirty;
    this.dirty = false;

    for (const t of this.tiles) {
      const wantLift = t === this.hovered || t.selected ? 1 : 0;
      const liftDelta = wantLift - t.lift;
      if (Math.abs(liftDelta) > Table.LIFT_EPS) {
        t.lift += liftDelta * 0.22;
        active = true;
      } else {
        t.lift = wantLift;
      }

      const desiredPos = TMP_VEC.set(
        t.target.x,
        t.target.y + t.lift * 0.34,
        t.target.z - t.lift * 0.16,
      );
      if (t.mesh.position.distanceToSquared(desiredPos) > Table.POS_EPS * Table.POS_EPS) {
        t.mesh.position.lerp(desiredPos, 0.2);
        active = true;
      } else {
        t.mesh.position.copy(desiredPos);
      }

      const rx = t.targetRot.x - t.mesh.rotation.x;
      const ry = t.targetRot.y - t.mesh.rotation.y;
      if (Math.abs(rx) > Table.ROT_EPS || Math.abs(ry) > Table.ROT_EPS) {
        t.mesh.rotation.x += rx * 0.2;
        t.mesh.rotation.y += ry * 0.2;
        active = true;
      } else {
        t.mesh.rotation.x = t.targetRot.x;
        t.mesh.rotation.y = t.targetRot.y;
      }

      const mats = t.mesh.material as THREE.MeshStandardMaterial[];
      const face = mats[4];
      if (face.emissive) {
        const want = t.glow ?? Table.BLACK;
        const ediff =
          Math.abs(face.emissive.r - want.r) +
          Math.abs(face.emissive.g - want.g) +
          Math.abs(face.emissive.b - want.b);
        if (ediff > Table.EMISSIVE_EPS) {
          face.emissive.lerp(want, 0.15);
          active = true;
        } else {
          face.emissive.copy(want);
        }
        const wantIntensity = t.glow ? 0.3 : 0;
        if (face.emissiveIntensity !== wantIntensity) {
          face.emissiveIntensity = wantIntensity;
          active = true;
        }
      }

      const wantOpacity = t.dim ? 0.32 : 1;
      for (const m of mats) {
        const delta = wantOpacity - m.opacity;
        if (Math.abs(delta) > Table.OPACITY_EPS) {
          m.transparent = true;
          m.opacity += delta * 0.18;
          active = true;
        } else if (m.opacity !== wantOpacity) {
          m.opacity = wantOpacity;
        }
      }
    }

    // The camera's target distance/aim are pure functions of the current
    // tile targets, so it's fine to recompute them every frame regardless —
    // it's cheap, and whether that recomputed pose actually differs from
    // where the camera already sits is exactly the "is it moving" question.
    const dist = this.fitDistance();
    const flat = Math.cos(CAM_ELEV) * dist;
    const yawDelta = this.yawTarget - this.yaw;
    if (Math.abs(yawDelta) > Table.CAM_EPS) {
      this.yaw += yawDelta * 0.1;
      active = true;
    } else {
      this.yaw = this.yawTarget;
    }
    const desiredCam = TMP_VEC.set(
      Math.sin(this.yaw) * flat,
      Math.sin(CAM_ELEV) * dist,
      this.lookZ + Math.cos(this.yaw) * flat,
    );
    if (this.camera.position.distanceToSquared(desiredCam) > Table.CAM_EPS * Table.CAM_EPS) {
      this.camera.position.copy(desiredCam);
      this.camera.lookAt(0, 0.4, this.lookZ);
      active = true;
    }

    if (!active) return; // Nothing moved — skip the render, not just the motion.
    this.renderer.render(this.scene, this.camera);
  }
}
