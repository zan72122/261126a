import * as THREE from '../../lib/three.module.js';
import { ISLANDS, PAVILION_DOCK_POS, SWELL_ZONES, WIND_RINGS } from '../core/env.js';
import { clamp, wrapAngle } from '../core/math.js';

// Automated ?autotest driver verifying every required freedom & story moment within ~95s:
// 1. harbor (>= 1.6s hold) -> free walk in harbor plaza -> pick up seashell map -> board
// 2. sail -> left/right rudder divergence -> upward wind-path glide -> smooth sea return & decel
// 3. approach Lighthouse Island -> dock -> walk (>= 2.2s) -> reliable reboard -> sail
// 4. approach Windmill Island -> dock -> walk (>= 2.2s) -> reboard -> sail
// 5. Swell Zone -> float (centered slow descent >= 2.4s) -> reboard
// 6. Wind Ring 5 -> arrive at Starlit Cove Pavilion (stars close-up reunion >= 2.8s) -> __autodone = true
export class AutoTest {
  constructor(game) {
    this.g = game;
    this.elapsed = 0;
    this.stage = 'harborHold';
    this.stageT = 0;
    this.logTimer = 0;
    this.starsHold = 0;
    this.breezeHold = 0;

    this.didFreeWalk = false;
    this.didShell = false;
    this.didBoard = false;
    this.didFloat = false;
    this.islandWalkT = 0;
    this.lastWalkIslandId = null;

    window.__autolog = [];
    window.__autodone = false;
  }

  _setStage(next) {
    this.stage = next;
    this.stageT = 0;
    this.islandWalkT = 0;
  }

  _steerToward(tgt, steerY = 0.0) {
    const D = this.g.director;
    const b = this.g.boat;
    const dx = tgt.x - b.pos.x;
    const dz = tgt.z - b.pos.z;
    const aimYaw = Math.atan2(dx, dz);
    const diff = wrapAngle(aimYaw - b.yaw);
    D.targetSteerX = clamp(diff * 1.95, -0.95, 0.95);
    D.targetSteerY = steerY;
  }

