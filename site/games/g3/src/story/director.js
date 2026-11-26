import * as THREE from '../../lib/three.module.js';
import {
  HARBOR_BOAT_POS,
  ISLANDS,
  PAVILION_DOCK_POS,
  REEFS,
  SHELL_MAP_POS,
  WELCOMER_POS,
  shared,
} from '../core/env.js';
import { clamp, lerp, smoothstep, wrapAngle } from '../core/math.js';
import { fitShot } from '../core/camera.js';
import { getGroundY, getLandInfo } from '../world/terrain.js';
import { resolveBoatPhysics, resolveGirlPhysics } from '../world/colliders.js';
import { getSeaWaveHeight } from '../world/sea.js';

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _v = new THREE.Vector3();

export class Director {
  constructor({ camera, rig, girl, boat, welcomer, harbor, archipelago, windRings, audio }) {
    this.camera = camera;
    this.rig = rig;
    this.girl = girl;
    this.boat = boat;
    this.welcomer = welcomer;
    this.harbor = harbor;
    this.archipelago = archipelago;
    this.windRings = windRings;
    this.audio = audio;

    this.state = 'harbor'; // harbor | board | sail | dock | walk | float | stars
    this.stateT = 0;
    this.phase = 'idle';
    this.phaseT = 0;
    this.time = 0;

    this.targetSteerX = 0;
    this.targetSteerY = 0;
    this.walkTarget = null;
    this.currentIsland = null;
    this.visitedIslands = new Set();
    this.idleProgressTimer = 0;
    this.lastProgressPos = new THREE.Vector3();
    this.progressNight = 0;
    this.lanternLevel = 0.35;

    this.breezeTimer = 0;
    this.breezeSpeedBoost = 0;
    this.floatTargetPos = new THREE.Vector3();
    this.reboardWalk = false;

    this.actionBtn = document.getElementById('action-btn');
    this.iconFloat = document.getElementById('icon-float');
    this.iconSail = document.getElementById('icon-sail');
    this.iconShell = document.getElementById('icon-shell');

    if (this.actionBtn) {
      this.actionBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.audio.unlock();
        this.triggerActionButton();
      });
    }

    this._initHarbor();
  }

  _setMoment(m) {
    if (window.__moment !== m) {
      window.__moment = m;
    }
  }

  _setState(next, phase = 'main') {
    this.state = next;
    this.stateT = 0;
    this.phase = phase;
    this.phaseT = 0;
    this.idleProgressTimer = 0;
  }

  _initHarbor() {
    this._setState('harbor', 'pickShell');
    this._setMoment('harbor');

    this.girl.pos.set(0.6, Math.max(1.04, getGroundY(0.6, -120.8)), -120.8);
    this.girl.yaw = 0.32;
    this.girl.isSeated = false;
    this.girl.isWalking = false;
    this.girl.isFloating = false;
    this.girl.setShellCarried(false);

    this.boat.pos.copy(HARBOR_BOAT_POS);
    this.boat.yaw = -0.05;
    this.boat.speed = 0;

    this.lastProgressPos.copy(this.girl.pos);
    this.rig.snap(this.computeShot());
  }

  triggerActionButton() {
    if (this.state === 'harbor') {
      if (!this.girl.hasShell) {
        this.pickUpShellAndMaybeBoard(false);
      } else {
        this.startBoardingFromHarbor();
      }
    } else if (this.state === 'sail') {
      const dockCandidate = this._findNearestDock(22);
      if (dockCandidate) {
        this.startDocking(dockCandidate.island, dockCandidate.dockPos);
      } else {
        this.startFloatDescent();
      }
    } else if (this.state === 'walk') {
      this.startReboardFromIsland();
    }
  }

  handleTap(tap) {
    this.audio.unlock();
    this.idleProgressTimer = 0;

    if (this.state === 'harbor') {
      if (!this.girl.hasShell) {
        this.pickUpShellAndMaybeBoard(false);
      } else {
        this.startBoardingFromHarbor();
      }
      return;
    }

    if (this.state === 'walk' && this.currentIsland) {
      _ndc.set(tap.nx, tap.ny);
      _ray.setFromCamera(_ndc, this.camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.girl.pos.y);
      const hit = new THREE.Vector3();
      if (_ray.ray.intersectPlane(plane, hit)) {
        const boatDist = Math.hypot(hit.x - this.boat.pos.x, hit.z - this.boat.pos.z);
        if (boatDist < 6.0) {
          this.startReboardFromIsland();
          return;
        }
        const info = getLandInfo(hit.x, hit.z);
        if (info.zone === 'island' && info.y >= 0.2) {
          this.walkTarget = hit.clone();
          this.reboardWalk = false;
        }
      }
      return;
    }

    if (this.state === 'sail') {
      _ndc.set(tap.nx, tap.ny);
      _ray.setFromCamera(_ndc, this.camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.boat.pos.y);
      const hit = new THREE.Vector3();
      if (_ray.ray.intersectPlane(plane, hit)) {
        const dBoat = Math.hypot(hit.x - this.boat.pos.x, hit.z - this.boat.pos.z);
        if (dBoat < 4.5) {
          const nearDock = this._findNearestDock(22);
          if (nearDock) {
            this.startDocking(nearDock.island, nearDock.dockPos);
          } else {
            this.startFloatDescent();
          }
          return;
        }
        const aimYaw = Math.atan2(hit.x - this.boat.pos.x, hit.z - this.boat.pos.z);
        const diff = wrapAngle(aimYaw - this.boat.yaw);
        this.targetSteerX = clamp(diff * 1.4, -0.85, 0.85);
      }
    }
  }

  pickUpShellAndMaybeBoard(autoBoard = false) {
    if (this.state !== 'harbor') return;
    if (this.girl.hasShell) {
      if (autoBoard) this.startBoardingFromHarbor();
      return;
    }
    this.phase = autoBoard ? 'walkToShellThenBoard' : 'walkToShell';
    this.phaseT = 0;
  }

  startBoardingFromHarbor() {
    if (this.state !== 'harbor') return;
    if (!this.girl.hasShell) {
      this.girl.setShellCarried(true);
      this.harbor.hideShellMapOnPedestal();
    }
    this._setState('board', 'walkJetty');
    this._setMoment('board');
    this.audio.playChime([523.25, 659.25, 783.99], 0.8, 0.1);
  }

  startDocking(island, dockPos) {
    if (this.state !== 'sail') return;
    this.currentIsland = island;
    this.activeDockPos = dockPos ? dockPos.clone() : island.dockPos.clone();
    this.visitedIslands.add(island.id);
    this.breezeTimer = 0;
    this.breezeSpeedBoost = 0;
    this._setState('dock', 'approach');
    this._setMoment('dock');
    this.audio.playChime([440, 554.37, 659.25], 0.8, 0.09);
  }

  startReboardFromIsland() {
    if (this.state !== 'walk') return;
    this.reboardWalk = true;
    this.walkTarget = this.currentIsland.walkLanding.clone();
  }

  startFloatDescent() {
    if (this.state !== 'sail') return;
    this.breezeTimer = 0;
    this.breezeSpeedBoost = 0;
    this._setState('float', 'ascend');
    this._setMoment('float');
    this.girl.isSeated = false;
    this.girl.isWalking = false;
    this.girl.isFloating = true;
    // Start smoothly from just above the sailboat so camera tracks her upward & down cleanly centered
    this.girl.pos.set(this.boat.pos.x + 0.35, this.boat.pos.y + 1.4, this.boat.pos.z + 0.35);
    this.floatPeakY = Math.max(this.boat.pos.y + 5.6, 6.8);
    this.floatTargetPos.copy(this.boat.pos);
    this.audio.playChime([587.33, 739.99, 880, 1046.5], 1.3, 0.1);
  }

  startPavilionArrival() {
    if (this.state === 'stars') return;
    this.breezeTimer = 0;
    this.breezeSpeedBoost = 0;
    this._setState('stars', 'glideIn');
    this._setMoment('stars');
    this.audio.playChime([523.25, 659.25, 783.99, 1046.5], 1.6, 0.12);
  }

  _findNearestDock(maxDist = 14) {
    let best = null;
    let bestD = maxDist;
    for (const isl of ISLANDS) {
      const candidates = [isl.dockPos];
      if (isl.altDockPos) candidates.push(isl.altDockPos);
      for (const dp of candidates) {
        const d = Math.hypot(this.boat.pos.x - dp.x, this.boat.pos.z - dp.z);
        if (d < bestD) {
          bestD = d;
          best = { island: isl, dockPos: dp, dist: d };
        }
      }
    }
    return best;
  }

  _updateAtmosphere(dt) {
    const distProgress = clamp((this.boat.pos.z - HARBOR_BOAT_POS.z) / (PAVILION_DOCK_POS.z - HARBOR_BOAT_POS.z), 0, 1);
    const islandBonus = this.visitedIslands.size * 0.14;
    const targetNight = this.state === 'stars' ? 1.0 : clamp(distProgress * 0.78 + islandBonus, 0.02, 0.92);
    this.progressNight += (targetNight - this.progressNight) * Math.min(1, dt * 0.65);

    shared.uNight.value = this.progressNight;
    this.lanternLevel = 0.35 + this.progressNight * 0.65;
    shared.uLanternGlow.value = this.lanternLevel;

    shared.uSkyHorizon.value.setHex(0xd48567).lerp(new THREE.Color(0x1f335c), smoothstep(0.05, 0.85, this.progressNight));
    shared.uSkyZenith.value.setHex(0x284375).lerp(new THREE.Color(0x0b1733), smoothstep(0.0, 0.9, this.progressNight));
    shared.uFogColor.value.copy(shared.uSkyHorizon.value).lerp(shared.uSkyZenith.value, 0.32);
  }

  _updateActionButton() {
    if (!this.actionBtn) return;
    let show = false;
    let mode = 'float';

    if (this.state === 'harbor') {
      show = true;
      mode = this.girl.hasShell ? 'sail' : 'shell';
    } else if (this.state === 'sail') {
      show = true;
      mode = 'float';
    } else if (this.state === 'walk') {
      show = true;
      mode = 'sail';
    }

    this.actionBtn.classList.toggle('visible', show);
    this.iconFloat.style.display = mode === 'float' ? 'block' : 'none';
    this.iconSail.style.display = mode === 'sail' ? 'block' : 'none';
    this.iconShell.style.display = mode === 'shell' ? 'block' : 'none';
  }

  update(dt, t, input, isAutoTest = false) {
    this.time = t;
    this.stateT += dt;
    this.phaseT += dt;

    this._updateAtmosphere(dt);
    this._updateActionButton();

    if (this.state === 'harbor') {
      this._updateHarbor(dt, isAutoTest);
    } else if (this.state === 'board') {
      this._updateBoard(dt);
    } else if (this.state === 'sail') {
      this._updateSail(dt, t, input, isAutoTest);
    } else if (this.state === 'dock') {
      this._updateDock(dt, t);
    } else if (this.state === 'walk') {
      this._updateWalk(dt, t, input);
    } else if (this.state === 'float') {
      this._updateFloat(dt, t);
    } else if (this.state === 'stars') {
      this._updateStars(dt, t);
    }

    this.girl.update(dt, t);
    this.boat.update(
      dt,
      t,
      this.state === 'sail' ? this.targetSteerX : 0,
      this.state === 'harbor' || this.state === 'walk',
      this.lanternLevel,
      clamp(this.breezeTimer / 2.2, 0, 1),
      this.state === 'stars' ? -0.32 : null
    );
    this.welcomer.update(t, this.state === 'stars', this.lanternLevel);
    this.audio.update(t, this.boat.speed, this.state === 'float');
  }

  _updateHarbor(dt, isAutoTest) {
    this._setMoment('harbor');
    if (this.phase === 'walkToShell' || this.phase === 'walkToShellThenBoard') {
      const targetX = SHELL_MAP_POS.x - 1.02;
      const targetZ = SHELL_MAP_POS.z - 0.85;
      const dx = targetX - this.girl.pos.x;
      const dz = targetZ - this.girl.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.16) {
        this.girl.isWalking = true;
        this.girl.yaw = Math.atan2(dx, dz);
        const step = Math.min(d, dt * 2.7);
        this.girl.pos.x += (dx / d) * step;
        this.girl.pos.z += (dz / d) * step;
      } else {
        this.girl.isWalking = false;
        this.girl.yaw = Math.atan2(SHELL_MAP_POS.x - this.girl.pos.x, SHELL_MAP_POS.z - this.girl.pos.z);
        if (!this.girl.hasShell) {
          this.girl.setShellCarried(true);
          this.harbor.hideShellMapOnPedestal();
          this.audio.playChime([659.25, 783.99, 987.77], 0.85, 0.1);
        }
        if (this.phase === 'walkToShellThenBoard') {
          this.startBoardingFromHarbor();
        } else {
          this.phase = 'readyToBoard';
          this.phaseT = 0;
        }
      }
    } else if (!isAutoTest && this.stateT > 20) {
      this.pickUpShellAndMaybeBoard(true);
    }
    resolveGirlPhysics(this.girl, 'harbor', this.boat, false);
    resolveBoatPhysics(this.boat, dt, this.time, 0);
  }

  _updateBoard(dt) {
    this._setMoment('board');
    if (this.phase === 'walkJetty') {
      const seat = this.boat.getSeatWorldPos(_v);
      let wpX = seat.x;
      let wpZ = seat.z;
      let steppingAboard = true;

      // Harbor boarding follows the quay -> jetty -> boat cockpit path cleanly around pedestal & water
      if (this.girl.pos.z < -95) {
        if (this.girl.pos.z < -114.6 && Math.abs(this.girl.pos.x - 3.8) > 1.0) {
          wpX = 3.8;
          wpZ = -115.6;
          steppingAboard = false;
        } else if (this.girl.pos.z < -109.6 && this.girl.pos.x < 5.6) {
          wpX = 3.8;
          wpZ = -109.0;
          steppingAboard = false;
        }
      } else if (this.currentIsland) {
        const wl = this.currentIsland.walkLanding;
        const dToBoat = Math.hypot(seat.x - this.girl.pos.x, seat.z - this.girl.pos.z);
        if (dToBoat > 4.0) {
          wpX = wl.x;
          wpZ = wl.z;
          steppingAboard = false;
        }
      }

      const dx = wpX - this.girl.pos.x;
      const dz = wpZ - this.girl.pos.z;
      const d = Math.hypot(dx, dz);
      const seatDist = Math.hypot(seat.x - this.girl.pos.x, seat.z - this.girl.pos.z);

      if (seatDist > 0.42 && this.phaseT < 4.5) {
        this.girl.isWalking = true;
        if (d > 0.05) {
          this.girl.yaw = Math.atan2(dx, dz);
          const step = Math.min(d, dt * 3.3);
          this.girl.pos.x += (dx / d) * step;
          this.girl.pos.z += (dz / d) * step;
        }
        resolveGirlPhysics(this.girl, 'board', this.boat, steppingAboard);
        if (steppingAboard) {
          this.girl.pos.y = Math.max(seat.y - 0.12, getGroundY(this.girl.pos.x, this.girl.pos.z));
        }
      } else {
        this.girl.isWalking = false;
        this.girl.isSeated = true;
        this.girl.pos.copy(seat);
        this.girl.yaw = this.boat.yaw;
        this.phase = 'castOff';
        this.phaseT = 0;
      }
      resolveBoatPhysics(this.boat, dt, this.time, 0);
    } else if (this.phase === 'castOff') {
      const desiredYaw = this.boat.pos.z < -90
        ? wrapAngle(Math.atan2(-2.5 - this.boat.pos.x, -92.0 - this.boat.pos.z))
        : wrapAngle(Math.atan2(PAVILION_DOCK_POS.x - this.boat.pos.x, PAVILION_DOCK_POS.z - this.boat.pos.z));
      this.boat.yaw += wrapAngle(desiredYaw - this.boat.yaw) * Math.min(1, dt * 2.4);
      this.boat.speed = lerp(this.boat.speed, 6.8, Math.min(1, dt * 2.4));
      this.boat.pos.x += Math.sin(this.boat.yaw) * this.boat.speed * dt;
      this.boat.pos.z += Math.cos(this.boat.yaw) * this.boat.speed * dt;
      resolveBoatPhysics(this.boat, dt, this.time, 0);

      this.girl.pos.copy(this.boat.getSeatWorldPos(_v));
      this.girl.yaw = this.boat.yaw;

      if (this.phaseT > 1.2) {
        this._setState('sail', 'open');
        this._setMoment('sail');
      }
    }
  }

  _updateSail(dt, t, input, isAutoTest) {
    if (!isAutoTest && input && input.active && input.moved) {
      this.targetSteerX = -input.dragX;
      this.targetSteerY = -input.dragY;
      this.idleProgressTimer = 0;
    } else if (!isAutoTest) {
      this.targetSteerX *= Math.pow(0.08, dt);
      this.targetSteerY *= Math.pow(0.08, dt);
    }

    if (this.girl.pos.distanceTo(this.lastProgressPos) > 1.5 && !isAutoTest && input && input.active) {
      this.idleProgressTimer = 0;
      this.lastProgressPos.copy(this.girl.pos);
    } else {
      this.idleProgressTimer += dt;
    }

    // Gentle 20-second assist wind for 5-year-old players
    let assistTurn = 0;
    if (!isAutoTest && this.idleProgressTimer > 20) {
      let guideTarget = PAVILION_DOCK_POS;
      for (const isl of ISLANDS) {
        if (!this.visitedIslands.has(isl.id)) {
          guideTarget = isl.dockPos;
          break;
        }
      }
      const aimYaw = Math.atan2(guideTarget.x - this.boat.pos.x, guideTarget.z - this.boat.pos.z);
      assistTurn = clamp(wrapAngle(aimYaw - this.boat.yaw) * 0.95, -0.55, 0.55);
    }

    // Check Tailwind Ring gates for breeze boost & exhilarating glide
    if (this.windRings && this.windRings.checkPass(this.boat.pos, dt)) {
      this.breezeTimer = 2.6;
      this.breezeSpeedBoost = 7.4;
      this.audio.playBreezeWhoosh();
    }
    if (this.breezeTimer > 0) {
      this.breezeTimer = Math.max(0, this.breezeTimer - dt);
    }
    this.breezeSpeedBoost *= Math.pow(0.58, dt);

    const turnRate = (this.targetSteerX + assistTurn) * 1.18;
    this.boat.yaw = wrapAngle(this.boat.yaw + turnRate * dt);

    const baseDesired = clamp(8.2 + this.targetSteerY * 2.8, 4.2, 10.8);
    const desiredSpeed = baseDesired + this.breezeSpeedBoost;
    this.boat.speed = lerp(this.boat.speed, desiredSpeed, Math.min(1, dt * (this.breezeTimer > 0 ? 4.2 : 2.2)));

    let nextX = this.boat.pos.x + Math.sin(this.boat.yaw) * this.boat.speed * dt;
    let nextZ = this.boat.pos.z + Math.cos(this.boat.yaw) * this.boat.speed * dt;

    nextX = clamp(nextX, -115, 115);
    nextZ = clamp(nextZ, -110, 185);

    // Arrival at Starlit Cove Pavilion
    const distPavilion = Math.hypot(nextX - PAVILION_DOCK_POS.x, nextZ - PAVILION_DOCK_POS.z);
    if (distPavilion < 15.5) {
      this.startPavilionArrival();
      return;
    }

    // Proximity to island docks
    const nearDock = this._findNearestDock(10.5);
    if (nearDock && (!this.visitedIslands.has(nearDock.island.id) || this.stateT > 4.5)) {
      this.startDocking(nearDock.island, nearDock.dockPos);
      return;
    }

    this.boat.pos.x = nextX;
    this.boat.pos.z = nextZ;
    resolveBoatPhysics(this.boat, dt, t, this.targetSteerX);

    this.girl.isSeated = true;
    this.girl.pos.copy(this.boat.getSeatWorldPos(_v));
    this.girl.yaw = this.boat.yaw;

    // Priority of moment labels: breeze (while boosting) > island (when approaching) > sail
    let nearIsl = null;
    for (const isl of ISLANDS) {
      const d = Math.hypot(this.boat.pos.x - isl.center.x, this.boat.pos.z - isl.center.z);
      if (d < 46) {
        nearIsl = isl;
        break;
      }
    }
    this.approachingIsland = nearIsl;
    if (this.breezeTimer > 0) {
      this._setMoment('breeze');
    } else if (nearIsl) {
      this._setMoment('island');
    } else {
      this._setMoment('sail');
    }
  }

  _updateDock(dt, t) {
    this._setMoment('dock');
    const dp = this.activeDockPos || this.currentIsland.dockPos;
    const dockYaw = this.currentIsland.dockYaw;
    this.boat.pos.x = lerp(this.boat.pos.x, dp.x, Math.min(1, dt * 2.5));
    this.boat.pos.z = lerp(this.boat.pos.z, dp.z, Math.min(1, dt * 2.5));
    this.boat.yaw += wrapAngle(dockYaw - this.boat.yaw) * Math.min(1, dt * 3.0);
    this.boat.speed *= Math.pow(0.05, dt);
    resolveBoatPhysics(this.boat, dt, t, 0);

    this.girl.pos.copy(this.boat.getSeatWorldPos(_v));
    this.girl.yaw = this.boat.yaw;

    if (this.stateT > 1.8) {
      this._setState('walk', 'explore');
      this._setMoment('walk');
      this.girl.isSeated = false;
      this.girl.pos.copy(this.currentIsland.walkLanding);
      this.girl.pos.y = getGroundY(this.girl.pos.x, this.girl.pos.z);
      resolveGirlPhysics(this.girl, 'walk', this.boat, false);
      this.walkTarget = null;
      this.reboardWalk = false;
    }
  }

  _updateWalk(dt, t, input) {
    this._setMoment('walk');

    if (!this.reboardWalk && input && input.active && input.moved) {
      const fwd = new THREE.Vector3();
      this.camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const move = new THREE.Vector3()
        .addScaledVector(right, input.dragX)
        .addScaledVector(fwd, -input.dragY);
      if (move.lengthSq() > 0.01) {
        move.normalize();
        this.walkTarget = this.girl.pos.clone().addScaledVector(move, 2.5);
      }
    }

    if (this.walkTarget) {
      const dx = this.walkTarget.x - this.girl.pos.x;
      const dz = this.walkTarget.z - this.girl.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.25) {
        const prevX = this.girl.pos.x;
        const prevZ = this.girl.pos.z;
        const step = Math.min(d, dt * 3.6);
        this.girl.pos.x += (dx / d) * step;
        this.girl.pos.z += (dz / d) * step;
        resolveGirlPhysics(this.girl, 'walk', this.boat, false);
        const moved = Math.hypot(this.girl.pos.x - prevX, this.girl.pos.z - prevZ);
        if (moved > 0.004) {
          this.girl.yaw = Math.atan2(this.girl.pos.x - prevX, this.girl.pos.z - prevZ);
          this.girl.isWalking = true;
        } else {
          this.girl.isWalking = false;
          this.walkTarget = null;
        }
      } else {
        this.girl.isWalking = false;
        this.walkTarget = null;
        if (this.reboardWalk) {
          this.reboardWalk = false;
          this._setState('board', 'walkJetty');
          this._setMoment('board');
          this.audio.playChime([523.25, 659.25], 0.7, 0.09);
        }
      }
    } else {
      this.girl.isWalking = false;
      resolveGirlPhysics(this.girl, 'walk', this.boat, false);
    }

    resolveBoatPhysics(this.boat, dt, t, 0);
  }

  _updateFloat(dt, t) {
    this._setMoment('float');
    resolveBoatPhysics(this.boat, dt, t, 0);
    const seat = this.boat.getSeatWorldPos(_v);
    this.boat.speed *= Math.pow(0.15, dt);

    if (this.phase === 'ascend') {
      this.girl.pos.y = lerp(this.girl.pos.y, this.floatPeakY, Math.min(1, dt * 3.8));
      this.girl.yaw = wrapAngle(this.girl.yaw + dt * 0.45);
      resolveGirlPhysics(this.girl, 'float', null, false);
      if (this.phaseT > 0.72 || Math.abs(this.floatPeakY - this.girl.pos.y) < 0.25) {
        this.phase = 'descend';
        this.phaseT = 0;
      }
      return;
    }

    // Serene slow aerial descent (~1.15 m/s) centered in frame
    const targetY = seat.y + 0.15;
    const dy = this.girl.pos.y - targetY;

    this.girl.pos.x = lerp(this.girl.pos.x, seat.x, Math.min(1, dt * 0.95));
    this.girl.pos.z = lerp(this.girl.pos.z, seat.z, Math.min(1, dt * 0.95));

    if (dy > 0.18) {
      this.girl.pos.y -= Math.min(dy, dt * 1.15);
      this.girl.yaw = wrapAngle(this.girl.yaw + dt * 0.45);
      resolveGirlPhysics(this.girl, 'float', null, false);
    } else {
      this.girl.isFloating = false;
      this.girl.isSeated = true;
      this.girl.pos.copy(seat);
      this.girl.yaw = this.boat.yaw;
      this._setState('sail', 'open');
      this._setMoment('sail');
      this.audio.playChime([659.25, 783.99], 0.7, 0.08);
    }
  }

  _updateStars(dt, t) {
    this._setMoment('stars');
    if (this.phase === 'glideIn') {
      this.boat.pos.x = lerp(this.boat.pos.x, PAVILION_DOCK_POS.x, Math.min(1, dt * 2.4));
      this.boat.pos.z = lerp(this.boat.pos.z, PAVILION_DOCK_POS.z, Math.min(1, dt * 2.4));
      this.boat.yaw += wrapAngle(0.76 - this.boat.yaw) * Math.min(1, dt * 2.8);
      this.boat.speed *= Math.pow(0.08, dt);
      resolveBoatPhysics(this.boat, dt, t, 0);

      this.girl.isSeated = true;
      this.girl.pos.copy(this.boat.getSeatWorldPos(_v));
      this.girl.yaw = this.boat.yaw;

      const d = Math.hypot(this.boat.pos.x - PAVILION_DOCK_POS.x, this.boat.pos.z - PAVILION_DOCK_POS.z);
      if (d < 1.1 || this.phaseT > 2.2) {
        this.phase = 'stepAshore';
        this.phaseT = 0;
        this.girl.isSeated = false;
        this.girl.pos.set(-1.55, getGroundY(-1.55, 179.8), 179.8);
      }
    } else if (this.phase === 'stepAshore') {
      const targetX = -0.25;
      const targetZ = 183.2;
      const dx = targetX - this.girl.pos.x;
      const dz = targetZ - this.girl.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.18) {
        this.girl.isWalking = true;
        this.girl.yaw = Math.atan2(dx, dz);
        const step = Math.min(d, dt * 2.6);
        this.girl.pos.x += (dx / d) * step;
        this.girl.pos.z += (dz / d) * step;
      } else {
        this.girl.isWalking = false;
        this.girl.yaw = Math.atan2(WELCOMER_POS.x - this.girl.pos.x, WELCOMER_POS.z - this.girl.pos.z);
        this.phase = 'reunion';
        this.phaseT = 0;
      }
      resolveGirlPhysics(this.girl, 'stars', this.boat, false);
      resolveBoatPhysics(this.boat, dt, t, 0);
    } else {
      this.girl.isWalking = false;
      resolveGirlPhysics(this.girl, 'stars', this.boat, false);
      resolveBoatPhysics(this.boat, dt, t, 0);
    }
  }

  // Camera framing respecting all 4 camera rules across every state!
  computeShot() {
    const aspect = Math.max(0.5, window.innerWidth / Math.max(1, window.innerHeight));

    if (this.state === 'harbor') {
      const pts = [
        this.girl.pos.clone().add(new THREE.Vector3(0, 0.1, 0)),
        this.girl.pos.clone().add(new THREE.Vector3(0, 1.55, 0)),
        SHELL_MAP_POS.clone().add(new THREE.Vector3(0, 0.5, 0)),
        this.boat.pos.clone().add(new THREE.Vector3(0, 0.6, 0)),
        this.boat.pos.clone().add(new THREE.Vector3(0, 4.4, 0)),
      ];
      return fitShot({
        points: pts,
        dir: new THREE.Vector3(-0.42, 0.18, -0.89),
        fov: 44,
        aspect,
        margin: 0.15,
        minDist: 7.4,
        lift: 0.35,
      });
    }

    if (this.state === 'board') {
      const pts = [
        this.girl.pos.clone().add(new THREE.Vector3(0, 1.5, 0)),
        ...this.boat.getFramingPoints(),
      ];
      return fitShot({
        points: pts,
        dir: new THREE.Vector3(-0.55, 0.34, -0.76),
        fov: 42,
        aspect,
        margin: 0.18,
        minDist: 8.5,
      });
    }

    if (this.state === 'sail') {
      const boatPts = this.boat.getFramingPoints();
      const boostK = clamp(this.breezeTimer / 2.2, 0, 1);

      if (this.approachingIsland && boostK <= 0.1) {
        const pts = [
          ...boatPts,
          this.approachingIsland.dockPos.clone().add(new THREE.Vector3(0, 3.0, 0)),
        ];
        const backDir = new THREE.Vector3(-Math.sin(this.boat.yaw) * 0.85, 0.34, -Math.cos(this.boat.yaw) * 0.85);
        return {
          ...fitShot({ points: pts, dir: backDir, fov: 45, aspect, margin: 0.18, minDist: 14.0 }),
          anchor: this.boat.pos.clone(),
          anchorId: 'sail',
        };
      }

      // Dynamic speed framing during tailwind breeze boost: slightly wider FOV & lower horizon angle
      const backDir = new THREE.Vector3(-Math.sin(this.boat.yaw), 0.33 - boostK * 0.10, -Math.cos(this.boat.yaw));
      return {
        ...fitShot({
          points: boatPts,
          dir: backDir,
          fov: 44 + boostK * 5.0,
          aspect,
          margin: 0.20,
          minDist: 10.2 + boostK * 1.1,
          lift: 0.45 - boostK * 0.12,
        }),
        anchor: this.boat.pos.clone(),
        anchorId: 'sail',
      };
    }

    if (this.state === 'dock') {
      const isl = this.currentIsland;
      const pts = [
        ...this.boat.getFramingPoints(),
        isl.walkLanding.clone().add(new THREE.Vector3(0, 2.2, 0)),
      ];
      return fitShot({
        points: pts,
        dir: new THREE.Vector3(isl.center.x > 0 ? -0.68 : 0.68, 0.36, -0.64),
        fov: 44,
        aspect,
        margin: 0.18,
        minDist: 11.5,
      });
    }

    if (this.state === 'walk') {
      const isl = this.currentIsland;
      const toLandmark = new THREE.Vector3().subVectors(isl.landmarkPos, this.girl.pos);
      toLandmark.y = 0;
      if (toLandmark.lengthSq() < 0.01) toLandmark.set(0, 0, 1);
      toLandmark.normalize();
      const dir = new THREE.Vector3(-toLandmark.x * 0.78 - toLandmark.z * 0.42, 0.22, -toLandmark.z * 0.78 + toLandmark.x * 0.42);
      const pts = [
        this.girl.pos.clone().add(new THREE.Vector3(0, 0.1, 0)),
        this.girl.pos.clone().add(new THREE.Vector3(0, 1.65, 0)),
        this.girl.pos.clone().addScaledVector(toLandmark, 3.0).add(new THREE.Vector3(0, 1.2, 0)),
      ];
      return fitShot({
        points: pts,
        dir,
        fov: 42,
        aspect,
        margin: 0.18,
        minDist: 6.2,
        lift: 0.25,
      });
    }

    if (this.state === 'float') {
      // Keep descending girl dead-center in frame with generous headroom and boat below visible
      const center = this.girl.pos.clone().add(new THREE.Vector3(0, 0.85, 0));
      const pts = [
        this.girl.pos.clone().add(new THREE.Vector3(0, -0.45, 0)),
        this.girl.pos.clone().add(new THREE.Vector3(0, 2.35, 0)),
        this.girl.pos.clone().add(new THREE.Vector3(1.1, 0.85, 0)),
        this.girl.pos.clone().add(new THREE.Vector3(-1.1, 0.85, 0)),
      ];
      return {
        ...fitShot({
          points: pts,
          target: center,
          dir: new THREE.Vector3(-0.56, 0.25, -0.79),
          fov: 44,
          aspect,
          margin: 0.22,
          minDist: 6.0,
        }),
        anchor: this.girl.pos.clone(),
        anchorId: 'float',
      };
    }

    // stars: Close reunion framing girl + welcomer (faces unobstructed!) + entire uncut white sailboat on water
    if (this.phase === 'glideIn') {
      const pts = [
        ...this.boat.getFramingPoints(),
        WELCOMER_POS.clone().add(new THREE.Vector3(0, 1.7, 0)),
      ];
      return fitShot({
        points: pts,
        dir: new THREE.Vector3(0.38, 0.14, -0.91),
        fov: 44,
        aspect,
        margin: 0.15,
        minDist: 10.2,
        lift: 0.35,
      });
    }

    const reunionCenter = new THREE.Vector3(-1.15, 1.95, 181.6);
    const pts = [
      this.girl.pos.clone().add(new THREE.Vector3(0, 0.05, 0)),
      this.girl.pos.clone().add(new THREE.Vector3(0, 1.75, 0)),
      WELCOMER_POS.clone().add(new THREE.Vector3(0, 0.05, 0)),
      WELCOMER_POS.clone().add(new THREE.Vector3(0, 1.85, 0)),
      ...this.boat.getFramingPoints(),
    ];
    return fitShot({
      points: pts,
      target: reunionCenter,
      dir: new THREE.Vector3(0.35, 0.13, -0.93),
      fov: 44,
      aspect,
      margin: 0.12,
      minDist: 9.2,
    });
  }
}
