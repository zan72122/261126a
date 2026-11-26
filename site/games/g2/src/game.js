// Main game orchestrator: world setup, 1-finger input, flight & float physics, 20s assist, ?autotest, ?q=low
import * as THREE from '../lib/three.module.js';
import { PALETTE } from './core/palette.js';
import { clamp, damp, angleDiff, wrapAngle, smoothstep } from './core/math.js';
import { SoundEngine } from './core/audio.js';
import {
  LANDMARKS,
  WATER_Y,
  terrainHeight,
  isOverRiver,
  isOnBridgeOrPier,
  riverCenterZ,
  riverHalfWidth,
  makeTerrainMesh,
} from './world/terrain.js';
import { ColliderWorld } from './world/colliders.js';
import { SkyDome, SUN_DIR } from './world/sky.js';
import { ValleyClouds } from './world/clouds.js';
import { buildVillage } from './world/village.js';
import { buildNature } from './world/nature.js';
import { GirlCharacter, makeFlowerLetter } from './chars/girl.js';
import { RecipientCharacter } from './chars/recipient.js';
import { HotAirBalloon } from './chars/balloon.js';
import { DandelionFloat } from './chars/dandelion.js';
import { ThermalSystem } from './fx/thermals.js';
import { MorningSunbeams } from './fx/sunbeams.js';
import { CameraRig, fitPointsShot } from './story/camera.js';

export class Game {
  constructor(params) {
    this.params = params;
    this.lowQuality = params.get('q') === 'low';
    this.autotest = params.has('autotest');
    this.debug = params.has('debug');

    this.time = 0;
    this.state = 'garden'; // garden | walk | board | fly | float | tower
    this.hasLetter = true;
    this.girlHoldingLetter = false;
    this.letterInBasket = false;
    this.letterDelivered = false;

    // Girl positioned clearly in center-foreground of garden facing the stone table & balloon
    this.girlPos = new THREE.Vector3(-0.35, terrainHeight(-0.35, 0.4), 0.4);
    this.girlYaw = Math.PI * 0.88;
    this.girlWalkTarget = null;
    this.pendingBoardAfterWalk = false;
    this.pendingPickAfterWalk = false;

    this.balloonPos = new THREE.Vector3(
      LANDMARKS.balloonPad.x,
      terrainHeight(LANDMARKS.balloonPad.x, LANDMARKS.balloonPad.z),
      LANDMARKS.balloonPad.z
    );
    this.balloonYaw = 0.0;
    this.balloonVel = new THREE.Vector3();
    this.balloonTargetAlt = this.balloonPos.y + 14;
    this.balloonGrounded = true;
    this.balloonSummoning = false;
    this.balloonSummonTarget = null;

    this.floatVel = new THREE.Vector3();
    this.circlingAccum = 0;
    this.riseTimer = 0;
    this.boardTimer = 0;
    this.burnerBoost = 0;
    this.thermalLiftTimer = 0;
    this.towerPhase = 0;
    this.bellSwing = 0;

    // 20-second gentle assist timer
    this.progressTimer = 0;
    this.bestTowerDist = 9999;

    // Pointer / 1-finger drag state
    this.pointerDown = false;
    this.pointerStart = { x: 0, y: 0 };
    this.pointerCurr = { x: 0, y: 0 };
    this.pointerMoved = 0;
    this.steerInput = { turn: 0, climb: 0, active: false };

    // Autotest state
    this.autoStep = 0;
    this.autoTimer = 0;
    this.autoSteer = { turn: 0, climb: 0 };
    this.autoHoldUntil = 0;

    this.sound = new SoundEngine();
  }

  async init() {
    const canvas = document.getElementById('c');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.lowQuality,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.lowQuality ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = !this.lowQuality;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(PALETTE.skyMist, this.lowQuality ? 0.00105 : 0.0009);

    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.25, 3200);
    this.camRig = new CameraRig(this.camera);

    // Morning sky & PMREM environment lighting
    this.sky = new SkyDome();
    this.scene.add(this.sky.mesh);
    if (!this.lowQuality) {
      this.scene.environment = this.sky.makeEnvironment(this.renderer);
      this.scene.environmentIntensity = 0.60;
    }

