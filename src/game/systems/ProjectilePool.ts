import { CONFIG } from '../config';
import { Projectile } from '../entities/Projectile';

/**
 * Thin wrapper around an Arcade Group that pre-configures pooling.
 * get() recycles killed members; new instances are created up to maxSize.
 */
export class ProjectilePool {
  readonly group: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene) {
    this.group = scene.physics.add.group({
      classType: Projectile,
      maxSize: CONFIG.PROJECTILE.POOL_SIZE,
      runChildUpdate: true,
    });
  }

  /**
   * Fire a fully-configured projectile.
   * All per-weapon variation (color, size, damage, speed, range) is set here.
   */
  fireColored(
    x: number, y: number, angle: number,
    speed: number, range: number, damage: number,
    color: number, size: number,
  ): Projectile | null {
    const proj = this.group.get(x, y) as Projectile | null;
    if (!proj) return null;
    proj.fire(x, y, angle, speed, range, damage, color, size);
    return proj;
  }
}
