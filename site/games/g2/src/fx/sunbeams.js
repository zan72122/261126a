// Oblique morning sunbeams (朝の斜めの日差しと空気中の光の筋) + floating morning pollen motes
import * as THREE from '../../lib/three.module.js';
import { PALETTE } from '../core/palette.js';
import { mulberry32 } from '../core/math.js';
import { makeSunbeamTexture, makeSoftDotTexture } from '../core/textures.js';
import { SUN_DIR } from '../world/sky.js';

export class MorningSunbeams {
  constructor(lowQuality = false) {
    this.group = new THREE.Group();
    this.group.name = 'morningSunbeams';

    const beamTex = makeSunbeamTexture();
    const dotTex = makeSoftDotTexture();
    const rng = mulberry32(4207);

    // Orient light shafts along eastern morning SUN_DIR
    const up = new THREE.Vector3(0, 1, 0);
    const beamQuat = new THREE.Quaternion().setFromUnitVectors(up, SUN_DIR.clone().normalize());

    this.beams = [];
    const beamCount = lowQuality ? 6 : 12;
    const beamGeo = new THREE.PlaneGeometry(1, 1);

    for (let i = 0; i < beamCount; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: beamTex,
        color: 0xfff0d2,
        transparent: true,
        opacity: lowQuality ? 0.08 : 0.11,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const shaft = new THREE.Group();
      const p1 = new THREE.Mesh(beamGeo, mat);
      const p2 = new THREE.Mesh(beamGeo, mat);
      p2.rotation.y = Math.PI / 2;
      shaft.add(p1, p2);

      const width = 9 + rng() * 11;
      const len = 58 + rng() * 34;
      shaft.scale.set(width, len, width);
      shaft.quaternion.copy(beamQuat);

      const bx = (rng() - 0.5) * 170;
      const bz = -30 - rng() * 290;
      const by = 24 + rng() * 24;
      shaft.position.set(bx, by, bz);

      this.group.add(shaft);
      this.beams.push({
        shaft,
        mat,
        baseOpacity: lowQuality ? 0.075 : 0.105,
        phase: rng() * Math.PI * 2,
      });
    }

    // Floating sunlit morning dust & pollen motes drifting around the active camera/player
    this.motes = [];
    const moteCount = lowQuality ? 16 : 36;
    for (let i = 0; i < moteCount; i++) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: dotTex,
          color: i % 3 === 0 ? PALETTE.apricotSoft : PALETTE.cream,
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
        })
      );
      sp.scale.setScalar(0.14 + (i % 4) * 0.05);
      this.group.add(sp);
      this.motes.push({
        sp,
        ox: (rng() - 0.5) * 28,
        oy: (rng() - 0.3) * 14,
        oz: (rng() - 0.5) * 28,
        phase: rng() * Math.PI * 2,
      });
    }
  }

  update(dt, time, focusPos) {
    for (const b of this.beams) {
      b.mat.opacity = b.baseOpacity * (0.82 + 0.18 * Math.sin(time * 0.55 + b.phase));
    }

    if (focusPos) {
      for (const m of this.motes) {
        m.ox += dt * 0.35;
        m.oy += Math.sin(time * 0.9 + m.phase) * dt * 0.25;
        if (m.ox > 14) m.ox -= 28;
        m.sp.position.set(focusPos.x + m.ox, focusPos.y + m.oy, focusPos.z + m.oz);
      }
    }
  }
}
