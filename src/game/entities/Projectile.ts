import Phaser from 'phaser';

/**
 * Generic pooled projectile.
 * Supports per-fire overrides for damage, speed, range, color tint, size, and texture.
 */
export class Projectile extends Phaser.Physics.Arcade.Image {
  private startX = 0;
  private startY = 0;
  private maxRange = 500;
  private damageValue = 10;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'projectile');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  /* ---------- lifecycle ---------- */

  fire(
    x: number,
    y: number,
    angle: number,
    speed: number,
    range: number,
    damage: number,
    color: number,
    size: number,
    textureKey?: string,
  ): void {
    this.startX = x;
    this.startY = y;
    this.maxRange = range;
    this.damageValue = damage;

    const hasCustomTexture =
      textureKey !== undefined &&
      textureKey !== 'projectile' &&
      this.scene.textures.exists(textureKey);
    const visualSize = hasCustomTexture ? Math.max(18, size * 2.6) : size;

    this.setTexture(hasCustomTexture ? textureKey : 'projectile');
    if (hasCustomTexture) {
      this.clearTint();
    } else {
      this.setTint(color);
    }
    this.setDisplaySize(visualSize, visualSize);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
    // resize physics body to match display size
    const halfSize = Math.max(6, size / 2);
    body.setCircle(halfSize, -halfSize + visualSize / 2, -halfSize + visualSize / 2);
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
    this.setTexture('projectile');
  }

  /** Called by group with `runChildUpdate: true`. */
  update(): void {
    if (!this.active) return;
    const dist = Phaser.Math.Distance.Between(this.startX, this.startY, this.x, this.y);
    if (dist > this.maxRange) this.reclaim();
  }

  getDamage(): number { return this.damageValue; }
}
