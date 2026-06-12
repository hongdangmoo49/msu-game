import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { XpOrb } from '../entities/XpOrb';
import { ProjectilePool } from './ProjectilePool';
import { XpOrbPool } from './XpOrbPool';
import { CONFIG } from '../config';

/** Event names emitted on the scene's event bus. */
export const GameEvents = {
  XP_COLLECTED: 'xp-collected',
  PLAYER_HIT: 'player-hit',
  PLAYER_DEATH: 'player-death',
  ENEMY_KILLED: 'enemy-killed',
} as const;

/**
 * Wires all overlap/collider pairs and translates them into game events.
 * No game-state logic lives here — only mapping physics contacts to events.
 */
export class CollisionSystem {
  private scene: Phaser.Scene;
  private player: Player;
  private projectilePool: ProjectilePool;
  private xpOrbPool: XpOrbPool;
  private enemyGroup: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    projectilePool: ProjectilePool,
    xpOrbPool: XpOrbPool,
    enemyGroup: Phaser.Physics.Arcade.Group,
  ) {
    this.scene = scene;
    this.player = player;
    this.projectilePool = projectilePool;
    this.xpOrbPool = xpOrbPool;
    this.enemyGroup = enemyGroup;

    this.wire();
  }

  private wire(): void {
    const { physics } = this.scene;

    // projectile → enemy
    physics.add.overlap(
      this.projectilePool.group,
      this.enemyGroup,
      // Phaser passes ArcadePhysicsType; we narrow via cast
      (a, b) => this.handleProjectileHit(a as Projectile, b as Enemy),
    );

    // player ← xp orb
    physics.add.overlap(
      this.player,
      this.xpOrbPool.group,
      (a, b) => this.handleXpCollect(b as XpOrb),
    );

    // player ← enemy contact
    physics.add.overlap(
      this.enemyGroup,
      this.player,
      (a) => this.handleEnemyContact(a as Enemy),
    );
  }

  /* ---------- handlers ---------- */

  private handleProjectileHit(proj: Projectile, enemy: Enemy): void {
    if (!proj.active || !enemy.active) return;

    const killed = enemy.takeDamage(proj.getDamage());
    proj.reclaim();

    if (killed) {
      this.xpOrbPool.spawn(enemy.x, enemy.y, enemy.getXpValue());
      this.scene.events.emit(GameEvents.ENEMY_KILLED);
    }
  }

  private handleXpCollect(orb: XpOrb): void {
    if (!orb.active) return;
    const value = orb.getValue();
    orb.collect();
    this.scene.events.emit(GameEvents.XP_COLLECTED, value);
  }

  private handleEnemyContact(enemy: Enemy): void {
    if (!enemy.active) return;

    const dead = this.player.takeDamage(CONFIG.ENEMY.CONTACT_DAMAGE);
    this.scene.events.emit(GameEvents.PLAYER_HIT, this.player.getHp(), this.player.getMaxHp());

    if (dead) {
      this.scene.events.emit(GameEvents.PLAYER_DEATH);
    }
  }
}
