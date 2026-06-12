import Phaser from 'phaser';
import { CONFIG } from '../config';

export class Enemy extends Phaser.Physics.Arcade.Image {
  private hp = 0;
  private speed = 0;
  private xpValue = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  /* ---------- lifecycle ---------- */

  spawn(x: number, y: number, speed: number, health: number, xpValue: number): void {
    this.hp = health;
    this.speed = speed;
    this.xpValue = xpValue;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
    this.setActive(true).setVisible(true);
  }

  kill(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
    this.setActive(false).setVisible(false);
  }

  /* ---------- per-frame ---------- */

  trackTarget(target: { x: number; y: number }): void {
    if (!this.active) return;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
  }

  /* ---------- damage ---------- */

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    if (this.hp > 0) return false;
    this.kill();
    return true;
  }

  getXpValue(): number { return this.xpValue; }
}