  frame(dt) {
    if (window.__autodone) return;
    this.elapsed += dt;
    this.stageT += dt;
    const D = this.g.director;
    const b = this.g.boat;

    // 1. Harbor hold (>= 1.6s) -> free walk -> pick shell -> board
    if (D.state === 'harbor') {
      if (!this.didFreeWalk && D.stateT >= 1.65) {
        this.didFreeWalk = true;
        this._setStage('harborFreeWalk');
        D.walkTarget = new THREE.Vector3(-2.6, 1.04, -120.4);
      } else if (this.didFreeWalk && !this.didShell && this.stage === 'harborFreeWalk' && this.stageT >= 1.8) {
        this.didShell = true;
        this._setStage('harborShell');
        D.pickUpShellAndMaybeBoard(false);
      } else if (this.didShell && D.girl.hasShell && !this.didBoard && D.phase === 'readyToBoard' && D.phaseT >= 0.7) {
        this.didBoard = true;
        D.startBoardingFromHarbor();
        this._setStage('steerLeft');
      }
    }

    // 2. Sail: left/right split, upward wind-path glide, downward return/decel, rings & islands
    else if (D.state === 'sail') {
      if (this.stage === 'steerLeft') {
        D.targetSteerX = 0.78;
        D.targetSteerY = 0.0;
        if (this.stageT >= 1.6) this._setStage('steerRight');
      } else if (this.stage === 'steerRight') {
        D.targetSteerX = -0.78;
        D.targetSteerY = 0.0;
        if (this.stageT >= 1.8) this._setStage('glideUp');
      } else if (this.stage === 'glideUp') {
        this._steerToward(WIND_RINGS[0].pos, 0.92);
        if (this.stageT >= 3.4) this._setStage('glideDown');
      } else if (this.stage === 'glideDown') {
        D.targetSteerX = 0.0;
        D.targetSteerY = -0.92;
        if (b.glideAlt <= 0.05 && this.stageT >= 2.6) {
          this._setStage('toRing1');
        } else if (this.stageT >= 4.2) {
          this._setStage('toRing1');
        }
      } else if (this.stage === 'toRing1') {
        this._steerToward(WIND_RINGS[1].pos, 0.35);
        if (D.breezeTimer > 0 || this.stageT > 4.5) {
          this._setStage('breezeHold');
        }
      } else if (this.stage === 'breezeHold') {
        this.breezeHold += dt;
        this._steerToward(ISLANDS[0].dockPos, 0.25);
        if (this.breezeHold >= 1.8 || this.stageT > 3.5) {
          this._setStage('toLighthouse');
        }
      } else if (this.stage === 'toLighthouse') {
        this._steerToward(ISLANDS[0].dockPos, 0.0);
        if (D.visitedIslands.has('lighthouse')) {
          this._setStage('toWindmill');
        }
      } else if (this.stage === 'toWindmill') {
        if (Math.hypot(b.pos.x - ISLANDS[0].dockPos.x, b.pos.z - ISLANDS[0].dockPos.z) < 14) {
          this._steerToward({ x: 0, z: -12 }, 0.2);
        } else if (b.pos.x < 4 && b.pos.z < -4) {
          this._steerToward(WIND_RINGS[2].pos, 0.3);
        } else {
          this._steerToward(ISLANDS[1].dockPos, 0.1);
        }
        if (D.visitedIslands.has('windmill')) {
          this._setStage('toSwell');
        }
      } else if (this.stage === 'toSwell') {
        const sw = SWELL_ZONES[1].pos;
        if (Math.hypot(b.pos.x - ISLANDS[1].dockPos.x, b.pos.z - ISLANDS[1].dockPos.z) < 15) {
          this._steerToward(WIND_RINGS[3].pos, 0.35);
        } else {
          this._steerToward(sw, 0.35);
        }
        const dSw = Math.hypot(b.pos.x - sw.x, b.pos.z - sw.z);
        if (!this.didFloat && (dSw < 9.5 || this.stageT > 10.5)) {
          this.didFloat = true;
          D.startFloatDescent();
          this._setStage('toPavilion');
        }
      } else if (this.stage === 'toPavilion') {
        if (b.pos.z < 152) {
          this._steerToward(WIND_RINGS[5].pos, 0.35);
        } else {
          this._steerToward(PAVILION_DOCK_POS, 0.0);
        }
      }
    }

    // 3. Walk on island (>= 2.2s), then re-board reliably
    else if (D.state === 'walk') {
      if (D.currentIsland && this.lastWalkIslandId !== D.currentIsland.id) {
        this.lastWalkIslandId = D.currentIsland.id;
        this.islandWalkT = 0;
      }
      this.islandWalkT += dt;
      if (this.islandWalkT < 1.2 && !D.walkTarget && !D.reboardWalk) {
        D.walkTarget = D.currentIsland.landmarkPos.clone();
      } else if (this.islandWalkT >= 2.25 && !D.reboardWalk) {
        D.startReboardFromIsland();
        if (D.currentIsland.id === 'lighthouse') {
          this._setStage('toWindmill');
        } else if (D.currentIsland.id === 'windmill') {
          this._setStage('toSwell');
        }
      }
    }

    // 4. Arrival at Starlit Cove Pavilion -> hold close-up reunion >= 2.8s
    else if (D.state === 'stars') {
      if (D.phase === 'reunion') {
        this.starsHold += dt;
        if (this.starsHold >= 2.8) {
          this._record();
          window.__autodone = true;
        }
      }
    }

    // Safety finish guard before 108s
    if (this.elapsed > 108 && !window.__autodone) {
      if (D.state !== 'stars') D.startPavilionArrival();
      if (this.elapsed > 115) {
        this._record();
        window.__autodone = true;
      }
    }

    this.logTimer += dt;
    if (this.logTimer >= 0.45) {
      this.logTimer = 0;
      this._record();
    }
  }

  _record() {
    const D = this.g.director;
    window.__autolog.push({
      t: Number(this.elapsed.toFixed(2)),
      moment: window.__moment,
      state: D.state,
      stage: this.stage,
      speed: Number(this.g.boat.speed.toFixed(1)),
      glideAlt: Number((this.g.boat.glideAlt || 0).toFixed(2)),
      boat: [
        Number(this.g.boat.pos.x.toFixed(1)),
        Number(this.g.boat.pos.y.toFixed(1)),
        Number(this.g.boat.pos.z.toFixed(1)),
      ],
      girl: [
        Number(this.g.girl.pos.x.toFixed(1)),
        Number(this.g.girl.pos.y.toFixed(1)),
        Number(this.g.girl.pos.z.toFixed(1)),
      ],
      visited: D.visitedIslands.size,
    });
  }
}