    // Morning hemisphere fill + warm eastern directional sunlight for sculptural sun/shadow relief
    const hemi = new THREE.HemisphereLight(PALETTE.skyHorizon, PALETTE.meadowSage, 0.72);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xfff0d6, 1.82);
    this.sunLight.position.copy(SUN_DIR).multiplyScalar(120);
    if (!this.lowQuality) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.camera.near = 12;
      this.sunLight.shadow.camera.far = 250;
      const d = 38;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.bias = -0.00015;
      this.sunLight.shadow.normalBias = 0.055;
    }
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Build terrain, clouds, village, flora, sunbeams, thermals
    this.terrainMesh = makeTerrainMesh(this.lowQuality);
    this.scene.add(this.terrainMesh);

    this.clouds = new ValleyClouds(this.lowQuality);
    this.scene.add(this.clouds.group);

    this.colliders = new ColliderWorld();
    this.village = buildVillage(this.lowQuality, this.colliders);
    this.scene.add(this.village.group);

    this.nature = buildNature(this.lowQuality, this.colliders);
    this.scene.add(this.nature.group);

    this.sunbeams = new MorningSunbeams(this.lowQuality);
    this.scene.add(this.sunbeams.group);

    this.thermals = new ThermalSystem(this.lowQuality);
    this.scene.add(this.thermals.group);

    // Table flower letter (before pickup)
    this.tableLetter = makeFlowerLetter();
    this.tableLetter.position.set(
      LANDMARKS.letterPedestal.x,
      terrainHeight(LANDMARKS.letterPedestal.x, LANDMARKS.letterPedestal.z) + 0.80,
      LANDMARKS.letterPedestal.z
    );
    this.tableLetter.scale.setScalar(1.35);
    this.scene.add(this.tableLetter);

    this.letterBeacon = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 0.86, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: PALETTE.apricotSoft, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
    );
    this.letterBeacon.position.set(
      LANDMARKS.letterPedestal.x,
      terrainHeight(LANDMARKS.letterPedestal.x, LANDMARKS.letterPedestal.z) + 0.05,
      LANDMARKS.letterPedestal.z
    );
    this.scene.add(this.letterBeacon);

    // Characters & Hot Air Balloon & Dandelion Float (dandelion attached to scene so girl's Box3 stays accurate)
    this.girl = new GirlCharacter(this.lowQuality);
    this.girl.group.position.copy(this.girlPos);
    this.girl.group.rotation.y = this.girlYaw;
    this.scene.add(this.girl.group);

    this.dandelion = new DandelionFloat();
    this.scene.add(this.dandelion.group);

    this.balloon = new HotAirBalloon(this.lowQuality);
    this.balloon.group.position.copy(this.balloonPos);
    this.scene.add(this.balloon.group);

    // Main welcoming recipient standing right in the front-center of Clock Tower Square
    this.recipient = new RecipientCharacter(this.lowQuality);
    const recX = LANDMARKS.towerPlaza.x + 1.35;
    const recZ = LANDMARKS.towerPlaza.z + 2.65;
    const recY = terrainHeight(recX, recZ);
    this.recipient.group.position.set(recX, recY, recZ);
    this.recipient.group.rotation.y = -0.72;
    this.scene.add(this.recipient.group);
    this.colliders.addCylinder({
      x: recX,
      z: recZ,
      r: 0.42,
      minY: recY,
      maxY: recY + 1.45,
      kind: 'npc',
      label: 'recipient',
    });

    this.actionBtn = document.getElementById('action-btn');
    this.iconDandelion = document.getElementById('icon-dandelion');
    this.iconBalloon = document.getElementById('icon-balloon');
    this.fpsEl = document.getElementById('fps');
    if (this.debug) this.fpsEl.style.display = 'block';

    this._setupInput(canvas);
    window.addEventListener('resize', () => this._onResize());

    this.camRig.snap(this._computeDesiredShot());
    this._setMoment('garden');

    this.renderer.render(this.scene, this.camera);
    const veil = document.getElementById('veil');
    if (veil) {
      requestAnimationFrame(() => {
        veil.style.opacity = '0';
      });
    }

    if (this.autotest) {
      this._logAuto('start', 'garden');
      this.autoHoldUntil = 2.0;
    }

    window.__ready = true;
    this._lastTime = performance.now();
    this._fpsFrames = 0;
    this._fpsTimer = 0;
    requestAnimationFrame((t) => this._loop(t));
  }

  _onResize() {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _setMoment(m) {
    if (window.__moment !== m) {
      window.__moment = m;
      if (this.autotest) {
        this._logAuto('moment', m);
      }
    }
  }

  _logAuto(kind, detail) {
    window.__autolog.push({
      t: Number(this.time.toFixed(2)),
      kind,
      detail,
      moment: window.__moment,
      balloon: [Number(this.balloonPos.x.toFixed(1)), Number(this.balloonPos.y.toFixed(1)), Number(this.balloonPos.z.toFixed(1))],
      girl: [Number(this.girlPos.x.toFixed(1)), Number(this.girlPos.y.toFixed(1)), Number(this.girlPos.z.toFixed(1))],
    });
  }

  _setupInput(canvas) {
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    this.actionBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.sound.unlock();
      if (this.autotest) return;
      if (this.state === 'fly') {
        this._startFloatDismount();
      } else if (this.state === 'walk') {
        this._callBalloonToGirl();
      }
    });

    canvas.addEventListener('pointerdown', (e) => {
      this.sound.unlock();
      if (this.autotest) return;
      this.pointerDown = true;
      this.pointerStart.x = e.clientX;
      this.pointerStart.y = e.clientY;
      this.pointerCurr.x = e.clientX;
      this.pointerCurr.y = e.clientY;
      this.pointerMoved = 0;
      this.progressTimer = 0;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.pointerDown || this.autotest) return;
      const dx = e.clientX - this.pointerCurr.x;
      const dy = e.clientY - this.pointerCurr.y;
      this.pointerMoved += Math.hypot(dx, dy);
      this.pointerCurr.x = e.clientX;
      this.pointerCurr.y = e.clientY;

      if (this.state === 'fly' || this.state === 'float') {
        const totalDx = (this.pointerCurr.x - this.pointerStart.x) / Math.max(220, window.innerWidth * 0.25);
        const totalDy = (this.pointerStart.y - this.pointerCurr.y) / Math.max(180, window.innerHeight * 0.25);
        this.steerInput.turn = clamp(-totalDx, -1, 1);
        this.steerInput.climb = clamp(totalDy, -1, 1);
        this.steerInput.active = true;
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.pointerDown) return;
      this.pointerDown = false;
      this.steerInput.active = false;
      this.steerInput.turn = 0;
      this.steerInput.climb = 0;

      if (this.autotest) return;

      if (this.pointerMoved < 16) {
        ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
        ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(ndc, this.camera);
        this._handleTap(raycaster);
      }
    });

    window.addEventListener('pointercancel', () => {
      this.pointerDown = false;
      this.steerInput.active = false;
      this.steerInput.turn = 0;
      this.steerInput.climb = 0;
    });
  }

  _handleTap(raycaster) {
    if (this.state === 'tower') return;

    if (this.state === 'fly') {
      const hits = raycaster.intersectObjects([this.girl.group, this.balloon.basketGroup], true);
      if (hits.length > 0) {
        this._startFloatDismount();
        return;
      }
      const dir = raycaster.ray.direction;
      if (Math.abs(dir.y) > 0.05) {
        const targetYaw = Math.atan2(-dir.x, -dir.z);
        this.balloonYaw = wrapAngle(this.balloonYaw + clamp(angleDiff(this.balloonYaw, targetYaw), -0.45, 0.45));
      }
      if (dir.y > 0.12) {
        this.balloonTargetAlt = Math.min(74, this.balloonTargetAlt + 5.5);
        this.burnerBoost = 0.85;
      } else if (dir.y < -0.15) {
        this.balloonTargetAlt = Math.max(terrainHeight(this.balloonPos.x, this.balloonPos.z) + 0.5, this.balloonTargetAlt - 5.5);
      }
      return;
    }

    if (this.state === 'garden') {
      if (!this.girlHoldingLetter && !this.letterInBasket) {
        const hitLetter = raycaster.intersectObjects([this.tableLetter, this.letterBeacon], true);
        if (hitLetter.length > 0) {
          this._walkToPickLetter(false);
          return;
        }
      }
      const hitBalloon = raycaster.intersectObject(this.balloon.group, true);
      if (hitBalloon.length > 0) {
        if (!this.girlHoldingLetter && !this.letterInBasket) {
          this._walkToPickLetter(true);
        } else {
          this._walkToBoardBalloon();
        }
        return;
      }
      const hitGround = raycaster.intersectObject(this.terrainMesh, false);
      if (hitGround.length > 0) {
        const pt = hitGround[0].point;
        if (!this.girlHoldingLetter && pt.distanceTo(this.tableLetter.position) < 4.5) {
          this._walkToPickLetter(false);
        } else if (this.girlHoldingLetter && pt.distanceTo(this.balloonPos) < 5.5) {
          this._walkToBoardBalloon();
        } else {
          this.girlWalkTarget = pt.clone();
          this.pendingPickAfterWalk = false;
          this.pendingBoardAfterWalk = false;
        }
      }
      return;
    }

    if (this.state === 'walk') {
      const hitBalloon = raycaster.intersectObject(this.balloon.group, true);
      if (hitBalloon.length > 0) {
        this._walkToBoardBalloon();
        return;
      }
      const hitGround = raycaster.intersectObject(this.terrainMesh, false);
      if (hitGround.length > 0) {
        const pt = hitGround[0].point;
        if (pt.distanceTo(this.balloonPos) < 4.5) {
          this._walkToBoardBalloon();
        } else {
          this.girlWalkTarget = pt.clone();
          this.pendingBoardAfterWalk = false;
        }
      }
    }
  }

  _walkToPickLetter(andThenBoard) {
    this.girlWalkTarget = new THREE.Vector3(LANDMARKS.letterPedestal.x + 0.92, 0, LANDMARKS.letterPedestal.z + 0.92);
    this.girlWalkTarget.y = terrainHeight(this.girlWalkTarget.x, this.girlWalkTarget.z);
    this.pendingPickAfterWalk = true;
    this.pendingBoardAfterWalk = andThenBoard;
  }

  _walkToBoardBalloon() {
    this.girlWalkTarget = this.balloonPos.clone();
    this.pendingBoardAfterWalk = true;
  }

  _startBoarding() {
    this.state = 'board';
    this.boardTimer = 0;
    this.girlWalkTarget = null;
    this.pendingBoardAfterWalk = false;
    this.balloonGrounded = false;
    this.balloonSummoning = false;
    if (this.girlHoldingLetter) {
      this.girlHoldingLetter = false;
      this.letterInBasket = true;
    }
    this.balloon.basketLetter.visible = this.letterInBasket;
    this.sound.playPickup();
    this._setMoment('board');
  }

  _startFloatDismount() {
    if (this.state !== 'fly') return;
    this.state = 'float';
    this.girlPos.set(
      this.balloonPos.x + Math.cos(this.balloonYaw) * 3.4,
      this.balloonPos.y + 1.1,
      this.balloonPos.z - Math.sin(this.balloonYaw) * 3.4
    );
    this.floatVel.set(0, -2.2, 0);
    this.colliders.resolveFloatGirl(this.girlPos, this.floatVel, {
      radius: 0.48,
      height: 2.0,
      terrainHeight,
      isOverRiver,
      riverCenterZ,
      riverHalfWidth,
      isOnDeck: isOnBridgeOrPier,
      waterY: WATER_Y,
      dt: 0.016,
    });
    this.balloonGrounded = false;
    this.sound.playFloatOpen();
    this._setMoment('float');
  }

  _callBalloonToGirl() {
    this.balloonSummoning = true;
    this.balloonGrounded = false;
    const target = new THREE.Vector3(this.girlPos.x + 2.4, terrainHeight(this.girlPos.x + 2.4, this.girlPos.z - 1.6), this.girlPos.z - 1.6);
    this.colliders.resolveWalker(target, {
      radius: 1.15,
      height: 2.0,
      terrainHeight,
      isOverRiver,
      riverCenterZ,
      riverHalfWidth,
      isOnDeck: isOnBridgeOrPier,
      waterY: WATER_Y,
    });
    this.balloonSummonTarget = target;
  }

  _loop(now) {
    const maxDt = this.autotest ? 0.11 : 0.05;
    const dt = Math.min(maxDt, Math.max(0.001, (now - this._lastTime) / 1000));
    this._lastTime = now;
    this.time += dt;

    if (this.autotest) {
      this._updateAutotest(dt);
    }

    this._updateWorld(dt);
    this._updateCamera(dt);

    // Keep directional shadow frustum cleanly snapped near active focus
    const focus = this.state === 'fly' ? this.balloonPos : this.girlPos;
    this.sunLight.position.set(focus.x + SUN_DIR.x * 95, focus.y + SUN_DIR.y * 95, focus.z + SUN_DIR.z * 95);
    this.sunLight.target.position.copy(focus);
    this.sunLight.target.updateMatrixWorld();

    this.renderer.render(this.scene, this.camera);

    if (this.debug) {
      this._fpsFrames++;
      this._fpsTimer += dt;
      if (this._fpsTimer > 0.4) {
        const fps = Math.round(this._fpsFrames / this._fpsTimer);
        this.fpsEl.textContent = `FPS ${fps} | ${this.state} | ${window.__moment}\ny=${this.balloonPos.y.toFixed(1)} auto=${this.autoStep}`;
        this._fpsFrames = 0;
        this._fpsTimer = 0;
      }
    }

    requestAnimationFrame((t) => this._loop(t));
  }

  _updateWorld(dt) {
    const focusPos = this.state === 'fly' ? this.balloonPos : this.girlPos;
    this.sky.update(this.time, focusPos.y);
    this.clouds.update(dt, this.time, this.camera.position);
    this.nature.update(this.time);
    this.sunbeams.update(dt, this.time, focusPos);
    this.village.update(this.time, this.bellSwing);
    this.recipient.update(this.time, this.state !== 'tower' || this.towerPhase < 1);
    this.bellSwing = Math.max(0, this.bellSwing - dt * 0.28);

    if (this.state === 'fly' && !this.autotest) {
      this.actionBtn.classList.add('visible');
      this.iconDandelion.style.display = 'block';
      this.iconBalloon.style.display = 'none';
    } else if (this.state === 'walk' && !this.autotest && this.girlPos.distanceTo(this.balloonPos) > 10) {
      this.actionBtn.classList.add('visible');
      this.iconDandelion.style.display = 'none';
      this.iconBalloon.style.display = 'block';
    } else {
      this.actionBtn.classList.remove('visible');
    }

    const showTableLetter = !this.girlHoldingLetter && !this.letterInBasket && !this.letterDelivered;
    this.tableLetter.visible = showTableLetter;
    this.letterBeacon.visible = showTableLetter;
    if (showTableLetter) {
      const s = 1 + Math.sin(this.time * 3.2) * 0.1;
      this.letterBeacon.scale.set(s, s, 1);
    }

    let walking = false;
    let burnerLevel = 0;
    let airSpeed = 0;
    let climbRate = 0;
    let turnRate = 0;

    if (this.state === 'garden' || this.state === 'walk') {
      if (!this.balloonGrounded) {
        const summon = this.balloonSummoning && this.balloonSummonTarget ? this.balloonSummonTarget : this.balloonPos;
        const targetX = summon.x;
        const targetZ = summon.z;
        this.balloonPos.x = damp(this.balloonPos.x, targetX, 1.8, dt);
        this.balloonPos.z = damp(this.balloonPos.z, targetZ, 1.8, dt);
        const gY = Math.max(WATER_Y + 0.14, terrainHeight(this.balloonPos.x, this.balloonPos.z));
        this.balloonPos.y = damp(this.balloonPos.y, gY, 2.2, dt);
        this.colliders.resolveBalloon(this.balloonPos, this.balloonVel, {
          inFlight: true,
          terrainHeight,
          isOverRiver,
          isOnDeck: isOnBridgeOrPier,
          waterY: WATER_Y,
        });
        const settledY = Math.max(WATER_Y + 0.14, terrainHeight(this.balloonPos.x, this.balloonPos.z));
        if (Math.abs(this.balloonPos.y - settledY) < 0.15 && Math.hypot(this.balloonPos.x - targetX, this.balloonPos.z - targetZ) < 0.8) {
          this.balloonPos.y = settledY;
          this.balloonGrounded = true;
          this.balloonSummoning = false;
          this.balloonSummonTarget = null;
        }
      } else {
        this.colliders.resolveBalloon(this.balloonPos, this.balloonVel, {
          inFlight: false,
          terrainHeight,
          isOverRiver,
          isOnDeck: isOnBridgeOrPier,
          waterY: WATER_Y,
        });
      }

      if (this.girlWalkTarget) {
        if (this.pendingBoardAfterWalk && !this.pendingPickAfterWalk) {
          this.girlWalkTarget.copy(this.balloonPos);
        }
        const dx = this.girlWalkTarget.x - this.girlPos.x;
        const dz = this.girlWalkTarget.z - this.girlPos.z;
        const dist = Math.hypot(dx, dz);
        const stopDist = (this.pendingBoardAfterWalk && !this.pendingPickAfterWalk) ? 1.35 : 0.35;
        if (dist > stopDist) {
          walking = true;
          const step = Math.min(dist, 3.6 * dt);
          this.girlPos.x += (dx / dist) * step;
          this.girlPos.z += (dz / dist) * step;
          this.girlYaw = wrapAngle(this.girlYaw + angleDiff(this.girlYaw, Math.atan2(dx, dz)) * Math.min(1, dt * 10));
        } else {
          this.girlWalkTarget = null;
          if (this.pendingPickAfterWalk) {
            this.pendingPickAfterWalk = false;
            this.girlHoldingLetter = true;
            this.sound.playPickup();
            if (this.pendingBoardAfterWalk) {
              this._walkToBoardBalloon();
            }
          } else if (this.pendingBoardAfterWalk) {
            this._startBoarding();
          }
        }
      } else if (this.state === 'garden' && !this.autotest) {
        this.progressTimer += dt;
        if (this.progressTimer > 18.0) {
          this.progressTimer = 0;
          if (!this.girlHoldingLetter && !this.letterInBasket) {
            this._walkToPickLetter(true);
          } else {
            this._walkToBoardBalloon();
          }
        }
      } else if (this.state === 'walk' && !this.autotest) {
        this.progressTimer += dt;
        if (this.progressTimer > 20.0) {
          this.progressTimer = 0;
          this._callBalloonToGirl();
          this._walkToBoardBalloon();
        }
      }

      // Always resolve solid collisions for the girl (handles walking slides + push-in tests)
      this.colliders.resolveWalker(this.girlPos, {
        radius: 0.36,
        height: 1.32,
        terrainHeight,
        isOverRiver,
        riverCenterZ,
        riverHalfWidth,
        isOnDeck: isOnBridgeOrPier,
        waterY: WATER_Y,
      });

      this.girl.setPose({
        mode: walking ? 'walk' : 'idle',
        time: this.time,
        walkSpeed: walking ? 3.5 : 0,
        holdingLetter: this.girlHoldingLetter,
      });
      this.girl.group.position.copy(this.girlPos);
      this.girl.group.rotation.y = this.girlYaw;
      this.dandelion.update(this.time, false);
      this.balloon.update(this.time, {
        burnerLevel: 0,
        showBeacon: this.balloonGrounded && (this.girlHoldingLetter || this.letterInBasket),
      });
    } else if (this.state === 'board') {
      this.boardTimer += dt;
      this.girlPos.lerp(new THREE.Vector3(this.balloonPos.x, this.balloonPos.y + 0.18, this.balloonPos.z), Math.min(1, dt * 7));
      this.girlYaw = this.balloonYaw + Math.PI;
      this.girl.setPose({ mode: 'aboard', time: this.time, holdingLetter: false });
      this.girl.group.position.copy(this.girlPos);
      this.girl.group.rotation.y = this.girlYaw;
      burnerLevel = clamp(this.boardTimer / 0.9, 0, 1);
      this.balloon.update(this.time, { burnerLevel, showBeacon: false });
      this.dandelion.update(this.time, false);

      if (this.boardTimer > 1.0) {
        this.state = 'fly';
        this.riseTimer = 0;
        const groundY = terrainHeight(this.balloonPos.x, this.balloonPos.z);
        this.balloonTargetAlt = Math.max(this.balloonPos.y + 16, groundY + 18);
        this.burnerBoost = 1.0;
        this._setMoment('rise');
      }
    } else if (this.state === 'fly') {
      this.riseTimer += dt;
      this.burnerBoost = Math.max(0, this.burnerBoost - dt * 0.42);
      this.thermalLiftTimer = Math.max(0, this.thermalLiftTimer - dt);

      const steer = this.autotest ? this.autoSteer : this.steerInput;
      const groundHere = Math.max(WATER_Y + 0.14, terrainHeight(this.balloonPos.x, this.balloonPos.z));

      const towerCenter = this.village.landingCenter;
      const distToTower = Math.hypot(this.balloonPos.x - towerCenter.x, this.balloonPos.z - towerCenter.z);
      if (distToTower < this.bestTowerDist - 2.0) {
        this.bestTowerDist = distToTower;
        this.progressTimer = 0;
      } else if (!this.autotest) {
        this.progressTimer += dt;
      }

      const assistActive = !this.autotest && this.progressTimer > 20.0;
      turnRate = steer.turn * 1.15;
      if (assistActive) {
        const toTowerYaw = Math.atan2(-(towerCenter.x - this.balloonPos.x), -(towerCenter.z - this.balloonPos.z));
        turnRate += clamp(angleDiff(this.balloonYaw, toTowerYaw), -1, 1) * 0.85;
        const desiredCruiseAlt = distToTower < 45 ? towerCenter.y + 2.5 : Math.max(groundHere + 22, 48);
        this.balloonTargetAlt = damp(this.balloonTargetAlt, desiredCruiseAlt, 0.9, dt);
      } else if (this.thermalLiftTimer > 0) {
        this.balloonTargetAlt = clamp(this.balloonTargetAlt + 15.0 * dt, groundHere - 0.15, 74);
      } else {
        this.balloonTargetAlt = clamp(this.balloonTargetAlt + steer.climb * 15.0 * dt, groundHere - 0.15, 78);
      }

      this.balloonYaw = wrapAngle(this.balloonYaw + turnRate * dt);

      const altRatio = clamp((this.balloonPos.y - 12) / 52, 0, 1);
      const cruiseSpeed = (8.6 + altRatio * 5.6) * (this.autotest ? 1.25 : 1.0);
      // Gentle morning valley breeze increasing smoothly above ground (consistent with thermal air flow)
      const windMask = smoothstep(groundHere + 2.5, groundHere + 14.0, this.balloonPos.y);
      const windX = 0.22 * windMask;
      const windZ = -0.48 * windMask;
      const vx = -Math.sin(this.balloonYaw) * cruiseSpeed + windX;
      const vz = -Math.cos(this.balloonYaw) * cruiseSpeed + windZ;

      this.balloonPos.x = clamp(this.balloonPos.x + vx * dt, -200, 200);
      this.balloonPos.z = clamp(this.balloonPos.z + vz * dt, -385, 65);

      const newGround = Math.max(WATER_Y + 0.14, terrainHeight(this.balloonPos.x, this.balloonPos.z));
      const prevY = this.balloonPos.y;
      const desiredY = Math.max(newGround, this.balloonTargetAlt);
      const liftAcc = (desiredY - this.balloonPos.y) * 5.2 - this.balloonVel.y * 2.8;
      this.balloonVel.y = clamp(this.balloonVel.y + liftAcc * dt, -10, 14);
      this.balloonPos.y += this.balloonVel.y * dt;

      // Full-envelope & basket solid collision + terrain heightfield + water buoyancy
      const lifted = this.colliders.resolveBalloon(this.balloonPos, this.balloonVel, {
        inFlight: true,
        terrainHeight,
        isOverRiver,
        isOnDeck: isOnBridgeOrPier,
        waterY: WATER_Y,
      });
      if (lifted > 0.02) {
        this.balloonTargetAlt = Math.max(this.balloonTargetAlt, this.balloonPos.y + 0.65);
      }

      climbRate = (this.balloonPos.y - prevY) / dt;
      airSpeed = Math.hypot(vx - windX, vz - windZ);

      // Thermal updraft rings surge the balloon cleanly ABOVE the y=28..35 cloud stratum!
      const balloonCenter = new THREE.Vector3(this.balloonPos.x, this.balloonPos.y + 3.6, this.balloonPos.z);
      const hitRing = this.thermals.checkTrigger(balloonCenter);
      if (hitRing) {
        this.balloonTargetAlt = Math.min(76, Math.max(this.balloonTargetAlt + 32, 66));
        this.thermalLiftTimer = 2.8;
        this.burnerBoost = 1.25;
        this.sound.playThermal();
        this._setMoment('soar');
      }

      if (Math.abs(turnRate) > 0.42 && Math.abs(climbRate) < 2.2 && this.riseTimer > 2.2) {
        this.circlingAccum += dt;
        if (this.circlingAccum > 1.1) {
          this._setMoment('circle');
        }
      } else {
        this.circlingAccum = Math.max(0, this.circlingAccum - dt * 1.5);
        if (this.balloonPos.y > 42 || (this.riseTimer > 3.8 && this.balloonPos.y > 35 && window.__moment === 'rise')) {
          if (window.__moment !== 'circle' || this.circlingAccum < 0.2) {
            this._setMoment('soar');
          }
        }
      }

      this.girlPos.set(this.balloonPos.x, this.balloonPos.y + 0.22, this.balloonPos.z);
      this.girlYaw = this.balloonYaw + Math.PI;
      this.girl.setPose({ mode: 'aboard', time: this.time, holdingLetter: false });
      this.girl.group.position.copy(this.girlPos);
      this.girl.group.rotation.y = this.girlYaw;

      burnerLevel = clamp((steer.climb > 0.15 ? 0.85 : 0.16) + this.burnerBoost * 0.78, 0, 1);
      this.balloon.update(this.time, {
        burnerLevel,
        showBeacon: false,
        tiltX: -0.04,
        tiltZ: turnRate * 0.06,
      });
      this.dandelion.update(this.time, false);

      // Arrival check at Clock Tower Square
      const distPlaza = Math.hypot(this.balloonPos.x - towerCenter.x, this.balloonPos.z - towerCenter.z);
      if (distPlaza < 15.0 && (this.balloonPos.y - towerCenter.y < 8.5 || assistActive)) {
        this.state = 'tower';
        this.towerPhase = 0;
        this.balloonGrounded = true;
        this.sound.playTowerBell();
        this.bellSwing = 1.6;
        this._setMoment('tower');
      } else {
        const landGround = terrainHeight(this.balloonPos.x, this.balloonPos.z);
        if (
          this.riseTimer > 2.4 &&
          !isOverRiver(this.balloonPos.x, this.balloonPos.z) &&
          landGround > WATER_Y + 0.6 &&
          this.balloonPos.y - landGround < 1.1 &&
          this.balloonTargetAlt - landGround < 1.5 &&
          (!this.autotest || (this.autoStep === 4 && Math.hypot(this.balloonPos.x - LANDMARKS.meadowLanding.x, this.balloonPos.z - LANDMARKS.meadowLanding.z) < 9.5))
        ) {
          this.balloonPos.y = landGround;
          this.balloonVel.set(0, 0, 0);
          this.balloonGrounded = true;
          this.state = 'walk';
          let bestPos = new THREE.Vector3(this.balloonPos.x + 2.0, landGround, this.balloonPos.z + 1.85);
          let bestScore = -1e9;
          for (const [ox, oz] of [[2.0, 1.85], [-2.0, 1.85], [0, 2.3], [2.1, 0.2], [-2.1, 0.2]]) {
            const cand = new THREE.Vector3(this.balloonPos.x + ox, terrainHeight(this.balloonPos.x + ox, this.balloonPos.z + oz), this.balloonPos.z + oz);
            this.colliders.resolveWalker(cand, {
              radius: 0.36,
              height: 1.32,
              terrainHeight,
              isOverRiver,
              riverCenterZ,
              riverHalfWidth,
              isOnDeck: isOnBridgeOrPier,
              waterY: WATER_Y,
            });
            const dBal = Math.hypot(cand.x - this.balloonPos.x, cand.z - this.balloonPos.z);
            if (!isOverRiver(cand.x, cand.z) && dBal > 1.35 && cand.y > bestScore) {
              bestScore = cand.y;
              bestPos = cand;
            }
          }
          this.girlPos.copy(bestPos);
          this.girlYaw = 0.25;
          this._setMoment('land');
        }
      }
    } else if (this.state === 'float') {
      const steer = this.autotest ? this.autoSteer : this.steerInput;
      this.floatVel.x = damp(this.floatVel.x, steer.turn * -3.5 + 0.18, 2.5, dt);
      this.floatVel.z = damp(this.floatVel.z, -2.2 + steer.climb * -2.0 - 0.35, 2.5, dt);
      this.floatVel.y = -2.2;

      this.girlPos.x = clamp(this.girlPos.x + this.floatVel.x * dt, -195, 195);
      this.girlPos.z = clamp(this.girlPos.z + this.floatVel.z * dt, -365, 55);
      this.girlPos.y += this.floatVel.y * dt;
      this.girlYaw = wrapAngle(this.girlYaw + steer.turn * 1.4 * dt);

      this.colliders.resolveFloatGirl(this.girlPos, this.floatVel, {
        radius: 0.48,
        height: 2.0,
        terrainHeight,
        isOverRiver,
        riverCenterZ,
        riverHalfWidth,
        isOnDeck: isOnBridgeOrPier,
        waterY: WATER_Y,
        dt,
      });

      const groundY = Math.max(WATER_Y + 0.08, terrainHeight(this.girlPos.x, this.girlPos.z));
      if (this.girlPos.y <= groundY + 0.06) {
        this.girlPos.y = groundY;
        this.state = 'walk';
        this.colliders.resolveWalker(this.girlPos, {
          radius: 0.36,
          height: 1.32,
          terrainHeight,
          isOverRiver,
          riverCenterZ,
          riverHalfWidth,
          isOnDeck: isOnBridgeOrPier,
          waterY: WATER_Y,
        });
        this.dandelion.update(this.time, false);
        this._callBalloonToGirl();
      } else {
        const cosY = Math.cos(this.girlYaw);
        const sinY = Math.sin(this.girlYaw);
        this.dandelion.group.position.set(
          this.girlPos.x + 0.18 * cosY + 0.06 * sinY,
          this.girlPos.y + 1.32,
          this.girlPos.z - 0.18 * sinY + 0.06 * cosY
        );
        this.dandelion.update(this.time, true);
      }

      if (!this.balloonGrounded) {
        const targetBY = Math.max(WATER_Y + 0.14, terrainHeight(this.balloonPos.x, this.balloonPos.z));
        this.balloonPos.y = damp(this.balloonPos.y, targetBY, 0.36, dt);
        this.colliders.resolveBalloon(this.balloonPos, this.balloonVel, {
          inFlight: true,
          terrainHeight,
          isOverRiver,
          isOnDeck: isOnBridgeOrPier,
          waterY: WATER_Y,
        });
        const settledBY = Math.max(WATER_Y + 0.14, terrainHeight(this.balloonPos.x, this.balloonPos.z));
        if (Math.abs(this.balloonPos.y - settledBY) < 0.2) {
          this.balloonPos.y = settledBY;
          this.balloonGrounded = true;
        }
      } else {
        this.colliders.resolveBalloon(this.balloonPos, this.balloonVel, {
          inFlight: false,
          terrainHeight,
          isOverRiver,
          isOnDeck: isOnBridgeOrPier,
          waterY: WATER_Y,
        });
      }
      this.balloon.update(this.time, { burnerLevel: 0.05, showBeacon: this.balloonGrounded });

      this.girl.setPose({ mode: 'float', time: this.time, holdingLetter: false });
      this.girl.group.position.copy(this.girlPos);
      this.girl.group.rotation.y = this.girlYaw;
    } else if (this.state === 'tower') {
      const pad = this.village.landingCenter;
      this.balloonPos.lerp(pad, Math.min(1, dt * 2.8));
      this.balloonYaw = wrapAngle(this.balloonYaw + angleDiff(this.balloonYaw, 0.25) * Math.min(1, dt * 3));
      this.balloon.update(this.time, { burnerLevel: 0, showBeacon: false });
      this.dandelion.update(this.time, false);

      this.towerPhase += dt;
      // Reunion right in the center-foreground of Clock Tower Square
      const recPos = this.recipient.group.position;
      const meetPos = new THREE.Vector3(recPos.x - 1.15, pad.y, recPos.z + 0.28);

      if (this.towerPhase < 0.9) {
        this.balloon.basketLetter.visible = false;
        this.letterInBasket = false;
        this.girlHoldingLetter = true;
        const stepOut = new THREE.Vector3(pad.x + 1.15, pad.y, pad.z + 0.15);
        this.girlPos.lerp(stepOut, Math.min(1, dt * 4.5));
        this.girl.setPose({ mode: 'walk', time: this.time, walkSpeed: 2.2, holdingLetter: true });
      } else if (this.towerPhase < 2.1) {
        this.girlPos.lerp(meetPos, Math.min(1, dt * 3.0));
        const dx = recPos.x - this.girlPos.x;
        const dz = recPos.z - this.girlPos.z;
        this.girlYaw = wrapAngle(this.girlYaw + angleDiff(this.girlYaw, Math.atan2(dx, dz)) * Math.min(1, dt * 7));
        const d = this.girlPos.distanceTo(meetPos);
        this.girl.setPose({ mode: d > 0.25 ? 'walk' : 'wave', time: this.time, walkSpeed: d > 0.25 ? 2.4 : 0, holdingLetter: true });
      } else {
        this.girlPos.copy(meetPos);
        if (!this.letterDelivered) {
          this.letterDelivered = true;
          this.girlHoldingLetter = false;
          const gift = makeFlowerLetter();
          this.recipient.receivedLetterSpot.add(gift);
          this.sound.playPickup();
        }
        this.girlYaw = wrapAngle(this.girlYaw + angleDiff(this.girlYaw, 0.72) * Math.min(1, dt * 5));
        this.girl.setPose({ mode: 'wave', time: this.time, holdingLetter: false });
      }
      this.girl.group.position.copy(this.girlPos);
      this.girl.group.rotation.y = this.girlYaw;
    }

    this.balloon.group.position.copy(this.balloonPos);
    this.balloon.group.rotation.y = this.balloonYaw;
    this.thermals.update(dt, this.time, this.balloonPos, this.balloonYaw, airSpeed, climbRate, turnRate, this.state === 'fly');
    this.sound.update(dt, airSpeed, this.balloonPos.y, burnerLevel > 0.4, walking);
  }

  _updateAutotest(dt) {
    this.autoTimer += dt;
    if (this.autoTimer < this.autoHoldUntil) {
      this.autoSteer.turn = 0;
      this.autoSteer.climb = 0;
      return;
    }

    // Step 0: Hold initial garden -> pick flower letter & board
    if (this.autoStep === 0) {
      this.autoStep = 1;
      this._walkToPickLetter(true);
      this._logAuto('action', 'pick_letter_and_board');
    } else if (this.autoStep === 1) {
      if (this.state === 'fly' && this.riseTimer > 0.7) {
        this.autoStep = 2;
        this._logAuto('action', 'steer_through_thermal_and_climb_above_clouds');
      }
    } else if (this.autoStep === 2) {
      // Steer through Ring 1 (y=21, z=-70), then climb cleanly above y=60 above the cloud layer
      const ring1 = this.thermals.rings[0];
      if (ring1.cooldown > 0) {
        this.autoSteer.turn = 0;
        this.autoSteer.climb = 1.0;
      } else {
        const r1 = ring1.pos;
        const targetYaw = Math.atan2(-(r1.x - this.balloonPos.x), -(r1.z - this.balloonPos.z));
        this.autoSteer.turn = clamp(angleDiff(this.balloonYaw, targetYaw) * 1.8, -1, 1);
        this.autoSteer.climb = clamp((r1.y - 2.5 - this.balloonPos.y) * 0.14, -0.5, 1);
      }

      if (window.__moment === 'soar' && this.balloonPos.y > 54) {
        this.autoStep = 3;
        this.autoHoldUntil = this.autoTimer + 2.0;
        this._logAuto('hold', 'soar_above_clouds');
      }
    } else if (this.autoStep === 3) {
      // Steady-altitude circle above clouds
      this.balloonTargetAlt = damp(this.balloonTargetAlt, this.balloonPos.y, 4.0, dt);
      this.autoSteer.turn = 0.88;
      this.autoSteer.climb = 0.0;
      if (window.__moment === 'circle' && this.circlingAccum > 1.8) {
        this.autoStep = 4;
        this._logAuto('action', 'descend_to_meadow_land');
      }
    } else if (this.autoStep === 4) {
      // Descend and land on enriched riverside meadow (-22, y, -182)
      const target = new THREE.Vector3(
        LANDMARKS.meadowLanding.x,
        terrainHeight(LANDMARKS.meadowLanding.x, LANDMARKS.meadowLanding.z),
        LANDMARKS.meadowLanding.z
      );
      const targetYaw = Math.atan2(-(target.x - this.balloonPos.x), -(target.z - this.balloonPos.z));
      this.autoSteer.turn = clamp(angleDiff(this.balloonYaw, targetYaw) * 1.6, -1, 1);
      const dist = Math.hypot(target.x - this.balloonPos.x, target.z - this.balloonPos.z);
      if (dist > 30) {
        const desiredY = target.y + 12;
        this.autoSteer.climb = clamp((desiredY - this.balloonPos.y) * 0.16, -0.95, 0.35);
      } else {
        this.autoSteer.climb = -1.0;
        this.balloonTargetAlt = Math.max(target.y, this.balloonTargetAlt - 22.0 * dt);
      }

      if (this.state === 'walk' && window.__moment === 'land') {
        this.autoStep = 5;
        this.autoHoldUntil = this.autoTimer + 2.0;
        this._logAuto('hold', 'land_meadow');
      }
    } else if (this.autoStep === 5) {
      this.autoStep = 6;
      this._walkToBoardBalloon();
      this._logAuto('action', 'reboard_from_meadow');
    } else if (this.autoStep === 6) {
      this.autoSteer.turn = 0;
      this.autoSteer.climb = 0.0;
      if (this.state === 'fly') {
        this.balloonTargetAlt = Math.min(this.balloonTargetAlt, 19.5);
      }
      if (this.state === 'fly' && this.balloonPos.y > 16.5 && this.riseTimer > 0.7) {
        this.autoStep = 7;
        this._startFloatDismount();
        this.autoHoldUntil = this.autoTimer + 2.0;
        this._logAuto('hold', 'dandelion_float');
      }
    } else if (this.autoStep === 7) {
      this.autoSteer.turn = 0.12;
      this.autoSteer.climb = 0.0;
      if (this.state === 'walk') {
        this.autoStep = 8;
        this._callBalloonToGirl();
        this._walkToBoardBalloon();
        this._logAuto('action', 'reboard_after_float');
      }
    } else if (this.autoStep === 8) {
      if (this.state === 'fly') {
        const pad = this.village.landingCenter;
        const dist = Math.hypot(pad.x - this.balloonPos.x, pad.z - this.balloonPos.z);
        const targetYaw = Math.atan2(-(pad.x - this.balloonPos.x), -(pad.z - this.balloonPos.z));
        this.autoSteer.turn = clamp(angleDiff(this.balloonYaw, targetYaw) * 1.8, -1, 1);
        const desiredY = dist < 56 ? pad.y + 1.2 : pad.y + 10;
        this.autoSteer.climb = clamp((desiredY - this.balloonPos.y) * 0.18, -0.95, 0.9);
      }
      if (this.state === 'tower') {
        this.autoStep = 9;
        this.autoHoldUntil = this.autoTimer + 3.4;
        this._logAuto('hold', 'tower_arrival');
      }
    } else if (this.autoStep === 9) {
      if (!window.__autodone) {
        this._logAuto('done', 'complete');
        window.__autodone = true;
      }
    }
  }

  _computeDesiredShot() {
    const aspect = this.camera.aspect;

    if (this.state === 'garden') {
      const gp = this.girlPos;
      const bp = this.balloonPos;
      const lp = this.tableLetter.position;
      const points = [
        new THREE.Vector3(gp.x - 0.7, gp.y, gp.z + 0.6),
        new THREE.Vector3(gp.x, gp.y + 1.45, gp.z),
        new THREE.Vector3(lp.x - 0.5, lp.y + 0.3, lp.z),
        new THREE.Vector3(bp.x - 2.4, bp.y, bp.z),
        new THREE.Vector3(bp.x + 2.4, bp.y + 7.9, bp.z),
      ];
      return fitPointsShot({
        points,
        dir: new THREE.Vector3(0.14, 0.14, 0.98).normalize(),
        fov: 45,
        aspect,
        margin: 0.11,
        target: new THREE.Vector3(0.5, gp.y + 2.35, -4.5),
      });
    }

    if (this.state === 'float') {
      const gp = this.girlPos;
      const bp = this.balloonPos;
      const gx = gp.x - bp.x;
      const gz = gp.z - bp.z;
      const glen = Math.hypot(gx, gz) || 1;
      const nx = gx / glen;
      const nz = gz / glen;
      // Frame girl & dandelion cleanly against open sky/hills with balloon gently off to the side
      const camDir = new THREE.Vector3(-nz * 0.82 + nx * 0.48, 0.08, nx * 0.82 + nz * 0.48).normalize();
      const points = [
        new THREE.Vector3(gp.x, gp.y - 0.15, gp.z),
        new THREE.Vector3(gp.x, gp.y + 3.05, gp.z),
        new THREE.Vector3(gp.x - 1.25, gp.y + 1.55, gp.z),
        new THREE.Vector3(gp.x + 1.25, gp.y + 1.55, gp.z),
      ];
      const shot = fitPointsShot({
        points,
        dir: camDir,
        fov: 43,
        aspect,
        margin: 0.20,
        minDist: 5.5,
        target: new THREE.Vector3(gp.x, gp.y + 1.35, gp.z),
      });
      shot.anchor = gp;
      shot.anchorId = 'float-girl';
      return shot;
    }

    if (this.state === 'walk') {
      const gp = this.girlPos;
      const bp = this.balloonPos;
      const dist = gp.distanceTo(bp);
      if (dist < 14) {
        const points = [
          new THREE.Vector3(gp.x, gp.y, gp.z),
          new THREE.Vector3(gp.x, gp.y + 1.45, gp.z),
          new THREE.Vector3(bp.x - 2.4, bp.y, bp.z),
          new THREE.Vector3(bp.x + 2.4, bp.y + 7.9, bp.z),
        ];
        const mid = gp.clone().lerp(bp, 0.5);
        mid.y = Math.max(gp.y, bp.y) + 3.2;
        return fitPointsShot({
          points,
          dir: new THREE.Vector3(-0.22, 0.14, 0.96).normalize(),
          fov: 46,
          aspect,
          margin: 0.12,
          target: mid,
        });
      }
      return fitPointsShot({
        points: [new THREE.Vector3(gp.x, gp.y, gp.z), new THREE.Vector3(gp.x, gp.y + 1.6, gp.z)],
        dir: new THREE.Vector3(0.28, 0.26, 0.92).normalize(),
        fov: 44,
        aspect,
        margin: 0.24,
        minDist: 6.8,
        target: new THREE.Vector3(gp.x, gp.y + 0.9, gp.z),
      });
    }

    if (this.state === 'tower') {
      // Close reunion framing: Girl + Recipient LARGE in center foreground, full Balloon beside them,
      // and Clock Tower + villagers cleanly unclipped in the background!
      const bp = this.balloonPos;
      const gp = this.girlPos;
      const rp = this.recipient.group.position;
      const tx = LANDMARKS.towerPlaza.x + 1.1;
      const tz = LANDMARKS.towerPlaza.z - 7.6;
      const ty = terrainHeight(LANDMARKS.towerPlaza.x, LANDMARKS.towerPlaza.z);

      const points = [
        new THREE.Vector3(bp.x - 2.35, bp.y, bp.z + 0.8),
        new THREE.Vector3(bp.x, bp.y + 7.85, bp.z),
        new THREE.Vector3(gp.x - 0.5, gp.y, gp.z + 0.5),
        new THREE.Vector3(rp.x + 0.7, rp.y + 1.6, rp.z + 0.5),
        new THREE.Vector3(tx, ty + 13.0, tz),
      ];
      const tgt = new THREE.Vector3(
        (gp.x + rp.x) * 0.44 + bp.x * 0.12,
        gp.y + 2.35,
        (gp.z + rp.z) * 0.50
      );
      return fitPointsShot({
        points,
        dir: new THREE.Vector3(0.10, 0.05, 0.994).normalize(),
        fov: 54,
        aspect,
        margin: 0.06,
        target: tgt,
        minDist: 7.4,
      });
    }

    // Default: board / fly (rise, soar, circle) -> always fit FULL balloon + basket + girl unclipped
    const bp = this.balloonPos;
    const fx = -Math.sin(this.balloonYaw);
    const fz = -Math.cos(this.balloonYaw);
    const rx = Math.cos(this.balloonYaw);
    const rz = -Math.sin(this.balloonYaw);

    const highClimb = clamp((bp.y - 34) / 26, 0, 1);
    const dir = new THREE.Vector3(
      -fx * 0.93 + rx * 0.25,
      0.16 + highClimb * 0.16,
      -fz * 0.93 + rz * 0.25
    ).normalize();

    const points = [
      new THREE.Vector3(bp.x, bp.y - 0.2, bp.z),
      new THREE.Vector3(bp.x, bp.y + 7.9, bp.z),
      new THREE.Vector3(bp.x - 2.45, bp.y + 5.1, bp.z),
      new THREE.Vector3(bp.x + 2.45, bp.y + 5.1, bp.z),
      new THREE.Vector3(bp.x, bp.y + 5.1, bp.z - 2.45),
      new THREE.Vector3(bp.x, bp.y + 5.1, bp.z + 2.45),
    ];

    const shot = fitPointsShot({
      points,
      dir,
      fov: 46 + highClimb * 4,
      aspect,
      margin: 0.12,
      target: new THREE.Vector3(bp.x, bp.y + 3.65, bp.z),
      minDist: 11.4,
    });
    shot.anchor = bp;
    shot.anchorId = 'fly-balloon';
    return shot;
  }

  _updateCamera(dt) {
    const shot = this._computeDesiredShot();
    const stiff = this.state === 'tower' ? 3.2 : this.state === 'float' ? 5.6 : 3.4;
    this.camRig.update(dt, shot, stiff);
  }
}
