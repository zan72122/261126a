import * as THREE from '../../lib/three.module.js';

/**
 * Automated playthrough driver for ?autotest verification.
 * Demonstrates the free 3D agency controls end-to-end while holding key compositions >= 1.5s:
 * 1. home (>= 1.6s) -> tap garden sky/ground to walk freely -> tap puppy/ticket to lead to station
 * 2. board (>= 1.6s) -> board locomotive -> depart
 * 3. ride: steer LEFT off rail across valley (>= 2.2s) -> climb into sky (>= 2.2s)
 *          -> steer RIGHT & descend toward alpine lake/meadow (>= 2.2s) -> whistle/valve
 *          -> climb high & aerial umbrella dismount -> float centered on girl (>= 1.8s)
 * 4. walk: free tap-to-walk on landing (>= 1.8s) -> call/reboard locomotive
 * 5. release controls for Golden Steam Wind goal assist -> arrive at Cloud Summit Station (>= 2.6s)
 * Sets window.__autodone = true within 120s.
 */
export class AutoTest {
  constructor(game) {
    this.g = game;
    this.elapsed = 0;
    this.lastMoment = '';

    this.homeWalkDone = false;
    this.didLead = false;
    this.didBoard = false;

    this.ridePhase = 'leftDetour';
    this.ridePhaseT = 0;
    this.didFloat = false;
    this.didPostFloatReboard = false;
    this.walkTapDone = false;
    this.summitHold = 0;

    window.__autolog = [];
    window.__autodone = false;
  }

  _log(evt) {
    window.__autolog.push({
      t: Number(this.elapsed.toFixed(2)),
      moment: window.__moment,
      state: this.g.director.state,
      x: Number(this.g.loco.pos.x.toFixed(1)),
      y: Number(this.g.girl.pos.y.toFixed(1)),
      z: Number(this.g.loco.pos.z.toFixed(1)),
      evt,
    });
  }

  frame(dt) {
    if (window.__autodone) return;
    this.elapsed += dt;
    const D = this.g.director;

    if (window.__moment !== this.lastMoment) {
      this.lastMoment = window.__moment;
      this._log('moment_change');
    }

    // 1. HOME: hold opening composition >= 1.6s, test garden free walk, then lead to station
    if (D.state === 'home') {
      this.g.input.setSyntheticDrag(0, 0, false);
      if (D.phase === 'waitPuppy') {
        if (!this.homeWalkDone && D.stateT >= 1.65) {
          this.homeWalkDone = true;
          this._log('home_tap_sky_walk');
          D._handleTap(new THREE.Vector2(-0.65, 0.55));
        } else if (this.homeWalkDone && !this.didLead && D.stateT >= 3.2) {
          this.didLead = true;
          this._log('tap_puppy_ticket');
          D.triggerHomeLead();
        }
      }
    }

    // 2. BOARD (>= 1.6s)
    else if (D.state === 'board') {
      this.g.input.setSyntheticDrag(0, 0, false);
      if (!this.didBoard && D.stateT >= 1.65) {
        this.didBoard = true;
        this._log('board_locomotive');
        D.triggerBoard();
      }
    }

    // 3. RIDE: demonstrate real 3D steering (left, ascend, right+descend, off-rail flight, dismount, assist)
    else if (D.state === 'ride') {
      this.ridePhaseT += dt;

      if (this.ridePhase === 'leftDetour') {
        this.g.input.setSyntheticDrag(-0.82, -0.18, true);
        if (this.ridePhaseT >= 2.8) {
          this._log('left_detour_off_rail');
          this.ridePhase = 'skyClimb';
          this.ridePhaseT = 0;
        }
      } else if (this.ridePhase === 'skyClimb') {
        this.g.input.setSyntheticDrag(0.12, -0.88, true);
        if (this.ridePhaseT >= 2.6) {
          this._log('sky_climb_off_rail');
          D.triggerWhistle(0.55);
          D.triggerValveSteam();
          this.ridePhase = 'rightDescend';
          this.ridePhaseT = 0;
        }
      } else if (this.ridePhase === 'rightDescend') {
        this.g.input.setSyntheticDrag(0.78, 0.85, true);
        if (this.ridePhaseT >= 2.8) {
          this._log('right_descend_valley');
          this.ridePhase = 'climbForFloat';
          this.ridePhaseT = 0;
        }
      } else if (this.ridePhase === 'climbForFloat') {
        this.g.input.setSyntheticDrag(-0.15, -0.92, true);
        if (!this.didFloat && this.ridePhaseT >= 2.6 && this.g.loco.pos.y > 14.0) {
          this.didFloat = true;
          this.g.input.setSyntheticDrag(0, 0, false);
          this._log('aerial_umbrella_dismount');
          D.triggerDismount();
          this.ridePhase = 'assistToSummit';
          this.ridePhaseT = 0;
        }
      } else if (this.ridePhase === 'assistToSummit') {
        // Release finger so Golden Steam Wind carries locomotive to Cloud Summit Station
        this.g.input.setSyntheticDrag(0, 0, false);
      }
    }

    // 4. FLOAT: hold slow umbrella descent centered on girl
    else if (D.state === 'float') {
      this.g.input.setSyntheticDrag(0, 0, false);
    }

    // 5. WALK: tap ground/direction to walk freely >= 1.8s, then call & reboard
    else if (D.state === 'walk') {
      this.g.input.setSyntheticDrag(0, 0, false);
      if (!this.walkTapDone && D.stateT >= 0.2) {
        this.walkTapDone = true;
        this._log('walk_tap_free');
        D._handleTap(new THREE.Vector2(0.45, -0.15));
      }
      if (!this.didPostFloatReboard && D.stateT >= 2.0) {
        this.didPostFloatReboard = true;
        this._log('post_float_call_reboard');
        D.callOrBoardLocomotive();
      }
    }

    // 6. SUMMIT (>= 2.6s)
    else if (D.state === 'summit') {
      this.g.input.setSyntheticDrag(0, 0, false);
      this.summitHold += dt;
      if (this.summitHold >= 2.6) {
        this._log('autotest_complete');
        window.__autodone = true;
      }
    }

    if (this.elapsed > 110 && !window.__autodone) {
      this.g.input.setSyntheticDrag(0, 0, false);
      D.go('summit');
      this._log('safety_summit');
      window.__autodone = true;
    }
  }
}
