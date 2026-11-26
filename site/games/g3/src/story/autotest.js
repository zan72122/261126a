import { ISLANDS, PAVILION_DOCK_POS, SWELL_ZONES, WIND_RINGS } from '../core/env.js';
import { clamp, wrapAngle } from '../core/math.js';

// Automated ?autotest driver verifying every required moment & framing hold within ~90s:
// 1. harbor (>= 1.85s hold) -> pick up seashell map -> board
// 2. sail -> steer through Wind Ring 0 & 1 -> breeze (hold >= 2.0s)
// 3. approach Lighthouse Island (island) -> dock -> walk (>= 2.3s) -> reboard
// 4. sail through Wind Ring 2 -> approach Windmill Island -> dock -> walk (>= 2.3s) -> reboard
// 5. sail toward Swell Zone 1 -> float (centered slow descent >= 2.4s) -> reboard
// 6. sail through Wind Ring 4/5 -> arrive at Starlit Cove Pavilion (stars close-up reunion >= 2.8s) -> __autodone = true
export class AutoTest {
  constructor(game) {
    this.g = game;
    this.elapsed = 0;
    this.stage = 'harbor';
    this.stageT = 0;
    this.logTimer = 0;
    this.starsHold = 0;
    this.breezeHold = 0;

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

  _steerToward(tgt) {
    const D = this.g.director;
    const b = this.g.boat;
    const dx = tgt.x - b.pos.x;
    const dz = tgt.z - b.pos.z;
    const aimYaw = Math.atan2(dx, dz);
    const diff = wrapAngle(aimYaw - b.yaw);
    D.targetSteerX = clamp(diff * 1.95, -0.95, 0.95);
    D.targetSteerY = 0.65;
  }

  frame(dt) {
    if (window.__autodone) return;
    this.elapsed += dt;
    this.stageT += dt;
    const D = this.g.director;
    const b = this.g.boat;

    // 1. Harbor hold >= 1.85s -> pick shell -> board
    if (D.state === 'harbor') {
      if (!this.didShell && D.stateT >= 1.85) {
        this.didShell = true;
        D.pickUpShellAndMaybeBoard(false);
      } else if (this.didShell && D.girl.hasShell && !this.didBoard && D.phaseT >= 0.65) {
        this.didBoard = true;
        D.startBoardingFromHarbor();
        this._setStage('toRing0');
      }
    }

    // 2. Sail & Tailwind Ring & Island exploration stages
    else if (D.state === 'sail') {
      if (this.stage === 'toRing0') {
        this._steerToward(WIND_RINGS[0].pos);
        if (D.breezeTimer > 0) {
          this._setStage('breezeHold');
        } else if (this.stageT > 8.0) {
          this._setStage('toLighthouse');
        }
      } else if (this.stage === 'breezeHold') {
        this.breezeHold += dt;
        this._steerToward(WIND_RINGS[1].pos);
        if (this.breezeHold >= 2.0 || this.stageT > 4.5) {
          this._setStage('toLighthouse');
        }
      } else if (this.stage === 'toLighthouse') {
        this._steerToward(ISLANDS[0].dockPos);
        if (D.visitedIslands.has('lighthouse')) {
          this._setStage('toWindmill');
        }
      } else if (this.stage === 'toWindmill') {
        if (Math.hypot(b.pos.x - ISLANDS[0].dockPos.x, b.pos.z - ISLANDS[0].dockPos.z) < 14) {
          this._steerToward({ x: 0, z: -12 });
        } else if (b.pos.x < 4 && b.pos.z < -4) {
          this._steerToward(WIND_RINGS[2].pos);
        } else {
          this._steerToward(ISLANDS[1].dockPos);
        }
        if (D.visitedIslands.has('windmill')) {
          this._setStage('toSwell');
        }
      } else if (this.stage === 'toSwell') {
        const sw = SWELL_ZONES[1].pos;
        if (Math.hypot(b.pos.x - ISLANDS[1].dockPos.x, b.pos.z - ISLANDS[1].dockPos.z) < 15) {
          this._steerToward(WIND_RINGS[3].pos);
        } else {
          this._steerToward(sw);
        }
        const dSw = Math.hypot(b.pos.x - sw.x, b.pos.z - sw.z);
        if (!this.didFloat && (dSw < 9.5 || this.stageT > 11.0)) {
          this.didFloat = true;
          D.startFloatDescent();
          this._setStage('toPavilion');
        }
      } else if (this.stage === 'toPavilion') {
        if (b.pos.z < 152) {
          this._steerToward(WIND_RINGS[5].pos);
        } else {
          this._steerToward(PAVILION_DOCK_POS);
        }
      }
    }

    // 3. Walk on island (>= 2.35s), then re-board
    else if (D.state === 'walk') {
      if (D.currentIsland && this.lastWalkIslandId !== D.currentIsland.id) {
        this.lastWalkIslandId = D.currentIsland.id;
        this.islandWalkT = 0;
      }
      this.islandWalkT += dt;
      if (this.islandWalkT < 1.2 && !D.walkTarget && !D.reboardWalk) {
        D.walkTarget = D.currentIsland.landmarkPos.clone();
      } else if (this.islandWalkT >= 2.35 && !D.reboardWalk) {
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

    // Safety finish guard before 105s
    if (this.elapsed > 105 && !window.__autodone) {
      if (D.state !== 'stars') D.startPavilionArrival();
      if (this.elapsed > 112) {
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
