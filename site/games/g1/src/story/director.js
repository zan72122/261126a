import * as THREE from '../../lib/three.module.js';
import {
  BOARD_POS,
  HOME_GIRL_POS,
  HOME_PUPPY_POS,
  LAKE_PIER_POS,
  LAKE_POS,
  LAKE_WATER_Y,
  LOOKOUT_POS,
  SIDETRACK_POS,
  SUMMIT_POS,
  VILLAGE_POS,
} from '../core/env.js';
import { clamp, lerp, smoothstep, wrapAngle } from '../core/math.js';
import { heightAt } from '../world/terrain.js';
import { CameraRig, fitShot } from './camera.js';

const _p = new THREE.Vector3();
const _pF = new THREE.Vector3();
const _pR = new THREE.Vector3();
const _t = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const RAIL_HEAD_OFFSET = 0.15;

// Gentle scenic corridor waypoints guiding the Golden Steam Wind toward Cloud Summit Station
const ASSIST_WAYPOINTS = [
  new THREE.Vector3(31.0, 3.2, -58.0),
  new THREE.Vector3(-22.0, 5.0, -180.0),
  new THREE.Vector3(36.0, 24.5, -268.0),
  new THREE.Vector3(40.0, 36.5, -334.0),
  new THREE.Vector3(4.0, 58.0, -374.0),
  new THREE.Vector3(SUMMIT_POS.x + 1.5, SUMMIT_POS.y + 0.15, SUMMIT_POS.z + 1.0),
];

/**
 * Story & Gameplay Director:
 * - home / board: free tap-to-walk (ground or sky) & drag-to-walk in the garden with puppy following;
 *   tapping puppy, ticket, or locomotive (or walking up to the train) smoothly boards;
 *   gentle visual cues + 16s idle lead (immediately overridden if the player touches).
 * - ride: full 3D free locomotive piloting with one-finger drag/hold (left/right yaw, up/down climb/descend,
 *   off-rail sky flight on glowing steam rails, valley/lake/village landing).
 *   Releasing the finger (or vague tapping) activates the visible Golden Steam Wind toward Cloud Summit,
 *   which is immediately overridden whenever the player drags/holds.
 * - float: slow sunlit umbrella descent from any height, keeping the girl large and centered.
 * - walk: free on-foot exploration anywhere on valley/lake/village ground, with smooth train call & reboard.
 * - summit: arrival at Cloud Summit Station overlooking the cloud sea & puppy family reunion.
 */
export class Director {
  constructor(game) {
    this.g = game;
    this.rig = new CameraRig(game.camera);
    this.ray = new THREE.Raycaster();

    this.state = 'home';
    this.phase = 'waitPuppy';
    this.stateT = 0;
    this.phaseT = 0;
    this.idleTimer = 0;
    this.lastProgressDist = Infinity;

    this.segId = 'seg0_home_village';
    this.segS = 0.19;
    this.speed = 0;
    this.targetSpeed = 8.5;
    this.locoVel = new THREE.Vector3();
    this.locoClimbVel = 0;
    this.locoGrounded = true;
    this.skyTrailDist = 0;
    this.releaseCoastT = 0;
    this.assistAlpha = 0;
    this.locoCallActive = false;

    this.chuffDist = 0;
    this.whistleKick = 0;
    this.steamTimer = 0;

    this.walkTarget = null;
    this.floatTapTarget = null;
    this.puppyTarget = null;
    this.floatVel = new THREE.Vector3();
    this.walkVel = new THREE.Vector3();
    this.summitArrived = false;
    this._lastGirlGroupPos = new THREE.Vector3();

    this._bindUI();
    this._placeInitial();
  }

