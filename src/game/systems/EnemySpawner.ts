import { CONFIG } from '../config';
import { Enemy } from '../entities/Enemy';

export interface EnemySpawnAsset {
  readonly textureKey: string;
  readonly name: string;
  readonly role: 'basic' | 'elite' | 'boss';
  readonly displaySize: number;
  readonly healthMultiplier: number;
  readonly speedMultiplier: number;
  readonly xpMultiplier: number;
}

/**
 * Timer-driven spawner that increases difficulty every wave.
 * Enemies spawn outside the visible area and track the player.
 */
export class EnemySpawner {
  private scene: Phaser.Scene;
  private enemyGroup: Phaser.Physics.Arcade.Group;
  private spawnAssets: readonly EnemySpawnAsset[];
  private wave = 1;
  private spawned = 0;

  constructor(
    scene: Phaser.Scene,
    enemyGroup: Phaser.Physics.Arcade.Group,
    spawnAssets: readonly EnemySpawnAsset[] = [],
  ) {
    this.scene = scene;
    this.enemyGroup = enemyGroup;
    this.spawnAssets = spawnAssets;

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

    const asset = this.pickSpawnAsset();
    const speed = Math.round(
      (CONFIG.ENEMY.BASE_SPEED + this.wave * CONFIG.ENEMY.SPEED_PER_WAVE) * asset.speedMultiplier,
    );
    const health = Math.round(
      (CONFIG.ENEMY.BASE_HEALTH + this.wave * CONFIG.ENEMY.HEALTH_PER_WAVE) * asset.healthMultiplier,
    );
    const xpValue = Math.max(1, Math.round(CONFIG.ENEMY.XP_VALUE * asset.xpMultiplier));

    enemy.spawn(x, y, speed, health, xpValue, {
      textureKey: asset.textureKey,
      displaySize: asset.displaySize,
    });

    this.spawned++;
    if (this.spawned % 10 === 0) this.wave++;
  }

  private pickSpawnAsset(): EnemySpawnAsset {
    const fallback: EnemySpawnAsset = {
      textureKey: 'enemy',
      name: 'Fallback Enemy',
      role: 'basic',
      displaySize: CONFIG.ENEMY.SIZE,
      healthMultiplier: 1,
      speedMultiplier: 1,
      xpMultiplier: 1,
    };

    if (this.spawnAssets.length === 0) {
      return fallback;
    }

    const bossAssets = this.spawnAssets.filter((asset) => asset.role === 'boss');
    if ((this.spawned + 1) % 25 === 0 && bossAssets.length > 0) {
      const bossIndex = Math.floor((this.spawned + 1) / 25 - 1) % bossAssets.length;
      return bossAssets[bossIndex] ?? bossAssets[0] ?? fallback;
    }

    const normalAssets = this.spawnAssets.filter((asset) => asset.role !== 'boss');
    if (normalAssets.length === 0) {
      return this.spawnAssets[this.spawned % this.spawnAssets.length] ?? fallback;
    }

    const unlockedCount = Phaser.Math.Clamp(Math.ceil(this.wave / 2) + 1, 1, normalAssets.length);
    return normalAssets[Phaser.Math.Between(0, unlockedCount - 1)] ?? normalAssets[0] ?? fallback;
  }
}
