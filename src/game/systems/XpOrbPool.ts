import { CONFIG } from '../config';
import { XpOrb } from '../entities/XpOrb';

export class XpOrbPool {
  readonly group: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene) {
    this.group = scene.physics.add.group({
      classType: XpOrb,
      maxSize: CONFIG.XP_ORB.POOL_SIZE,
    });
  }

  spawn(x: number, y: number, value: number): XpOrb | null {
    const orb = this.group.get(x, y) as XpOrb | null;
    if (!orb) return null;
    orb.spawn(x, y, value);
    return orb;
  }
}
