import Phaser from 'phaser';
import { CONFIG } from '../config';

export class XpOrb extends Phaser.Physics.Arcade.Image {
  private value = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'xp_orb');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  /* ---------- lifecycle ---------- */

  spawn(x: number, y: number, value: number): void {
    this.value = value;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
    this.setActive(true).setVisible(true);
  }

  collect(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
    this.setActive(false).setVisible(false);
  }

  /* ---------- per-frame ---------- */

  magnetizeTo(target: { x: number; y: number }, rangeOverride?: number): void {
    if (!this.active) return;
    const magnetRange = rangeOverride ?? CONFIG.XP_ORB.MAGNET_RANGE;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    if (dist > magnetRange) return;

    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(
      Math.cos(angle) * CONFIG.XP_ORB.COLLECT_SPEED,
      Math.sin(angle) * CONFIG.XP_ORB.COLLECT_SPEED,
    );
  }

  getValue(): number { return this.value; }
}
