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
import { clamp, lerp, wrapAngle } from '../core/math.js';
import { heightAt } from '../world/terrain.js';
import { CameraRig, fitShot } from './camera.js';

const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Story & Gameplay Director:
 * - home: garden & ticket/puppy -> leads to waiting steam locomotive (summit visible in sky)
 * - board: boarding platform -> tap locomotive to depart
 * - ride: branching narrow-gauge steam railway (village, sidetrack, lake, climb, gallery, viaduct)
 *         with one-finger switch selection, speed drag, whistle/steam play, dismount
 * - float: slow sunlit umbrella descent from any height, girl always centered in camera
 * - walk: free on-foot exploration on valley/lake/sidetrack ground & re-board
 * - summit: arrival at Cloud Summit Station overlooking layered backlit cloud sea & puppy family reunion
 * - Assisted freedom: 20s idle gently guides/pulls toward the summit
 */
export class Director {
  constructor(game) {
    this.g = game;
    this.rig = new CameraRig(game.camera);
    this.ray = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.state = 'home';
    this.phase = 'waitPuppy';
    this.stateT = 0;
    this.phaseT = 0;
    this.idleTimer = 0;
    this.lastProgressDist = Infinity;

    this.segId = 'seg0_home_village';
    this.segS = 0.19;
    this.speed = 0;
    this.targetSpeed = 7.4;
    this.chuffDist = 0;
    this.whistleKick = 0;
    this.steamTimer = 0;

    this.walkTarget = null;
    this.puppyTarget = null;
    this.floatVel = new THREE.Vector3();
    this.summitArrived = false;

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

  _placeInitial() {
    this._syncLocoToTrack();

    this.g.girl.pos.copy(HOME_GIRL_POS);
    this.g.girl.pos.y = heightAt(HOME_GIRL_POS.x, HOME_GIRL_POS.z);
    this.g.girl.yaw = Math.atan2(
      HOME_PUPPY_POS.x - HOME_GIRL_POS.x,
      HOME_PUPPY_POS.z - HOME_GIRL_POS.z
    );

    this.g.puppy.pos.copy(HOME_PUPPY_POS);
    this.g.puppy.pos.y = heightAt(HOME_PUPPY_POS.x, HOME_PUPPY_POS.z);
    this.g.puppy.yaw = Math.atan2(
      HOME_GIRL_POS.x - HOME_PUPPY_POS.x,
      HOME_GIRL_POS.z - HOME_PUPPY_POS.z
    );
  }

  go(nextState) {
    this.state = nextState;
    this.stateT = 0;
    this.phaseT = 0;

    if (nextState === 'home') {
      this.phase = 'waitPuppy';
      window.__moment = 'home';
      this._placeInitial();
      this.rig.snap(this._computeShot());
    } else if (nextState === 'board') {
      this.phase = 'waitBoard';
      window.__moment = 'board';
    } else if (nextState === 'ride') {
      this.phase = 'cruising';
      this.speed = Math.max(this.speed, 3.2);
      this.targetSpeed = 7.6;
      this._updateRideMoment();
    } else if (nextState === 'float') {
      this.phase = 'descending';
      window.__moment = 'float';
      this.floatVel.set(0, -1.75, 0);
    } else if (nextState === 'walk') {
      this.phase = 'roaming';
      this._updateWalkMoment();
    } else if (nextState === 'summit') {
      this.phase = 'reunion';
      window.__moment = 'summit';
      this.summitArrived = true;
      this.speed = 0;
      this.targetSpeed = 0;

      // Park locomotive neatly at the right-hand summit buffer end so it sits beside the reunion
      this.segId = 'seg5_viaduct';
      this.segS = 0.94;
      this._syncLocoToTrack();

      const sy = SUMMIT_POS.y - 0.25;
      this.g.girl.pos.set(SUMMIT_POS.x + 0.8, sy + 0.4, SUMMIT_POS.z - 2.9);
      this.g.girl.yaw = 1.42;
      this.g.puppy.pos.set(SUMMIT_POS.x + 1.8, sy + 0.4, SUMMIT_POS.z - 3.0);
      this.g.puppy.yaw = 1.25;
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
    this.puppyTarget = new THREE.Vector3(BOARD_POS.x - 0.4, 0, BOARD_POS.z + 2.2);
    this.walkTarget = new THREE.Vector3(BOARD_POS.x + 0.8, 0, BOARD_POS.z + 2.1);
  }

  triggerBoard() {
    if (this.state === 'home') {
      this.triggerHomeLead();
      return;
    }
    if (this.state === 'board' || this.state === 'walk' || this.state === 'float') {
      this.idleTimer = 0;
      this.walkTarget = null;
      this.g.audio.playBell();
      this.triggerWhistle(0.55);
      this.go('ride');
    }
  }

  triggerWhistle(duration = 0.65) {
    this.idleTimer = 0;
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
    this.idleTimer = 0;
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
    const groundY = heightAt(girlWorld.x, girlWorld.z);
    const clearance = girlWorld.y - groundY;

    this.targetSpeed = 0;
    this.speed = Math.min(this.speed, 1.6);
    this.g.audio.playBell();

    if (clearance > 2.2) {
      const side = new THREE.Vector3(2.8, 0, 0).applyAxisAngle(_up, this.g.loco.yaw);
      this.g.girl.pos.copy(girlWorld).add(side);
      this.g.girl.pos.y += 1.05;
      this.go('float');
    } else {
      const side = new THREE.Vector3(-1.85, 0, 0).applyAxisAngle(_up, this.g.loco.yaw);
      const land = girlWorld.clone().add(side);
      land.y = heightAt(land.x, land.z);
      this.g.girl.pos.copy(land);
      this.g.puppy.pos.copy(land).add(new THREE.Vector3(-0.75, 0, 0.55));
      this.g.puppy.pos.y = heightAt(this.g.puppy.pos.x, this.g.puppy.pos.z);
      this.walkTarget = null;
      this.go('walk');
    }
  }

  callOrBoardLocomotive() {
    this.idleTimer = 0;
    const dist = this.g.girl.pos.distanceTo(this.g.loco.pos);
    if (dist < 10.5) {
      this.triggerBoard();
      return;
    }
    const nearest = this.g.tracks.nearestTrackPoint(this.g.girl.pos, true);
    this.segId = nearest.segId;
    this.segS = nearest.s;
    this._syncLocoToTrack();
    this.triggerWhistle(0.5);
    if (this.state === 'walk') {
      this.walkTarget = this.g.loco.pos.clone();
    } else if (this.state === 'float') {
      this.go('ride');
    }
  }

  _nudgeClearOfPiersAndWater(pos) {
    for (const pier of this.g.tracks.pierObstacles) {
      const dx = pos.x - pier.x;
      const dz = pos.z - pier.z;
      const d = Math.hypot(dx, dz);
      const minR = pier.radius + 1.8;
      if (d < minR) {
        const nx = d > 0.01 ? dx / d : 1;
        const nz = d > 0.01 ? dz / d : 0;
        pos.x = pier.x + nx * minR;
        pos.z = pier.z + nz * minR;
      }
    }
    let y = heightAt(pos.x, pos.z);
    if (y < LAKE_WATER_Y + 0.35) {
      pos.x += 4.0;
      y = heightAt(pos.x, pos.z);
    }
    pos.y = y;
  }

  _handleTap(ndc) {
    this.ray.setFromCamera(ndc, this.g.camera);

    const targets = [
      ...this.g.loco.interactables,
      ...this.g.girl.interactables,
      ...this.g.puppy.interactables,
    ];
    const hits = this.ray.intersectObjects(targets, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData.interact) obj = obj.parent;
      const kind = obj && obj.userData.interact;
      if (kind === 'whistle') {
        this.triggerWhistle();
        return;
      }
      if (kind === 'valve') {
        this.triggerValveSteam();
        return;
      }
      if (kind === 'girl') {
        if (this.state === 'home') {
          this.triggerHomeLead();
        } else if (this.state === 'ride') {
          this.triggerDismount();
        } else if (this.state === 'board') {
          this.triggerBoard();
        }
        return;
      }
      if (kind === 'puppy') {
        this.g.audio.playBark();
        if (this.state === 'home') this.triggerHomeLead();
        else if (this.state === 'board' || this.state === 'walk') this.triggerBoard();
        return;
      }
      if (kind === 'loco') {
        if (this.state === 'home') {
          this.triggerHomeLead();
        } else if (this.state === 'board' || this.state === 'walk' || this.state === 'float') {
          this.triggerBoard();
        } else if (this.state === 'ride') {
          this.triggerWhistle();
        }
        return;
      }
    }

    if (this.state === 'home') {
      this.triggerHomeLead();
      return;
    }
    if (this.state === 'board') {
      this.triggerBoard();
      return;
    }
    if (this.state === 'ride') {
      if (Math.abs(this.speed) < 0.8) {
        this.targetSpeed = 7.6;
      } else if (Math.abs(ndc.x) > 0.25) {
        this._applyBranchChoice(ndc.x > 0 ? 1 : 0);
      } else {
        this.triggerWhistle(0.45);
      }
      return;
    }
    if (this.state === 'walk') {
      this.groundPlane.constant = -this.g.girl.pos.y;
      const hitPt = new THREE.Vector3();
      if (this.ray.ray.intersectPlane(this.groundPlane, hitPt)) {
        hitPt.y = heightAt(hitPt.x, hitPt.z);
        this.walkTarget = hitPt;
      }
    }
  }

  _applyBranchChoice(branch) {
    const seg = this.g.tracks.segments[this.segId];
    if (seg && seg.switchId) {
      if (this.g.tracks.switches[seg.switchId] !== branch) {
        this.g.tracks.setSwitch(seg.switchId, branch);
        this.g.audio.playSwitchClick();
      }
    }
  }

  _syncLocoToTrack() {
    const { pos, tan } = this.g.tracks.sample(this.segId, this.segS, _p, _t);
    this.g.loco.pos.copy(pos);
    this.g.loco.yaw = Math.atan2(tan.x, tan.z);
    this.g.loco.pitch = -Math.asin(clamp(tan.y, -0.95, 0.95));
    this.g.loco.group.position.copy(pos);
    this.g.loco.group.rotation.set(this.g.loco.pitch, this.g.loco.yaw, 0, 'YXZ');
    this.g.loco.group.updateMatrixWorld(true);
  }

  _updateRideMoment() {
    if (this.segId === 'seg1_flower' || this.segId === 'seg4_lookout') {
      window.__moment = 'sidetrack';
    } else if (this.segId === 'seg2_lake' || this.segId === 'seg2_return') {
      window.__moment = 'lake';
    } else if (this.segId === 'seg5_viaduct') {
      window.__moment = 'viaduct';
    } else if (this.segId === 'seg0_home_village' && this.segS > 0.35) {
      window.__moment = 'village';
    } else if (this.segId === 'seg1_main') {
      window.__moment = 'village';
    } else if (this.segId === 'seg3_climb' || this.segId === 'seg4_main') {
      window.__moment = 'climb';
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

  update(dt) {
    this.stateT += dt;
    this.phaseT += dt;
    this.whistleKick = Math.max(0, this.whistleKick - dt * 3.5);

    const drag = this.g.input.dragNormalized();
    if (drag.active && (Math.abs(drag.x) > 0.1 || Math.abs(drag.y) > 0.1)) {
      this.idleTimer = 0;
    } else if (this.state !== 'summit') {
      this.idleTimer += dt;
    }

    const distToSummit = this.g.loco.pos.distanceTo(SUMMIT_POS);
    if (distToSummit < this.lastProgressDist - 1.5) {
      this.lastProgressDist = distToSummit;
      if (this.state === 'ride') this.idleTimer = Math.min(this.idleTimer, 6.0);
    }
    const assistActive = this.idleTimer >= 20.0 && this.state !== 'summit';
    if (assistActive) {
      if (this.state === 'home') this.triggerHomeLead();
      else if (this.state === 'board' || this.state === 'walk') this.triggerBoard();
      else if (this.state === 'ride') {
        this._applyBranchChoice(0);
        this.targetSpeed = 7.8;
      }
    }

    if (this.state === 'home') {
      if (this.phase === 'leading') {
        const pDone = this._moveActorToward(this.g.puppy, this.puppyTarget, dt, 4.4);
        const gDone = this._moveActorToward(this.g.girl, this.walkTarget, dt, 3.0);
        this.g.girl.update(dt, this.g.time, { mode: gDone ? 'idle' : 'walk', moveSpeed: 3.0, showTicket: true });
        this.g.puppy.update(dt, this.g.time, { moving: !pDone, excited: pDone });
        if (gDone && this.phaseT > 1.2) {
          this.go('board');
        }
      } else {
        this.g.girl.update(dt, this.g.time, { mode: 'idle', showTicket: true });
        this.g.puppy.update(dt, this.g.time, { moving: false, excited: true });
      }
      this._emitIdleChimneySteam(dt);
    } else if (this.state === 'board') {
      this.g.girl.yaw = lerp(
        this.g.girl.yaw,
        Math.atan2(this.g.loco.pos.x - this.g.girl.pos.x, this.g.loco.pos.z - this.g.girl.pos.z),
        dt * 5
      );
      this.g.girl.update(dt, this.g.time, { mode: 'idle', showTicket: true });
      this.g.puppy.update(dt, this.g.time, { moving: false, excited: true });
      this._emitIdleChimneySteam(dt);
    } else if (this.state === 'ride') {
      if (drag.active) {
        if (Math.abs(drag.x) > 0.28) {
          this._applyBranchChoice(drag.x > 0 ? 1 : 0);
        }
        if (Math.abs(drag.y) > 0.16) {
          this.targetSpeed = clamp(7.4 - drag.y * 10.5, -3.5, 11.2);
        }
      }

      this.speed = lerp(this.speed, this.targetSpeed, 1 - Math.exp(-3.0 * dt));
      const seg = this.g.tracks.segments[this.segId];
      this.segS += (this.speed * dt) / Math.max(1, seg.length);

      if (this.segS >= 1.0) {
        const nxt = this.g.tracks.getNextSegment(this.segId);
        if (nxt) {
          this.segId = nxt.segId;
          this.segS = nxt.s;
          this._updateRideMoment();
        } else {
          this.segS = 1.0;
          this.speed = 0;
        }
      } else if (this.segS < 0.0) {
        this.segS = 0.0;
        this.speed = Math.max(0, this.speed);
        this.targetSpeed = 0;
      }

      this._syncLocoToTrack();
      this._updateRideMoment();

      if (this.segId === 'seg5_viaduct' && this.segS >= 0.92) {
        this.go('summit');
        this._updateHUD();
        this.rig.update(dt, this._computeShot(), 3.2);
        return;
      }

      this.g.loco.getWorldPoint(this.g.loco.girlSeatLocal, this.g.girl.pos);
      this.g.girl.yaw = this.g.loco.yaw;
      this.g.girl.update(dt, this.g.time, { mode: 'ride', showTicket: false });

      this.g.loco.getWorldPoint(this.g.loco.puppySeatLocal, this.g.puppy.pos);
      this.g.puppy.yaw = this.g.loco.yaw;
      this.g.puppy.update(dt, this.g.time, { moving: false, excited: Math.abs(this.speed) > 2 });

      this.chuffDist += Math.abs(this.speed) * dt;
      if (this.chuffDist >= 1.35) {
        this.chuffDist = 0;
        this.g.audio.playChuff(Math.abs(this.speed) / 11);
        const tip = this.g.loco.getWorldPoint(this.g.loco.chimneyTipLocal);
        this.g.steam.emit(
          tip,
          new THREE.Vector3((Math.random() - 0.5) * 0.6 + 0.5, 2.2 + Math.abs(this.speed) * 0.1, (Math.random() - 0.5) * 0.6),
          { life: 1.55, scale0: 0.45, scale1: 1.7 }
        );
      }
      if (Math.abs(this.speed) < 0.8) this._emitIdleChimneySteam(dt);
    } else if (this.state === 'float') {
      this.speed = lerp(this.speed, 0, 1 - Math.exp(-2.2 * dt));
      if (this.speed > 0.05) {
        const seg = this.g.tracks.segments[this.segId];
        this.segS = clamp(this.segS + (this.speed * dt) / Math.max(1, seg.length), 0, 0.9);
        this._syncLocoToTrack();
      }

      if (drag.active) {
        const camFwd = new THREE.Vector3();
        this.g.camera.getWorldDirection(camFwd);
        camFwd.y = 0;
        camFwd.normalize();
        const camRight = new THREE.Vector3().crossVectors(camFwd, _up).normalize();
        this.floatVel.x = lerp(this.floatVel.x, camRight.x * drag.x * 4.5 - camFwd.x * drag.y * 4.5, dt * 3);
        this.floatVel.z = lerp(this.floatVel.z, camRight.z * drag.x * 4.5 - camFwd.z * drag.y * 4.5, dt * 3);
      } else {
        this.floatVel.x *= Math.exp(-2 * dt);
        this.floatVel.z *= Math.exp(-2 * dt);
      }
      this.floatVel.y = -1.75;

      this.g.girl.pos.addScaledVector(this.floatVel, dt);
      const groundY = heightAt(this.g.girl.pos.x, this.g.girl.pos.z);
      this.g.girl.update(dt, this.g.time, { mode: 'float' });

      this.g.loco.getWorldPoint(this.g.loco.puppySeatLocal, this.g.puppy.pos);
      this.g.puppy.yaw = this.g.loco.yaw;
      this.g.puppy.update(dt, this.g.time, { moving: false, excited: true });
      this._emitIdleChimneySteam(dt);

      if (this.g.girl.pos.y <= groundY + 0.05) {
        this._nudgeClearOfPiersAndWater(this.g.girl.pos);
        const near = this.g.tracks.nearestTrackPoint(this.g.girl.pos, true);
        this.segId = near.segId;
        this.segS = near.s;
        this._syncLocoToTrack();
        this.g.puppy.pos.copy(this.g.girl.pos).add(new THREE.Vector3(1.1, 0, 0.8));
        this.g.puppy.pos.y = heightAt(this.g.puppy.pos.x, this.g.puppy.pos.z);
        this.walkTarget = null;
        this.go('walk');
      }
    } else if (this.state === 'walk') {
      let moving = false;
      if (drag.active && (Math.abs(drag.x) > 0.12 || Math.abs(drag.y) > 0.12)) {
        const camFwd = new THREE.Vector3();
        this.g.camera.getWorldDirection(camFwd);
        camFwd.y = 0;
        camFwd.normalize();
        const camRight = new THREE.Vector3().crossVectors(camFwd, _up).normalize();
        const dir = camRight.multiplyScalar(drag.x).addScaledVector(camFwd, -drag.y).normalize();
        this.g.girl.pos.addScaledVector(dir, 3.6 * dt);
        this.g.girl.pos.y = heightAt(this.g.girl.pos.x, this.g.girl.pos.z);
        this.g.girl.yaw = lerp(this.g.girl.yaw, Math.atan2(dir.x, dir.z), dt * 8);
        this.walkTarget = null;
        moving = true;
      } else if (this.walkTarget) {
        const done = this._moveActorToward(this.g.girl, this.walkTarget, dt, 3.6);
        moving = !done;
        if (done) {
          const targetWasLoco = this.walkTarget.distanceTo(this.g.loco.pos) < 3.0;
          this.walkTarget = null;
          if (targetWasLoco && this.g.girl.pos.distanceTo(this.g.loco.pos) < 4.5) {
            this.triggerBoard();
            return;
          }
        }
      }
      this.g.girl.update(dt, this.g.time, { mode: moving ? 'walk' : 'idle', moveSpeed: 3.6 });

      const pupGoal = this.g.girl.pos.clone().add(new THREE.Vector3(-1.1, 0, 0.9));
      const pDone = this._moveActorToward(this.g.puppy, pupGoal, dt, 4.2);
      this.g.puppy.update(dt, this.g.time, { moving: !pDone, excited: true });
      this._updateWalkMoment();
      this._emitIdleChimneySteam(dt);
    } else if (this.state === 'summit') {
      this.g.girl.update(dt, this.g.time, { mode: 'idle', showTicket: false });
      this.g.puppy.update(dt, this.g.time, { moving: false, excited: true });
      this._emitIdleChimneySteam(dt);
    }

    this.g.loco.update(dt, this.speed, this.whistleKick);
    this._updateCueRing();
    if (this.g.floatMotes) {
      this.g.floatMotes.update(dt, this.g.time, this.state === 'float', this.g.girl.pos);
    }
    this.g.guideStream.update(dt, this.g.time, assistActive, this.g.girl.pos, SUMMIT_POS);
    this.g.audio.updateAmbient(Math.abs(this.speed), this.g.girl.pos.y, this.state === 'float');
    this._updateHUD();
    const camStiff =
      this.state === 'float' ? 6.2 :
      this.state === 'board' ? 4.2 :
      this.state === 'summit' ? 3.2 : 2.8;
    this.rig.update(dt, this._computeShot(), camStiff);
  }

  _moveActorToward(actor, target, dt, speed) {
    const dx = target.x - actor.pos.x;
    const dz = target.z - actor.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.35) return true;
    const step = Math.min(d, speed * dt);
    actor.pos.x += (dx / d) * step;
    actor.pos.z += (dz / d) * step;
    actor.pos.y = heightAt(actor.pos.x, actor.pos.z);
    const targetYaw = Math.atan2(dx, dz);
    actor.yaw = actor.yaw + wrapAngle(targetYaw - actor.yaw) * Math.min(1, dt * 9);
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
      // Unobstructed garden shot: girl + puppy centered-foreground, home chalet & mailbox,
      // waiting steam locomotive on platform, and distant summit sky above!
      const gp = this.g.girl.pos;
      const pp = this.g.puppy.pos;
      const lp = this.g.loco.pos;
      const pts = [
        new THREE.Vector3(gp.x - 1.0, gp.y, gp.z + 0.8),
        new THREE.Vector3(gp.x, gp.y + 1.5, gp.z),
        new THREE.Vector3(pp.x + 1.0, pp.y, pp.z),
        new THREE.Vector3(lp.x + 2.4, lp.y + 2.8, lp.z),
      ];
      const tgt = new THREE.Vector3(
        (gp.x + pp.x) * 0.5 + 0.4,
        gp.y + 1.5,
        (gp.z + pp.z) * 0.5 - 2.4
      );
      const shot = fitShot({
        points: pts,
        dir: new THREE.Vector3(0.22, 0.16, 0.96),
        fov: 45,
        aspect,
        margin: 0.18,
        target: tgt,
        minDist: 7.4,
      });
      shot.anchorId = 'home';
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
      shot.anchorId = 'board';
      return shot;
    }

    if (this.state === 'ride') {
      const l = this.g.loco;
      const fwd = new THREE.Vector3(Math.sin(l.yaw), 0, Math.cos(l.yaw));
      const right = new THREE.Vector3().crossVectors(fwd, _up).normalize();

      const inGallery = this.segId === 'seg4_main' && this.segS >= 0.34 && this.segS <= 0.84;
      const onViaduct = this.segId === 'seg5_viaduct';

      // Keep camera safely on the open valley side & high enough to clear village roofs,
      // and keep outside the stone gallery arcade so it never clips into the roof.
      const camDir = inGallery
        ? fwd.clone().multiplyScalar(-0.76).addScaledVector(right, -0.60).add(new THREE.Vector3(0, 0.26, 0)).normalize()
        : onViaduct
          ? fwd.clone().multiplyScalar(-0.64).addScaledVector(right, -0.66).add(new THREE.Vector3(0, 0.39, 0)).normalize()
          : fwd.clone().multiplyScalar(-0.68).addScaledVector(right, -0.60).add(new THREE.Vector3(0, 0.44, 0)).normalize();

      const pts = [
        l.pos.clone().addScaledVector(fwd, 3.2),
        l.pos.clone().addScaledVector(fwd, -3.1),
        l.pos.clone().addScaledVector(right, 1.4).add(new THREE.Vector3(0, 2.9, 0)),
        l.pos.clone().addScaledVector(right, -1.4).add(new THREE.Vector3(0, 2.9, 0)),
      ];
      const tgt = l.pos.clone().addScaledVector(fwd, 1.4).add(new THREE.Vector3(0, 1.65, 0));
      const shot = fitShot({
        points: pts,
        dir: camDir,
        fov: onViaduct ? 46 : 44,
        aspect,
        margin: 0.2,
        target: tgt,
        minDist: inGallery ? 9.4 : onViaduct ? 11.2 : 10.6,
      });
      shot.anchor = l.pos.clone();
      shot.anchorId = 'loco';
      return shot;
    }

    if (this.state === 'float') {
      const gp = this.g.girl.pos;
      const pts = [
        gp.clone().add(new THREE.Vector3(-1.1, 0, 0)),
        gp.clone().add(new THREE.Vector3(1.1, 0, 0)),
        gp.clone().add(new THREE.Vector3(0, 2.4, 0)),
      ];
      const tgt = gp.clone().add(new THREE.Vector3(0, 1.08, 0));
      const shot = fitShot({
        points: pts,
        dir: new THREE.Vector3(0.42, 0.16, 0.89),
        fov: 44,
        aspect,
        margin: 0.22,
        target: tgt,
        minDist: 5.8,
      });
      shot.anchor = gp.clone();
      shot.anchorId = 'float';
      return shot;
    }

    if (this.state === 'walk') {
      const gp = this.g.girl.pos;
      const lp = this.g.loco.pos;
      const nearLoco = gp.distanceTo(lp) < 18;
      const pts = [
        gp.clone().add(new THREE.Vector3(-1.5, 0, -1.5)),
        gp.clone().add(new THREE.Vector3(1.5, 1.8, 1.5)),
      ];
      if (nearLoco) {
        pts.push(lp.clone().add(new THREE.Vector3(0, 2.6, 0)));
      }
      const tgt = nearLoco
        ? gp.clone().lerp(lp, 0.3).add(new THREE.Vector3(0, 1.1, 0))
        : gp.clone().add(new THREE.Vector3(0, 1.0, 0));
      const shot = fitShot({
        points: pts,
        dir: new THREE.Vector3(-0.4, 0.26, 0.88),
        fov: 44,
        aspect,
        margin: 0.2,
        target: tgt,
        minDist: 6.6,
      });
      shot.anchor = gp.clone();
      shot.anchorId = 'walk';
      return shot;
    }

    // summit: Reunion framed large with entire locomotive on right, snow-trimmed station on left-back,
    // and vast layered golden-backlit and pale-blue cloud sea opening behind them!
    const gp = this.g.girl.pos;
    const lp = this.g.loco.pos;
    const fwdL = new THREE.Vector3(Math.sin(this.g.loco.yaw), 0, Math.cos(this.g.loco.yaw));
    const fam = new THREE.Vector3(SUMMIT_POS.x + 4.4, SUMMIT_POS.y + 0.5, SUMMIT_POS.z - 4.0);
    const pts = [
      gp.clone().add(new THREE.Vector3(-1.2, 1.6, 0.6)),
      fam.clone().add(new THREE.Vector3(0.8, 1.0, -0.6)),
      lp.clone().addScaledVector(fwdL, 2.8).add(new THREE.Vector3(0, 2.7, 0)),
      lp.clone().addScaledVector(fwdL, -2.7).add(new THREE.Vector3(0, 0.4, 0)),
    ];
    const tgt = gp.clone().lerp(fam, 0.46).lerp(lp, 0.26).add(new THREE.Vector3(0.4, 0.95, -0.4));
    const shot = fitShot({
      points: pts,
      dir: new THREE.Vector3(-0.50, 0.30, 0.81),
      fov: 44,
      aspect,
      margin: 0.19,
      target: tgt,
      minDist: 8.6,
    });
    shot.anchorId = 'summit';
    return shot;
  }
}
