import { clamp } from './math.js';

// Single-finger pointer tap & drag controller.
export class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.active = false;
    this.pointerId = null;
    this.startX = 0;
    this.startY = 0;
    this.curX = 0;
    this.curY = 0;
    this.dragX = 0;
    this.dragY = 0;
    this.moved = false;
    this.onTap = null;
    this.holdTime = 0;

    canvas.addEventListener('pointerdown', (e) => this._down(e), { passive: false });
    window.addEventListener('pointermove', (e) => this._move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this._up(e), { passive: false });
    window.addEventListener('pointercancel', (e) => this._up(e), { passive: false });
  }

  _down(e) {
    if (e.button && e.button !== 0) return;
    if (this.active) return;
    this.active = true;
    this.pointerId = e.pointerId;
    this.startX = this.curX = e.clientX;
    this.startY = this.curY = e.clientY;
    this.dragX = 0;
    this.dragY = 0;
    this.moved = false;
    this.holdTime = 0;
  }

  _move(e) {
    if (!this.active || e.pointerId !== this.pointerId) return;
    this.curX = e.clientX;
    this.curY = e.clientY;
    const dx = this.curX - this.startX;
    const dy = this.curY - this.startY;
    if (Math.hypot(dx, dy) > 10) this.moved = true;
    const scale = Math.max(90, Math.min(window.innerWidth, window.innerHeight) * 0.24);
    this.dragX = clamp(dx / scale, -1, 1);
    this.dragY = clamp(dy / scale, -1, 1);
  }

  _up(e) {
    if (!this.active || e.pointerId !== this.pointerId) return;
    const wasTap = !this.moved && this.holdTime < 0.45;
    const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    const ny = -(e.clientY / Math.max(1, window.innerHeight)) * 2 + 1;
    this.active = false;
    this.pointerId = null;
    this.dragX = 0;
    this.dragY = 0;
    if (wasTap && this.onTap) {
      this.onTap({ nx, ny, clientX: e.clientX, clientY: e.clientY });
    }
  }

  update(dt) {
    if (this.active) this.holdTime += dt;
  }
}
