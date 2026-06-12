import Phaser from 'phaser';
import { CONFIG } from '../config';

export class Player extends Phaser.Physics.Arcade.Image {
  private hp: number;
  private bonusMaxHp = 0;
  private speedMultiplier = 1.0;
  private damageReductionPct = 0;
  private lastAttackTime = 0;
  private invincible = false;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.hp = CONFIG.PLAYER.MAX_HEALTH;
    this.setCollideWorldBounds(true);

    this.initInput(scene);
  }

  /* ---------- public API ---------- */

  update(): void {
    this.handleMovement();
  }

  canAttack(time: number): boolean {
    if (time - this.lastAttackTime < CONFIG.PLAYER.ATTACK_INTERVAL_MS) return false;
    this.lastAttackTime = time;
    return true;
  }

  takeDamage(amount: number): boolean {
    if (this.invincible) return false;
    const reduced = amount * (1 - this.damageReductionPct / 100);
    this.hp = Math.max(0, this.hp - reduced);
    this.flashInvincible();
    return this.hp <= 0;
  }

  getHp(): number { return this.hp; }
  getMaxHp(): number { return CONFIG.PLAYER.MAX_HEALTH + this.bonusMaxHp; }

  addBonusMaxHp(amount: number): void {
    this.bonusMaxHp += amount;
    this.hp += amount;
  }

  setSpeedMultiplier(m: number): void {
    this.speedMultiplier = m;
  }

  setDamageReduction(pct: number): void {
    this.damageReductionPct = pct;
  }

  /* ---------- movement ---------- */

  private handleMovement(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.keyA.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.keyD.isDown) vx += 1;
    if (this.cursors.up.isDown || this.keyW.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.keyS.isDown) vy += 1;

    // normalise diagonal so speed stays constant
    if (vx !== 0 && vy !== 0) {
      const inv = 1 / Math.SQRT2;
      vx *= inv;
      vy *= inv;
    }

    body.setVelocity(vx * CONFIG.PLAYER.SPEED * this.speedMultiplier, vy * CONFIG.PLAYER.SPEED * this.speedMultiplier);
  }

  /* ---------- input ---------- */

  private initInput(scene: Phaser.Scene): void {
    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  }

  /* ---------- invincibility ---------- */

  private flashInvincible(): void {
    this.invincible = true;
    this.scene.tweens.add({
      targets: this,
      alpha: 0.2,
      duration: 80,
      yoyo: true,
      repeat: 3,
      onComplete: () => { this.setAlpha(1); },
    });
    this.scene.time.delayedCall(CONFIG.PLAYER.INVINCIBLE_MS, () => {
      this.invincible = false;
    });
  }
}
