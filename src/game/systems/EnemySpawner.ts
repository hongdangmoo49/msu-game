import { CONFIG } from '../config';
import { Enemy } from '../entities/Enemy';

/**
 * Timer-driven spawner that increases difficulty every wave.
 * Enemies spawn outside the visible area and track the player.
 */
export class EnemySpawner {
  private scene: Phaser.Scene;
  private enemyGroup: Phaser.Physics.Arcade.Group;
  private wave = 1;
  private spawned = 0;

  constructor(scene: Phaser.Scene, enemyGroup: Phaser.Physics.Arcade.Group) {
    this.scene = scene;
    this.enemyGroup = enemyGroup;

    scene.time.addEvent({
      delay: CONFIG.ENEMY.SPAWN_INTERVAL_MS,
      callback: this.spawnOne,
      callbackScope: this,
      loop: true,
    });
  }

  private spawnOne(): void {
    const enemy = this.enemyGroup.get() as Enemy | null;
    if (!enemy) return; // pool exhausted — skip this tick

    const { WIDTH, HEIGHT } = CONFIG.WORLD;
    const margin = 60;

    // pick a random screen edge
    const side = Phaser.Math.Between(0, 3);
    let x: number;
    let y: number;

    switch (side) {
      case 0: x = Phaser.Math.Between(-margin, WIDTH + margin); y = -margin; break;
      case 1: x = WIDTH + margin; y = Phaser.Math.Between(-margin, HEIGHT + margin); break;
      case 2: x = Phaser.Math.Between(-margin, WIDTH + margin); y = HEIGHT + margin; break;
      default: x = -margin; y = Phaser.Math.Between(-margin, HEIGHT + margin); break;
    }

    const speed = CONFIG.ENEMY.BASE_SPEED + this.wave * CONFIG.ENEMY.SPEED_PER_WAVE;
    const health = CONFIG.ENEMY.BASE_HEALTH + this.wave * CONFIG.ENEMY.HEALTH_PER_WAVE;

    enemy.spawn(x, y, speed, health, CONFIG.ENEMY.XP_VALUE);

    this.spawned++;
    if (this.spawned % 10 === 0) this.wave++;
  }
}
