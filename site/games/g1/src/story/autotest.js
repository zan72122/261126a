/**
 * Automated playthrough driver for ?autotest verification.
 * Exercises every required action and holds key compositions >= 1.5s:
 * 1. home (>= 1.85s) -> tap puppy/ticket -> lead to station
 * 2. board (>= 1.65s) -> board locomotive -> depart
 * 3. village (bridge & alpine village)
 * 4. sidetrack (Switch 1 -> Flower & Lumber Siding + whistle/valve steam play)
 * 5. lake (Lake Station, dismount & walk toward pier >= 2.15s, re-board)
 * 6. climb (mountain climb & stone gallery) -> viaduct -> aerial umbrella dismount -> float (>= 1.5s centered on girl) -> walk (>= 1.55s) -> re-board
 * 7. climb viaduct above cloud sea -> arrive at Cloud Summit Station -> summit (>= 2.8s)
 * Sets window.__autodone = true well within 120s.
 */
export class AutoTest {
  constructor(game) {
    this.g = game;
    this.elapsed = 0;
    this.lastMoment = '';

    this.didLead = false;
    this.didBoard = false;
    this.didSidetrackWhistle = false;
    this.didLakeWalk = false;
    this.didLakeReboard = false;
    this.didFloat = false;
    this.didPostFloatReboard = false;
    this.summitHold = 0;

    window.__autolog = [];
    window.__autodone = false;
  }

  _log(evt) {
    window.__autolog.push({
      t: Number(this.elapsed.toFixed(2)),
      moment: window.__moment,
      state: this.g.director.state,
      seg: this.g.director.segId,
      s: Number(this.g.director.segS.toFixed(2)),
      y: Number(this.g.girl.pos.y.toFixed(1)),
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

    // 1. HOME (hold >= 1.85s)
    if (D.state === 'home') {
      if (D.phase === 'waitPuppy' && !this.didLead && D.stateT >= 1.85) {
        this.didLead = true;
        this._log('tap_puppy_ticket');
        D.triggerHomeLead();
      }
    }

    // 2. BOARD (hold >= 1.65s)
    else if (D.state === 'board') {
      if (!this.didBoard && D.stateT >= 1.65) {
        this.didBoard = true;
        this._log('board_locomotive');
        D.triggerBoard();
      }
    }

    // 3..6. RIDE
    else if (D.state === 'ride') {
      if (D.segId === 'seg0_home_village') {
        D.targetSpeed = D.segS > 0.45 ? 14.0 : 12.5;
        D.speed = Math.max(D.speed, 10.0);
        this.g.tracks.setSwitch('sw1', 1);
      } else if (D.segId === 'seg1_flower') {
        D.targetSpeed = 14.0;
        if (!this.didSidetrackWhistle && D.segS > 0.35) {
          this.didSidetrackWhistle = true;
          this._log('sidetrack_whistle_valve');
          D.triggerWhistle(0.6);
          D.triggerValveSteam();
        }
      } else if (D.segId === 'seg2_lake') {
        this.g.tracks.setSwitch('sw2', 0);
        if (!this.didLakeWalk && D.segS >= 0.45) {
          this.didLakeWalk = true;
          this._log('lake_dismount_walk');
          D.triggerDismount();
        } else {
          D.targetSpeed = 14.0;
        }
      } else if (D.segId === 'seg3_climb') {
        this.g.tracks.setSwitch('sw3', 0);
        D.targetSpeed = 15.5;
      } else if (D.segId === 'seg4_main') {
        D.targetSpeed = 15.5;
      } else if (D.segId === 'seg5_viaduct') {
        D.targetSpeed = 16.0;
        if (!this.didFloat && D.segS >= 0.16) {
          this.didFloat = true;
          this._log('aerial_umbrella_dismount');
          D.triggerDismount();
        }
      }
    }

    // WALK
    else if (D.state === 'walk') {
      if (!this.didLakeReboard) {
        if (D.stateT < 0.25) {
          D.walkTarget = this.g.girl.pos.clone().add({ x: -5.5, y: 0, z: -1.5 });
        }
        if (D.stateT >= 2.15) {
          this.didLakeReboard = true;
          this._log('lake_reboard');
          D.triggerBoard();
        }
      } else if (this.didFloat && !this.didPostFloatReboard) {
        if (D.stateT < 0.25) {
          D.walkTarget = this.g.girl.pos.clone().add({ x: 2.2, y: 0, z: 1.5 });
        }
        if (D.stateT >= 1.55) {
          this.didPostFloatReboard = true;
          this._log('post_float_reboard');
          D.triggerBoard();
          D.targetSpeed = 16.5;
        }
      }
    }

    // FLOAT
    else if (D.state === 'float') {
      // Wait naturally for slow descent & landing
    }

    // SUMMIT
    else if (D.state === 'summit') {
      this.summitHold += dt;
      if (this.summitHold >= 2.8) {
        this._log('autotest_complete');
        window.__autodone = true;
      }
    }

    if (this.elapsed > 110 && !window.__autodone) {
      D.go('summit');
      this._log('safety_summit');
      window.__autodone = true;
    }
  }
}
