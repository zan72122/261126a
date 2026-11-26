import * as THREE from '../../lib/three.module.js';

/**
 * Single-finger touch & mouse input controller.
 * Distinguishes crisp taps from continuous drags without browser scroll interference.
 */
export class Input {
  constructor(dom) {
    this.dom = dom;
    this.down = false;
    this.pointerId = null;
    this.startX = 0;
    this.startY = 0;
    this.x = 0;
    this.y = 0;
    this.dx = 0;
    this.dy = 0;
    this.totalMove = 0;
    this.downTime = 0;
    this.onTap = null;

    this.ndc = new THREE.Vector2();
    this.ray = new THREE.Raycaster();

    dom.addEventListener('pointerdown', (e) => this._onDown(e), { passive: false });
    window.addEventListener('pointermove', (e) => this._onMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this._onUp(e), { passive: false });
    window.addEventListener('pointercancel', (e) => this._onUp(e), { passive: false });
  }

  _onDown(e) {
    if (this.down && this.pointerId !== e.pointerId) return;
    if (e.target !== this.dom) return;
    this.down = true;
    this.pointerId = e.pointerId;
    this.startX = this.x = e.clientX;
    this.startY = this.y = e.clientY;
    this.dx = 0;
    this.dy = 0;
    this.totalMove = 0;
    this.downTime = performance.now();
  }

  _onMove(e) {
    if (!this.down || e.pointerId !== this.pointerId) return;
    const mx = e.clientX - this.x;
    const my = e.clientY - this.y;
    this.dx = e.clientX - this.startX;
    this.dy = e.clientY - this.startY;
    this.totalMove += Math.hypot(mx, my);
    this.x = e.clientX;
    this.y = e.clientY;
  }

  _onUp(e) {
    if (!this.down || e.pointerId !== this.pointerId) return;
    const elapsed = performance.now() - this.downTime;
    const wasTap = this.totalMove < 16 && elapsed < 520;
    const cx = e.clientX;
    const cy = e.clientY;
    this.down = false;
    this.pointerId = null;
    this.dx = 0;
    this.dy = 0;
    if (wasTap && this.onTap) {
      const rect = this.dom.getBoundingClientRect();
      this.ndc.set(
        ((cx - rect.left) / rect.width) * 2 - 1,
        -((cy - rect.top) / rect.height) * 2 + 1
      );
      this.onTap(this.ndc, cx, cy);
    }
  }

  dragNormalized() {
    if (!this.down) return { x: 0, y: 0, active: false };
    const span = Math.min(window.innerWidth, window.innerHeight) * 0.24;
    return {
      x: Math.max(-1, Math.min(1, this.dx / Math.max(40, span))),
      y: Math.max(-1, Math.min(1, this.dy / Math.max(40, span))),
      active: true,
    };
  }
}