  _bindUI() {
    this.btnAction = document.getElementById('action-btn');
    this.iconUmbrella = document.getElementById('icon-umbrella');
    this.iconTrain = document.getElementById('icon-train');
    this.btnWhistle = document.getElementById('whistle-btn');

    this.btnWhistle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.g.audio.unlock();
      this.triggerWhistle();
    });

    this.btnAction.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.g.audio.unlock();
      if (this.state === 'ride') {
        this.triggerDismount();
      } else if (this.state === 'walk' || this.state === 'float') {
        this.callOrBoardLocomotive();
      }
    });

    this.g.input.onTap = (ndc) => {
      this.g.audio.unlock();
      this.idleTimer = 0;
      this._handleTap(ndc);
    };
  }

  _surfaceY(x, z, refY = 0) {
    return this.g.physics ? this.g.physics.surfaceHeightAt(x, z, refY) : heightAt(x, z);
  }

  _placeInitial() {
    this._syncLocoToTrack();

    this.g.girl.pos.copy(HOME_GIRL_POS);
    this.g.girl.pos.y = this._surfaceY(HOME_GIRL_POS.x, HOME_GIRL_POS.z, 0);
    this.g.girl.yaw = Math.atan2(
      HOME_PUPPY_POS.x - HOME_GIRL_POS.x,
      HOME_PUPPY_POS.z - HOME_GIRL_POS.z
    );

    this.g.puppy.pos.copy(HOME_PUPPY_POS);
    this.g.puppy.pos.y = this._surfaceY(HOME_PUPPY_POS.x, HOME_PUPPY_POS.z, 0);
    this.g.puppy.yaw = Math.atan2(
      HOME_GIRL_POS.x - HOME_PUPPY_POS.x,
      HOME_GIRL_POS.z - HOME_PUPPY_POS.z
    );

    this.g.girl.group.position.copy(this.g.girl.pos);
    this.g.puppy.group.position.copy(this.g.puppy.pos);
    this._lastGirlGroupPos.copy(this.g.girl.pos);
  }

  go(nextState) {
    this.state = nextState;
    this.stateT = 0;
    this.phaseT = 0;

    if (nextState === 'home') {
      this.phase = 'waitPuppy';
      this.walkTarget = null;
      window.__moment = 'home';
      this._placeInitial();
      this.rig.snap(this._computeShot());
    } else if (nextState === 'board') {
      this.phase = 'waitBoard';
      this.walkTarget = null;
      window.__moment = 'board';
    } else if (nextState === 'ride') {
      this.phase = 'cruising';
      this.walkTarget = null;
      this.locoCallActive = false;
      this.speed = Math.max(this.speed, 6.8);
      this.targetSpeed = 10.6;
      this.locoClimbVel = 0;
      this.releaseCoastT = 0;
      this.assistAlpha = 0;
      this.g.loco.roll = 0;
      this._updateRideMoment();
    } else if (nextState === 'float') {
      this.phase = 'descending';
      this.floatTapTarget = null;
      this.locoCallActive = false;
      window.__moment = 'float';
      this.floatVel.set(0, -1.55, 0);
      this.g.girl.group.position.copy(this.g.girl.pos);
      this._lastGirlGroupPos.copy(this.g.girl.pos);
    } else if (nextState === 'walk') {
      this.phase = 'roaming';
      this.walkVel.set(0, 0, 0);
      this.locoCallActive = false;
      this.g.girl.group.position.copy(this.g.girl.pos);
      this._lastGirlGroupPos.copy(this.g.girl.pos);
      this._updateWalkMoment();
    } else if (nextState === 'summit') {
      this.phase = 'reunion';
      window.__moment = 'summit';
      this.summitArrived = true;
      this.speed = 0;
      this.targetSpeed = 0;
      this.locoClimbVel = 0;
      this.g.loco.roll = 0;

      this.segId = 'seg5_viaduct';
      this.segS = 0.94;
      this._syncLocoToTrack();

      const sy = SUMMIT_POS.y - 0.25;
      const terraceTop = sy + 0.4;
      this.g.girl.pos.set(SUMMIT_POS.x + 0.8, terraceTop, SUMMIT_POS.z - 2.9);
      this.g.girl.yaw = 1.42;
      this.g.girl.group.position.copy(this.g.girl.pos);
      this.g.girl.group.rotation.y = this.g.girl.yaw;
      this.g.puppy.pos.set(SUMMIT_POS.x + 1.8, terraceTop, SUMMIT_POS.z - 3.0);
      this.g.puppy.yaw = 1.25;
      this.g.puppy.group.position.copy(this.g.puppy.pos);
      this.g.puppy.group.rotation.y = this.g.puppy.yaw;
      this._lastGirlGroupPos.copy(this.g.girl.pos);
      this.g.audio.playArrival();
      this.triggerWhistle(0.75);
    }
  }

  triggerHomeLead() {
    if (this.state !== 'home' || this.phase !== 'waitPuppy') return;
    this.idleTimer = 0;
    this.phase = 'leading';
    this.phaseT = 0;
    this.g.audio.playBark();
    this.g.audio.playBell();
    this.puppyTarget = new THREE.Vector3(BOARD_POS.x - 0.1, 0.42, BOARD_POS.z + 2.1);
    this.walkTarget = new THREE.Vector3(BOARD_POS.x + 0.8, 0.42, BOARD_POS.z + 2.0);
  }

  triggerBoard() {
    if (this.state === 'home') {
      this.triggerHomeLead();
      return;
    }
    if (this.state === 'board' || this.state === 'walk' || this.state === 'float') {
      this.idleTimer = 0;
      this.walkTarget = null;
      this.locoCallActive = false;
      this.g.audio.playBell();
      this.triggerWhistle(0.55);
      this.go('ride');
    }
  }

  triggerWhistle(duration = 0.65) {
    this.whistleKick = 1.0;
    this.g.audio.playWhistle(duration);
    const tip = this.g.loco.getWorldPoint(this.g.loco.whistleTipLocal);
    for (let i = 0; i < 14; i++) {
      this.g.steam.emit(
        tip.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.28, 0, (Math.random() - 0.5) * 0.28)),
        new THREE.Vector3((Math.random() - 0.5) * 1.6, 3.4 + Math.random() * 2.0, (Math.random() - 0.5) * 1.6),
        { life: 1.5 + Math.random() * 0.6, scale0: 0.45, scale1: 1.9 }
      );
    }
    for (const side of [-1, 1]) {
      const cylPos = this.g.loco.getWorldPoint(new THREE.Vector3(side * 0.95, 0.52, 1.95));
      const outDir = new THREE.Vector3(side, 0.25, 0).applyAxisAngle(_up, this.g.loco.yaw);
      for (let j = 0; j < 4; j++) {
        this.g.steam.emit(
          cylPos,
          outDir.clone().multiplyScalar(2.0 + Math.random() * 1.2),
          { life: 0.9 + Math.random() * 0.4, scale0: 0.35, scale1: 1.5 }
        );
      }
    }
  }

  triggerValveSteam() {
    this.whistleKick = 0.85;
    this.g.audio.playSteamValve();
    const pos = this.g.loco.getWorldPoint(new THREE.Vector3(1.05, 1.1, 1.38));
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(_up, this.g.loco.yaw);
    for (let i = 0; i < 14; i++) {
      this.g.steam.emit(
        pos,
        right.clone().multiplyScalar(2.8 + Math.random() * 1.6).add(new THREE.Vector3(0, 0.9 + Math.random(), 0)),
        { life: 1.2 + Math.random() * 0.5, scale0: 0.38, scale1: 2.1 }
      );
    }
  }

  triggerDismount() {
    if (this.state !== 'ride') return;
    this.idleTimer = 0;
    const girlWorld = this.g.girl.pos.clone();
    const terrainY = heightAt(girlWorld.x, girlWorld.z);
    const sideDrop = new THREE.Vector3(2.8, 0, 0).applyAxisAngle(_up, this.g.loco.yaw);
    const sidePt = girlWorld.clone().add(sideDrop);
    const sideGroundY = this._surfaceY(sidePt.x, sidePt.z, girlWorld.y);
    const clearance = girlWorld.y - Math.min(terrainY, sideGroundY);

    this.targetSpeed = 0;
    this.speed = Math.min(this.speed, 1.4);
    this.locoClimbVel = 0;
    this.g.audio.playBell();

    if (clearance > 2.2) {
      const side = new THREE.Vector3(2.6, 0, 0).applyAxisAngle(_up, this.g.loco.yaw);
      this.g.girl.pos.copy(girlWorld).add(side);
      this.g.girl.pos.y += 1.05;
      if (this.g.physics) {
        this.g.physics.resolveActor(this.g.girl.pos, null, { radius: 0.38, height: 1.45, mode: 'float', keepDry: false });
      }
      this.go('float');
    } else {
      const sideL = new THREE.Vector3(-2.1, 0, 0).applyAxisAngle(_up, this.g.loco.yaw);
      const sideR = new THREE.Vector3(2.1, 0, 0).applyAxisAngle(_up, this.g.loco.yaw);
      const candL = girlWorld.clone().add(sideL);
      const candR = girlWorld.clone().add(sideR);
      const yL = this._surfaceY(candL.x, candL.z, girlWorld.y);
      const yR = this._surfaceY(candR.x, candR.z, girlWorld.y);
      const land = yL >= LAKE_WATER_Y + 0.1 || yL >= yR ? candL : candR;
      land.y = this._surfaceY(land.x, land.z, girlWorld.y);
      if (this.g.physics) {
        this.g.physics.resolveActor(land, null, { radius: 0.34, height: 1.26, mode: 'walk', keepDry: true });
      }
      this.g.girl.pos.copy(land);
      this.g.puppy.pos.copy(land).add(new THREE.Vector3(-0.75, 0, 0.65));
      if (this.g.physics) {
        this.g.physics.resolveActor(this.g.puppy.pos, null, { radius: 0.28, height: 0.65, mode: 'walk', keepDry: true });
      }
      this.walkTarget = null;
      this.go('walk');
    }
  }

  callOrBoardLocomotive() {
    this.idleTimer = 0;
    const dist = this.g.girl.pos.distanceTo(this.g.loco.pos);
    if (dist < 8.5) {
      this.triggerBoard();
      return;
    }
    this.triggerWhistle(0.5);
    if (this.state === 'walk') {
      this.locoCallActive = true;
    } else if (this.state === 'float') {
      this.go('ride');
    }
  }

  _nudgeClearOfPiersAndWater(pos) {
    if (this.g.physics) {
      this.g.physics.resolveActor(pos, null, { radius: 0.34, height: 1.26, mode: 'walk', keepDry: true });
      return;
    }
    pos.y = this._surfaceY(pos.x, pos.z, pos.y);
  }

  /**
   * Resolves any tap NDC (ground, deck, or sky) into a walkable 3D destination.
   * When tapping sky, projects forward-left/right along the tapped ray direction on the ground.
   */
  _pickWalkTarget(ndc) {
    this.ray.setFromCamera(ndc, this.g.camera);
    const origin = this.ray.ray.origin;
    const dir = this.ray.ray.direction;
    const refY = this.g.girl.pos.y;

    let hitPt = null;
    let prevT = 1.0;
    for (let t = 2.0; t <= 62.0; t += 1.4) {
      const px = origin.x + dir.x * t;
      const py = origin.y + dir.y * t;
      const pz = origin.z + dir.z * t;
      const sy = this._surfaceY(px, pz, refY + 1.5);
      if (py <= sy) {
        let lo = prevT;
        let hi = t;
        for (let k = 0; k < 5; k++) {
          const mid = (lo + hi) * 0.5;
          const mx = origin.x + dir.x * mid;
          const my = origin.y + dir.y * mid;
          const mz = origin.z + dir.z * mid;
          if (my <= this._surfaceY(mx, mz, refY + 1.5)) hi = mid;
          else lo = mid;
        }
        const hx = origin.x + dir.x * hi;
        const hz = origin.z + dir.z * hi;
        hitPt = new THREE.Vector3(hx, this._surfaceY(hx, hz, refY + 1.5), hz);
        break;
      }
      prevT = t;
    }

    if (!hitPt) {
      // Sky tap: walk forward along the horizontal component of the tapped ray
      let dx = dir.x;
      let dz = dir.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-4) {
        const camFwd = new THREE.Vector3();
        this.g.camera.getWorldDirection(camFwd);
        dx = camFwd.x;
        dz = camFwd.z;
      }
      const nLen = Math.max(1e-4, Math.hypot(dx, dz));
      const tx = clamp(this.g.girl.pos.x + (dx / nLen) * 9.0, -150, 160);
      const tz = clamp(this.g.girl.pos.z + (dz / nLen) * 9.0, -408, 42);
      hitPt = new THREE.Vector3(tx, this._surfaceY(tx, tz, refY + 1.5), tz);
    }

    // Clamp back to dry shoreline if tapped into deep lake/river water
    if (this.g.physics) {
      const dk = this.g.physics.deckHeightAt(hitPt.x, hitPt.z, hitPt.y + 0.5);
      if (dk === -Infinity && heightAt(hitPt.x, hitPt.z) < LAKE_WATER_Y + 0.08) {
        const stepX = this.g.girl.pos.x - hitPt.x;
        const stepZ = this.g.girl.pos.z - hitPt.z;
        for (let f = 0.1; f <= 0.95; f += 0.1) {
          const cx = hitPt.x + stepX * f;
          const cz = hitPt.z + stepZ * f;
          if (heightAt(cx, cz) >= LAKE_WATER_Y + 0.12) {
            hitPt.set(cx, this._surfaceY(cx, cz, refY), cz);
            break;
          }
        }
      }
    }
    return hitPt;
  }

  _handleTap(ndc) {
    this.ray.setFromCamera(ndc, this.g.camera);

    const targets = [
      ...this.g.loco.interactables,
      ...this.g.girl.interactables,
      ...this.g.puppy.interactables,
    ];
    const hits = this.ray.intersectObjects(targets, true);
    let kind = null;
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData.interact) obj = obj.parent;
      kind = obj && obj.userData.interact;
    } else {
      const r = this.ray.ray;
      const ticketWorld = new THREE.Vector3();
      this.g.girl.ticketProp.getWorldPosition(ticketWorld);
      if (this.state === 'home' && r.distanceSqToPoint(ticketWorld) < 0.18) {
        kind = 'ticket';
      } else if (r.distanceSqToPoint(this.g.puppy.pos.clone().add(new THREE.Vector3(0, 0.35, 0))) < 0.25) {
        kind = 'puppy';
      } else if (r.distanceSqToPoint(this.g.girl.pos.clone().add(new THREE.Vector3(0, 0.65, 0))) < 0.26) {
        kind = 'girl';
      } else if (r.distanceSqToPoint(this.g.loco.pos.clone().add(new THREE.Vector3(0, 1.3, 0))) < 3.4) {
        kind = 'loco';
      }
    }

    if (kind === 'whistle') {
      this.triggerWhistle();
      return;
    }
    if (kind === 'valve') {
      this.triggerValveSteam();
      return;
    }
    if (kind === 'ticket') {
      if (this.state === 'home') {
        this.triggerHomeLead();
        return;
      }
    }
    if (kind === 'girl') {
      if (this.state === 'home') {
        this.g.audio.playBell();
        return;
      } else if (this.state === 'ride') {
        this.triggerDismount();
        return;
      } else if (this.state === 'board') {
        this.triggerBoard();
        return;
      }
    }
    if (kind === 'puppy') {
      this.g.audio.playBark();
      if (this.state === 'home') this.triggerHomeLead();
      else if (this.state === 'board') this.triggerBoard();
      else if (this.state === 'walk' && this.g.girl.pos.distanceTo(this.g.loco.pos) < 5.0) this.triggerBoard();
      return;
    }
    if (kind === 'loco') {
      if (this.state === 'home') {
        this.triggerHomeLead();
      } else if (this.state === 'board') {
        this.triggerBoard();
      } else if (this.state === 'walk' || this.state === 'float') {
        this.callOrBoardLocomotive();
      } else if (this.state === 'ride') {
        this.triggerWhistle();
      }
      return;
    }

    if (this.state === 'home' || this.state === 'board' || this.state === 'walk') {
      if (this.state === 'home' && this.phase === 'leading') {
        this.phase = 'waitPuppy';
      }
      this.walkTarget = this._pickWalkTarget(ndc);
      return;
    }

    if (this.state === 'float') {
      this.floatTapTarget = this._pickWalkTarget(ndc);
      return;
    }

    if (this.state === 'ride') {
      // Vague tapping during ride does not block Golden Steam Wind; gives playful steam & whistle
      this.triggerWhistle(0.42);
    }
  }

  _syncLocoToTrack() {
    const seg = this.g.tracks.segments[this.segId];
    const { pos, tan } = this.g.tracks.sample(this.segId, this.segS, _p, _t);
    const ds = 1.4 / Math.max(10, seg.length);
    this.g.tracks.sample(this.segId, clamp(this.segS + ds, 0, 1), _pF);
    this.g.tracks.sample(this.segId, clamp(this.segS - ds, 0, 1), _pR);

    const railY = Math.max(pos.y, (_pF.y + _pR.y) * 0.5) + RAIL_HEAD_OFFSET;
    const horizAxle = Math.max(0.1, Math.hypot(_pF.x - _pR.x, _pF.z - _pR.z));
    const axlePitch = -Math.atan2(_pF.y - _pR.y, horizAxle);

    this.g.loco.pos.set(pos.x, railY, pos.z);
    this.g.loco.yaw = Math.atan2(tan.x, tan.z);
    this.g.loco.pitch = axlePitch;
    this.g.loco.roll = 0;
    this.g.loco.group.position.copy(this.g.loco.pos);
    this.g.loco.group.rotation.set(this.g.loco.pitch, this.g.loco.yaw, 0, 'YXZ');
    this.g.loco.group.updateMatrixWorld(true);

    if (this.g.physics) {
      this.g.physics.setLocomotive(this.g.loco.pos, this.g.loco.yaw);
    }
  }

  _updateRideMoment() {
    const lp = this.g.loco.pos;
    if (lp.y > 40 || lp.z < -335) {
      window.__moment = 'viaduct';
    } else if (lp.distanceTo(LAKE_POS) < 42 || (lp.z < -150 && lp.z > -225 && lp.x < 5)) {
      window.__moment = 'lake';
    } else if (lp.distanceTo(SIDETRACK_POS) < 34 || lp.distanceTo(LOOKOUT_POS) < 34) {
      window.__moment = 'sidetrack';
    } else if (lp.z < -215) {
      window.__moment = 'climb';
    } else {
      window.__moment = 'village';
    }
  }

  _updateWalkMoment() {
    const p = this.g.girl.pos;
    if (p.distanceTo(LAKE_POS) < 35 || p.distanceTo(LAKE_PIER_POS) < 35) {
      window.__moment = 'lake';
    } else if (p.distanceTo(SIDETRACK_POS) < 28 || p.distanceTo(LOOKOUT_POS) < 28) {
      window.__moment = 'sidetrack';
    } else if (p.distanceTo(VILLAGE_POS) < 32) {
      window.__moment = 'village';
    } else {
      window.__moment = 'walk';
    }
  }

  _updateHUD() {
    const showUmbrella = this.state === 'ride';
    const showTrain = this.state === 'walk' || this.state === 'float';
    this.btnAction.classList.toggle('visible', showUmbrella || showTrain);
    this.iconUmbrella.style.display = showUmbrella ? 'block' : 'none';
    this.iconTrain.style.display = showTrain ? 'block' : 'none';

    const showWhistle = this.state === 'ride' || this.state === 'board';
    this.btnWhistle.classList.toggle('visible', showWhistle);
  }

  _resolveGroundActor(actor, vel, radius, height, keepDry = true) {
    if (!this.g.physics) {
      actor.pos.y = this._surfaceY(actor.pos.x, actor.pos.z, actor.pos.y);
      return;
    }
    this.g.physics.resolveActor(actor.pos, vel, {
      radius,
      height,
      mode: 'walk',
      keepDry,
      ignoreLoco: false,
    });
  }

  _separateGirlAndPuppy() {
    const dx = this.g.puppy.pos.x - this.g.girl.pos.x;
    const dz = this.g.puppy.pos.z - this.g.girl.pos.z;
    const d = Math.hypot(dx, dz);
    const minSep = 0.62;
    if (d < minSep) {
      const nx = d > 1e-4 ? dx / d : -0.7;
      const nz = d > 1e-4 ? dz / d : 0.7;
      this.g.puppy.pos.x = this.g.girl.pos.x + nx * minSep;
      this.g.puppy.pos.z = this.g.girl.pos.z + nz * minSep;
      this.g.puppy.pos.y = this._surfaceY(this.g.puppy.pos.x, this.g.puppy.pos.z, this.g.puppy.pos.y);
    }
  }

  _pickAssistWaypoint(pos) {
    if (pos.distanceTo(SUMMIT_POS) < 80 || pos.z < -340 || pos.y > 48) {
      return ASSIST_WAYPOINTS[ASSIST_WAYPOINTS.length - 1];
    }
    for (let i = 0; i < ASSIST_WAYPOINTS.length; i++) {
      if (ASSIST_WAYPOINTS[i].z < pos.z - 16) {
        return ASSIST_WAYPOINTS[i];
      }
    }
    return ASSIST_WAYPOINTS[ASSIST_WAYPOINTS.length - 1];
  }

  _updateGroundWalk(dt, drag, allowPuppyFollow = true) {
    let moving = false;
    const activeDrag = drag.active && (Math.abs(drag.x) > 0.1 || Math.abs(drag.y) > 0.1);
    if (activeDrag) {
      const camFwd = new THREE.Vector3();
      this.g.camera.getWorldDirection(camFwd);
      camFwd.y = 0;
      camFwd.normalize();
      const camRight = new THREE.Vector3().crossVectors(camFwd, _up).normalize();
      const dir = camRight.multiplyScalar(drag.x).addScaledVector(camFwd, -drag.y).normalize();
      this.walkVel.copy(dir).multiplyScalar(3.8);
      this.g.girl.pos.addScaledVector(this.walkVel, dt);
      this._resolveGroundActor(this.g.girl, this.walkVel, 0.34, 1.26, true);
      this.g.girl.yaw = this.g.girl.yaw + wrapAngle(Math.atan2(dir.x, dir.z) - this.g.girl.yaw) * Math.min(1, dt * 10);
      this.walkTarget = null;
      moving = true;
    } else if (this.walkTarget) {
      const done = this._moveActorToward(this.g.girl, this.walkTarget, dt, 3.7, 0.34, 1.26);
      moving = !done;
      if (done) {
        this.walkTarget = null;
      }
    } else {
      this._resolveGroundActor(this.g.girl, null, 0.34, 1.26, true);
    }

    if (allowPuppyFollow) {
      const pupGoal = this.g.girl.pos.clone().add(new THREE.Vector3(-1.05, 0, 0.85));
      const pDone = this._moveActorToward(this.g.puppy, pupGoal, dt, 4.3, 0.28, 0.65);
      this._separateGirlAndPuppy();
      this.g.puppy.update(dt, this.g.time, { moving: !pDone, excited: true });
    }
    return moving;
  }

  update(dt) {
    this.stateT += dt;
    this.phaseT += dt;
    this.whistleKick = Math.max(0, this.whistleKick - dt * 3.5);

    if (this.state !== 'ride') {
      if (
        this.g.girl.group.position.distanceToSquared(this._lastGirlGroupPos) > 1e-5 &&
        this.g.girl.pos.distanceToSquared(this._lastGirlGroupPos) < 1e-5
      ) {
        this.g.girl.pos.copy(this.g.girl.group.position);
      }
    }

    const drag = this.g.input.dragNormalized();
    const heldMs = this.g.input.down ? performance.now() - this.g.input.downTime : 0;
    const manualSteer =
      drag.active &&
      (Math.abs(drag.x) > 0.06 || Math.abs(drag.y) > 0.06 || this.g.input.totalMove > 10 || heldMs > 220);

    if (manualSteer) {
      this.idleTimer = 0;
    } else if (this.state !== 'summit' && this.state !== 'float') {
      this.idleTimer += dt;
    }

    const distToSummit = this.g.loco.pos.distanceTo(SUMMIT_POS);
    if (distToSummit < this.lastProgressDist - 1.5) {
      this.lastProgressDist = distToSummit;
    }

    // Gentle 16s idle assist in home / board / walk (immediately overridden on player input)
    const groundAssist = this.idleTimer >= 16.0 && (this.state === 'home' || this.state === 'board' || this.state === 'walk');
    if (groundAssist) {
      if (this.state === 'home' && this.phase === 'waitPuppy') this.triggerHomeLead();
      else if (this.state === 'board') this.triggerBoard();
      else if (this.state === 'walk') this.callOrBoardLocomotive();
    }

    let guideActive = false;
    let guideFrom = this.g.loco.pos;
    let guideTo = SUMMIT_POS;

    if (this.state === 'home') {
      if (manualSteer && this.phase === 'leading') {
        this.phase = 'waitPuppy';
        this.walkTarget = null;
      }

      if (this.phase === 'leading') {
        const pDone = this._moveActorToward(this.g.puppy, this.puppyTarget, dt, 4.4, 0.28, 0.65);
        const gDone = this._moveActorToward(this.g.girl, this.walkTarget, dt, 3.2, 0.34, 1.26);
        this._separateGirlAndPuppy();
        this.g.girl.update(dt, this.g.time, { mode: gDone ? 'idle' : 'walk', moveSpeed: 3.2, showTicket: true });
        this.g.puppy.update(dt, this.g.time, { moving: !pDone, excited: pDone });
        if (gDone && this.phaseT > 1.0) {
          this.go('board');
        }
      } else {
        const girlMovedFromStart = this.g.girl.pos.distanceTo(HOME_GIRL_POS) > 0.6;
        const moving = this._updateGroundWalk(dt, drag, girlMovedFromStart || this.walkTarget !== null || manualSteer);
        if (!girlMovedFromStart && !this.walkTarget && !manualSteer) {
          this._resolveGroundActor(this.g.puppy, null, 0.28, 0.65, true);
          this._separateGirlAndPuppy();
          // Puppy gently glances toward the waiting locomotive as a wordless visual cue
          const lookLocoYaw = Math.atan2(this.g.loco.pos.x - this.g.puppy.pos.x, this.g.loco.pos.z - this.g.puppy.pos.z);
          const lookGirlYaw = Math.atan2(this.g.girl.pos.x - this.g.puppy.pos.x, this.g.girl.pos.z - this.g.puppy.pos.z);
          const glance = Math.sin(this.g.time * 1.1) > 0.15 ? lookLocoYaw : lookGirlYaw;
          this.g.puppy.yaw = this.g.puppy.yaw + wrapAngle(glance - this.g.puppy.yaw) * Math.min(1, dt * 3.5);
          this.g.puppy.update(dt, this.g.time, { moving: false, excited: true });
        }
        this.g.girl.update(dt, this.g.time, { mode: moving ? 'walk' : 'idle', moveSpeed: 3.7, showTicket: true });

        // Proximity to locomotive / platform smoothly advances to boarding
        const distLoco = this.g.girl.pos.distanceTo(this.g.loco.pos);
        const distBoard = Math.hypot(this.g.girl.pos.x - BOARD_POS.x, this.g.girl.pos.z - BOARD_POS.z);
        if (distLoco < 3.4) {
          this.triggerBoard();
        } else if (distBoard < 3.2 && (moving || this.walkTarget)) {
          this.go('board');
        }

        if (!moving && !this.walkTarget) {
          guideActive = true;
          guideFrom = this.g.puppy.pos;
          guideTo = this.g.loco.pos;
        }
      }
      this._emitIdleChimneySteam(dt);
    } else if (this.state === 'board') {
      const moving = this._updateGroundWalk(dt, drag, true);
      if (!moving && !this.walkTarget) {
        const toLoco = Math.atan2(this.g.loco.pos.x - this.g.girl.pos.x, this.g.loco.pos.z - this.g.girl.pos.z);
        this.g.girl.yaw = this.g.girl.yaw + wrapAngle(toLoco - this.g.girl.yaw) * Math.min(1, dt * 5);
      }
      this.g.girl.update(dt, this.g.time, { mode: moving ? 'walk' : 'idle', moveSpeed: 3.7, showTicket: true });
      this._emitIdleChimneySteam(dt);

      if (this.stateT > 0.7 && moving && this.g.girl.pos.distanceTo(this.g.loco.pos) < 3.0) {
        this.triggerBoard();
      }
    } else if (this.state === 'ride') {
      const L = this.g.loco;
      let targetRoll = 0;

      if (manualSteer) {
        this.releaseCoastT = 0;
        this.assistAlpha = 0;

        const steerX = Math.abs(drag.x) > 0.04 ? drag.x : 0;
        const steerY = Math.abs(drag.y) > 0.04 ? drag.y : 0;

        const yawRate = -steerX * 0.56;
        L.yaw = wrapAngle(L.yaw + yawRate * dt);
        targetRoll = this.locoGrounded ? 0 : -steerX * 0.24;

        const targetClimb = -steerY * 7.8;
        this.locoClimbVel = lerp(this.locoClimbVel, targetClimb, 1 - Math.exp(-9.0 * dt));
        this.speed = lerp(this.speed, 11.2, 1 - Math.exp(-6.5 * dt));
      } else {
        this.releaseCoastT += dt;
        this.assistAlpha = smoothstep(0.2, 1.05, this.releaseCoastT);
        guideActive = this.assistAlpha > 0.08;

        const wp = this._pickAssistWaypoint(L.pos);
        guideTo = wp;

        const fwdX = Math.sin(L.yaw);
        const fwdZ = Math.cos(L.yaw);
        const ahead1 = heightAt(L.pos.x + fwdX * 10, L.pos.z + fwdZ * 10);
        const ahead2 = heightAt(L.pos.x + fwdX * 22, L.pos.z + fwdZ * 22);
        const minClearY = Math.max(ahead1, ahead2) + 4.5;
        const goalY = clamp(
          Math.max(wp.y, minClearY, Math.min(SUMMIT_POS.y + 0.15, L.pos.y)),
          LAKE_WATER_Y + 1.8,
          SUMMIT_POS.y + 4.0
        );

        const desiredYaw = Math.atan2(wp.x - L.pos.x, wp.z - L.pos.z);
        const dYaw = wrapAngle(desiredYaw - L.yaw);
        const yawRate = clamp(dYaw * 1.25, -0.52, 0.52) * this.assistAlpha;
        L.yaw = wrapAngle(L.yaw + yawRate * dt);

        const desiredClimb = clamp((goalY - L.pos.y) * 0.48, -3.8, 5.8) * this.assistAlpha;
        this.locoClimbVel = lerp(this.locoClimbVel, desiredClimb, 1 - Math.exp(-4.0 * dt));
        this.speed = lerp(this.speed, 13.6, 1 - Math.exp(-3.0 * dt));
        targetRoll = this.locoGrounded ? 0 : clamp(-yawRate * 0.35, -0.18, 0.18);
      }

      const fwdX = Math.sin(L.yaw);
      const fwdZ = Math.cos(L.yaw);
      this.locoVel.set(fwdX * this.speed, this.locoClimbVel, fwdZ * this.speed);
      L.pos.addScaledVector(this.locoVel, dt);

      let railSupportY = -Infinity;
      const nearTrack = this.g.tracks.nearestTrackPoint(L.pos, false);
      if (nearTrack.distSq < 2.25 && Math.abs(L.pos.y - (nearTrack.pos.y + RAIL_HEAD_OFFSET)) < 1.25) {
        railSupportY = nearTrack.pos.y + RAIL_HEAD_OFFSET;
      }

      let phys = { supportY: heightAt(L.pos.x, L.pos.z), grounded: true, slopePitch: 0 };
      if (this.g.physics) {
        phys = this.g.physics.resolveLocomotive(L.pos, this.locoVel, L.yaw, { railSupportY });
        this.speed = Math.hypot(this.locoVel.x, this.locoVel.z);
        this.locoClimbVel = this.locoVel.y;
      }
      this.locoGrounded = phys.grounded;

      const targetPitch = this.locoGrounded
        ? phys.slopePitch
        : -Math.atan2(this.locoClimbVel, Math.max(4.0, this.speed)) * 0.55;
      L.pitch = lerp(L.pitch, targetPitch, 1 - Math.exp(-8.0 * dt));
      L.roll = lerp(L.roll, targetRoll, 1 - Math.exp(-7.0 * dt));

      L.group.position.copy(L.pos);
      L.group.rotation.set(L.pitch, L.yaw, L.roll, 'YXZ');
      L.group.updateMatrixWorld(true);
      if (this.g.physics) {
        this.g.physics.setLocomotive(L.pos, L.yaw);
      }

      this._updateRideMoment();

      // Check summit arrival
      const distSummitXZ = Math.hypot(L.pos.x - (SUMMIT_POS.x + 1.5), L.pos.z - (SUMMIT_POS.z + 1.0));
      if (distSummitXZ < 12.0 && Math.abs(L.pos.y - SUMMIT_POS.y) < 7.5) {
        this.go('summit');
        this._updateHUD();
        this.rig.update(dt, this._computeShot(), 3.2);
        return;
      }

      // Luminous steam rail puffs beneath the wheels while airborne
      if (!this.locoGrounded && this.g.skyTrack) {
        this.skyTrailDist += this.speed * dt;
        if (this.skyTrailDist >= 0.85) {
          this.skyTrailDist = 0;
          for (const side of [-0.48, 0.48]) {
            const pt = L.getWorldPoint(new THREE.Vector3(side, -0.05, -0.4));
            this.g.skyTrack.emit(pt, 0.92, 1.9);
          }
        }
      }

      L.getWorldPoint(L.girlSeatLocal, this.g.girl.pos);
      this.g.girl.yaw = L.yaw;
      this.g.girl.update(dt, this.g.time, { mode: 'ride', showTicket: false });

      L.getWorldPoint(L.puppySeatLocal, this.g.puppy.pos);
      this.g.puppy.yaw = L.yaw;
      this.g.puppy.update(dt, this.g.time, { moving: false, excited: Math.abs(this.speed) > 2 });

      this.chuffDist += Math.abs(this.speed) * dt;
      if (this.chuffDist >= 1.35) {
        this.chuffDist = 0;
        this.g.audio.playChuff(Math.abs(this.speed) / 11);
        const tip = L.getWorldPoint(L.chimneyTipLocal);
        this.g.steam.emit(
          tip,
          new THREE.Vector3((Math.random() - 0.5) * 0.6 + 0.5, 2.2 + Math.abs(this.speed) * 0.1, (Math.random() - 0.5) * 0.6),
          { life: 1.55, scale0: 0.45, scale1: 1.7 }
        );
      }
      if (Math.abs(this.speed) < 0.8) this._emitIdleChimneySteam(dt);
    } else if (this.state === 'float') {
      // Park locomotive smoothly where the girl dismounted (no snapping back to rails)
      this.speed = lerp(this.speed, 0, 1 - Math.exp(-3.0 * dt));
      if (this.speed > 0.08) {
        const L = this.g.loco;
        L.pos.x += Math.sin(L.yaw) * this.speed * dt;
        L.pos.z += Math.cos(L.yaw) * this.speed * dt;
        if (this.g.physics) {
          this.g.physics.resolveLocomotive(L.pos, null, L.yaw, {});
          this.g.physics.setLocomotive(L.pos, L.yaw);
        }
        L.group.position.copy(L.pos);
        L.group.updateMatrixWorld(true);
      }

      if (manualSteer) {
        this.floatTapTarget = null;
        const camFwd = new THREE.Vector3();
        this.g.camera.getWorldDirection(camFwd);
        camFwd.y = 0;
        camFwd.normalize();
        const camRight = new THREE.Vector3().crossVectors(camFwd, _up).normalize();
        this.floatVel.x = lerp(this.floatVel.x, camRight.x * drag.x * 4.5 - camFwd.x * drag.y * 4.5, dt * 4);
        this.floatVel.z = lerp(this.floatVel.z, camRight.z * drag.x * 4.5 - camFwd.z * drag.y * 4.5, dt * 4);
      } else if (this.floatTapTarget) {
        const dx = this.floatTapTarget.x - this.g.girl.pos.x;
        const dz = this.floatTapTarget.z - this.g.girl.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.8) {
          this.floatVel.x = lerp(this.floatVel.x, (dx / d) * 3.8, dt * 3);
          this.floatVel.z = lerp(this.floatVel.z, (dz / d) * 3.8, dt * 3);
        } else {
          this.floatTapTarget = null;
        }
      } else {
        this.floatVel.x *= Math.exp(-2 * dt);
        this.floatVel.z *= Math.exp(-2 * dt);
      }
      this.floatVel.y = lerp(this.floatVel.y, -1.55, 1 - Math.exp(-3.5 * dt));

      this.g.girl.pos.addScaledVector(this.floatVel, dt);
      const floorY = this.g.physics
        ? this.g.physics.resolveActor(this.g.girl.pos, this.floatVel, { radius: 0.38, height: 1.45, mode: 'float', keepDry: false })
        : this._surfaceY(this.g.girl.pos.x, this.g.girl.pos.z, this.g.girl.pos.y);

      this.g.girl.update(dt, this.g.time, { mode: 'float' });

      this.g.loco.getWorldPoint(this.g.loco.puppySeatLocal, this.g.puppy.pos);
      this.g.puppy.yaw = this.g.loco.yaw;
      this.g.puppy.update(dt, this.g.time, { moving: false, excited: true });
      this._emitIdleChimneySteam(dt);

      const deckY = this.g.physics ? this.g.physics.deckHeightAt(this.g.girl.pos.x, this.g.girl.pos.z, this.g.girl.pos.y) : -Infinity;
      const overWater = deckY === -Infinity && heightAt(this.g.girl.pos.x, this.g.girl.pos.z) < LAKE_WATER_Y + 0.05;
      if (overWater && this.g.girl.pos.y <= LAKE_WATER_Y + 0.1) {
        const eps = 0.8;
        const gx = heightAt(this.g.girl.pos.x + eps, this.g.girl.pos.z) - heightAt(this.g.girl.pos.x - eps, this.g.girl.pos.z);
        const gz = heightAt(this.g.girl.pos.x, this.g.girl.pos.z + eps) - heightAt(this.g.girl.pos.x, this.g.girl.pos.z - eps);
        const gl = Math.hypot(gx, gz);
        if (gl > 1e-4) {
          this.g.girl.pos.x += (gx / gl) * 2.5 * dt;
          this.g.girl.pos.z += (gz / gl) * 2.5 * dt;
        }
        this.g.girl.pos.y = Math.max(this.g.girl.pos.y, LAKE_WATER_Y - 0.08);
      } else if (this.g.girl.pos.y <= floorY + 0.05) {
        this._nudgeClearOfPiersAndWater(this.g.girl.pos);
        // Settle puppy onto dry ground beside the girl
        this.g.puppy.pos.copy(this.g.girl.pos).add(new THREE.Vector3(1.0, 0, 0.8));
        this._resolveGroundActor(this.g.puppy, null, 0.28, 0.65, true);
        this.walkTarget = null;
        this.go('walk');
      }
    } else if (this.state === 'walk') {
      // Smoothly bring locomotive to the girl when called from afar
      if (this.locoCallActive) {
        const L = this.g.loco;
        const dx = this.g.girl.pos.x - L.pos.x;
        const dz = this.g.girl.pos.z - L.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 5.5 && Math.abs(L.pos.y - this.g.girl.pos.y) < 3.5) {
          this.triggerBoard();
          return;
        }
        const desiredYaw = Math.atan2(dx, dz);
        L.yaw = wrapAngle(L.yaw + clamp(wrapAngle(desiredYaw - L.yaw) * 4.0, -3.2, 3.2) * dt);
        this.speed = dist > 14 ? 12.0 : 8.0;
        const targetY = this._surfaceY(L.pos.x, L.pos.z, this.g.girl.pos.y) + 0.12;
        const vy = clamp((targetY - L.pos.y) * 2.5, -6.0, 6.0);
        const callVel = new THREE.Vector3(Math.sin(L.yaw) * this.speed, vy, Math.cos(L.yaw) * this.speed);
        L.pos.addScaledVector(callVel, dt);
        if (this.g.physics) {
          const phys = this.g.physics.resolveLocomotive(L.pos, callVel, L.yaw, {});
          L.pitch = lerp(L.pitch, phys.slopePitch, dt * 6);
          this.g.physics.setLocomotive(L.pos, L.yaw);
        }
        L.group.position.copy(L.pos);
        L.group.rotation.set(L.pitch, L.yaw, 0, 'YXZ');
        L.group.updateMatrixWorld(true);
      } else {
        this.speed = lerp(this.speed, 0, 1 - Math.exp(-3.0 * dt));
      }

      const moving = this._updateGroundWalk(dt, drag, true);
      this.g.girl.update(dt, this.g.time, { mode: moving ? 'walk' : 'idle', moveSpeed: 3.7 });
      this._updateWalkMoment();
      this._emitIdleChimneySteam(dt);

      const distLoco = this.g.girl.pos.distanceTo(this.g.loco.pos);
      if (this.stateT > 1.2 && (moving || this.walkTarget) && distLoco < 3.0) {
        this.triggerBoard();
        return;
      }
    } else if (this.state === 'summit') {
      this._resolveGroundActor(this.g.girl, null, 0.34, 1.26, true);
      this._resolveGroundActor(this.g.puppy, null, 0.28, 0.65, true);
      this._separateGirlAndPuppy();
      this.g.girl.update(dt, this.g.time, { mode: 'idle', showTicket: false });
      this.g.puppy.update(dt, this.g.time, { moving: false, excited: true });
      this._emitIdleChimneySteam(dt);
    }

    if (this.state !== 'ride') {
      this._lastGirlGroupPos.copy(this.g.girl.pos);
    }

    this.g.loco.update(dt, this.speed, this.whistleKick);
    this._updateCueRing();
    if (this.g.floatMotes) {
      this.g.floatMotes.update(dt, this.g.time, this.state === 'float', this.g.girl.pos);
    }
    this.g.guideStream.update(dt, this.g.time, guideActive, guideFrom, guideTo);
    this.g.audio.updateAmbient(Math.abs(this.speed), this.g.girl.pos.y, this.state === 'float');
    this._updateHUD();
    const camStiff =
      this.state === 'float' ? 7.5 :
      this.state === 'board' ? 4.2 :
      this.state === 'ride' ? 3.8 :
      this.state === 'summit' ? 3.4 : 3.2;
    this.rig.update(dt, this._computeShot(), camStiff);
  }

  _moveActorToward(actor, target, dt, speed, radius = 0.34, height = 1.26) {
    const dx = target.x - actor.pos.x;
    const dz = target.z - actor.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.35) {
      this._resolveGroundActor(actor, null, radius, height, true);
      return true;
    }
    const prevX = actor.pos.x;
    const prevZ = actor.pos.z;
    const step = Math.min(d, speed * dt);
    const vx = (dx / d) * speed;
    const vz = (dz / d) * speed;
    actor.pos.x += (dx / d) * step;
    actor.pos.z += (dz / d) * step;
    const vel = new THREE.Vector3(vx, 0, vz);
    this._resolveGroundActor(actor, vel, radius, height, true);
    const moved = Math.hypot(actor.pos.x - prevX, actor.pos.z - prevZ);
    const targetYaw = Math.atan2(dx, dz);
    actor.yaw = actor.yaw + wrapAngle(targetYaw - actor.yaw) * Math.min(1, dt * 9);
    if (step > 0.02 && moved < step * 0.15) {
      return true;
    }
    return false;
  }

  _emitIdleChimneySteam(dt) {
    this.steamTimer += dt;
    if (this.steamTimer >= 0.4) {
      this.steamTimer = 0;
      const tip = this.g.loco.getWorldPoint(this.g.loco.chimneyTipLocal);
      this.g.steam.emit(
        tip,
        new THREE.Vector3((Math.random() - 0.5) * 0.35, 2.0, (Math.random() - 0.5) * 0.35),
        { life: 2.2, scale0: 0.45, scale1: 2.1 }
      );
      if (this.g.stations && this.g.stations.summitChimneyTip) {
        this.g.steam.emit(
          this.g.stations.summitChimneyTip,
          new THREE.Vector3(0.4, 2.4, 0.2),
          { life: 3.0, scale0: 0.85, scale1: 4.2 }
        );
      }
    }
  }

  _updateCueRing() {
    let show = false;
    let pos = this.g.puppy.pos;
    let scale = 1.0;
    if (this.state === 'home' && this.phase === 'waitPuppy') {
      show = true;
      pos = this.g.puppy.pos;
      scale = 0.95;
    } else if (this.state === 'board' || (this.state === 'walk' && this.g.girl.pos.distanceTo(this.g.loco.pos) < 12)) {
      show = true;
      pos = this.g.loco.pos;
      scale = 2.6;
    }
    this.g.cueRing.update(this.g.time, show, pos, scale);
  }

  _computeShot() {
    const aspect = this.g.vw / Math.max(1, this.g.vh);

    if (this.state === 'home') {
      const gp = this.g.girl.pos;
      const pp = this.g.puppy.pos;
      const lp = this.g.loco.pos;
      const nearStart = gp.distanceTo(HOME_GIRL_POS) < 5.0;
      const pts = [
        new THREE.Vector3(gp.x - 1.0, gp.y, gp.z + 0.8),
        new THREE.Vector3(gp.x, gp.y + 1.5, gp.z),
        new THREE.Vector3(pp.x + 1.0, pp.y, pp.z),
      ];
      if (nearStart || gp.distanceTo(lp) < 16) {
        pts.push(new THREE.Vector3(lp.x + 2.4, lp.y + 2.8, lp.z));
      }
      const tgt = nearStart
        ? new THREE.Vector3((gp.x + pp.x) * 0.5 + 0.4, gp.y + 1.5, (gp.z + pp.z) * 0.5 - 2.4)
        : gp.clone().add(new THREE.Vector3(0, 1.15, -0.6));
      const shot = fitShot({
        points: pts,
        dir: new THREE.Vector3(0.22, 0.16, 0.96),
        fov: 45,
        aspect,
        margin: 0.18,
        target: tgt,
        minDist: nearStart ? 7.4 : 6.6,
      });
      shot.pos.y = Math.max(shot.pos.y, heightAt(shot.pos.x, shot.pos.z) + 1.4);
      shot.anchor = nearStart ? new THREE.Vector3() : gp.clone();
      shot.anchorId = nearStart ? 'home' : 'home_walk';
      return shot;
    }

    if (this.state === 'board') {
      const l = this.g.loco;
      const fwd = new THREE.Vector3(Math.sin(l.yaw), 0, Math.cos(l.yaw));
      const pts = [
        l.pos.clone().addScaledVector(fwd, 3.3),
        l.pos.clone().addScaledVector(fwd, -3.3),
        l.pos.clone().addScaledVector(fwd, 2.2).add(new THREE.Vector3(0, 3.0, 0)),
        l.pos.clone().addScaledVector(fwd, -2.2).add(new THREE.Vector3(0, 3.0, 0)),
        this.g.girl.pos.clone().add(new THREE.Vector3(-0.8, 1.5, 0.5)),
      ];
      const tgt = l.pos.clone().lerp(this.g.girl.pos, 0.28).add(new THREE.Vector3(0.2, 1.25, 0));
      const shot = fitShot({
        points: pts,
        dir: new THREE.Vector3(-0.22, 0.28, 0.93),
        fov: 45,
        aspect,
        margin: 0.24,
        target: tgt,
        minDist: 10.4,
      });
      shot.pos.y = Math.max(shot.pos.y, heightAt(shot.pos.x, shot.pos.z) + 1.4);
      shot.anchorId = 'board';
      return shot;
    }

    if (this.state === 'ride') {
      const l = this.g.loco;
      const fwd = new THREE.Vector3(Math.sin(l.yaw), 0, Math.cos(l.yaw));
      const right = new THREE.Vector3().crossVectors(fwd, _up).normalize();

      const camDir = fwd
        .clone()
        .multiplyScalar(-0.84)
        .addScaledVector(right, -0.34)
        .add(new THREE.Vector3(0, 0.33 + clamp(-l.pitch * 0.35, -0.14, 0.16), 0))
        .normalize();

      const pts = [
        l.pos.clone().addScaledVector(fwd, 3.2),
        l.pos.clone().addScaledVector(fwd, -3.1),
        l.pos.clone().addScaledVector(right, 1.4).add(new THREE.Vector3(0, 2.9, 0)),
        l.pos.clone().addScaledVector(right, -1.4).add(new THREE.Vector3(0, 2.9, 0)),
      ];
      const tgt = l.pos.clone().addScaledVector(fwd, 2.1).add(new THREE.Vector3(0, 1.65, 0));
      const shot = fitShot({
        points: pts,
        dir: camDir,
        fov: this.locoGrounded ? 44 : 46,
        aspect,
        margin: 0.2,
        target: tgt,
        minDist: 10.4,
      });
      shot.pos.y = Math.max(shot.pos.y, heightAt(shot.pos.x, shot.pos.z) + 1.5);
      shot.anchor = l.pos.clone();
      shot.anchorId = 'loco';
      return shot;
    }

    if (this.state === 'float') {
      const gp = this.g.girl.pos;
      const pts = [
        gp.clone().add(new THREE.Vector3(-0.95, 0, 0)),
        gp.clone().add(new THREE.Vector3(0.95, 0, 0)),
        gp.clone().add(new THREE.Vector3(0, 2.25, 0)),
      ];
      const tgt = gp.clone().add(new THREE.Vector3(0, 1.05, 0));
      const shot = fitShot({
        points: pts,
        dir: new THREE.Vector3(0.42, 0.16, 0.89),
        fov: 44,
        aspect,
        margin: 0.18,
        target: tgt,
        minDist: 4.6,
      });
      shot.pos.y = Math.max(shot.pos.y, heightAt(shot.pos.x, shot.pos.z) + 1.2);
      shot.anchor = gp.clone();
      shot.anchorId = 'float';
      return shot;
    }

    if (this.state === 'walk') {
      const gp = this.g.girl.pos;
      const lp = this.g.loco.pos;
      const nearLoco = gp.distanceTo(lp) < 16;
      const pts = [
        gp.clone().add(new THREE.Vector3(-1.4, 0, -1.4)),
        gp.clone().add(new THREE.Vector3(1.4, 1.8, 1.4)),
      ];
      if (nearLoco) {
        pts.push(lp.clone().add(new THREE.Vector3(0, 2.5, 0)));
      }
      const tgt = nearLoco
        ? gp.clone().lerp(lp, 0.28).add(new THREE.Vector3(0, 1.1, 0))
        : gp.clone().add(new THREE.Vector3(0, 1.0, 0));
      const shot = fitShot({
        points: pts,
        dir: new THREE.Vector3(-0.38, 0.26, 0.89),
        fov: 44,
        aspect,
        margin: 0.2,
        target: tgt,
        minDist: 6.2,
      });
      shot.pos.y = Math.max(shot.pos.y, heightAt(shot.pos.x, shot.pos.z) + 1.3);
      shot.anchor = gp.clone();
      shot.anchorId = 'walk';
      return shot;
    }

    const gp = this.g.girl.pos;
    const lp = this.g.loco.pos;
    const fwdL = new THREE.Vector3(Math.sin(this.g.loco.yaw), 0, Math.cos(this.g.loco.yaw));
    const fam = new THREE.Vector3(SUMMIT_POS.x + 4.2, SUMMIT_POS.y + 0.5, SUMMIT_POS.z - 3.9);
    const pts = [
      gp.clone().add(new THREE.Vector3(-1.1, 1.5, 0.5)),
      fam.clone().add(new THREE.Vector3(0.7, 0.9, -0.5)),
      lp.clone().addScaledVector(fwdL, 2.6).add(new THREE.Vector3(0, 2.6, 0)),
      lp.clone().addScaledVector(fwdL, -2.5).add(new THREE.Vector3(0, 0.4, 0)),
    ];
    const tgt = gp.clone().lerp(fam, 0.46).lerp(lp, 0.26).add(new THREE.Vector3(0.35, 0.95, -0.35));
    const shot = fitShot({
      points: pts,
      dir: new THREE.Vector3(-0.48, 0.28, 0.83),
      fov: 44,
      aspect,
      margin: 0.16,
      target: tgt,
      minDist: 7.2,
    });
    shot.anchorId = 'summit';
    return shot;
  }
}
