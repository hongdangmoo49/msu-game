import Phaser from 'phaser';

/**
 * Generic pooled projectile.
 * Supports per-fire overrides for damage, speed, range, color tint, and size.
 * Texture is generated once (white circle) and tinted at fire-time.
 */
export class Projectile extends Phaser.Physics.Arcade.Image {
  private startX = 0;
  private startY = 0;
  private maxRange = 500;
  private damageValue = 10;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // 'projectile' is the shared white-circle texture
    super(scene, x, y, 'projectile');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  /* ---------- lifecycle ---------- */

  fire(x: number, y: number, angle: number, speed: number, range: number, damage: number, color: number, size: number): void {
    this.startX = x;
    this.startY = y;
    this.maxRange = range;
    this.damageValue = damage;

    this.setTint(color);
    this.setDisplaySize(size, size);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
    // resize physics body to match display size
    const halfSize = size / 2;
    body.setCircle(halfSize, -halfSize + size / 2, -halfSize + size / 2);
    body.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
    );
    this.setActive(true).setVisible(true);
  }

  reclaim(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
    this.setActive(false).setVisible(false);
    this.clearTint();
  }

  /** Called by group with `runChildUpdate: true`. */
  update(): void {
    if (!this.active) return;
    const dist = Phaser.Math.Distance.Between(this.startX, this.startY, this.x, this.y);
    if (dist > this.maxRange) this.reclaim();
  }

  getDamage(): number { return this.damageValue; }
}
