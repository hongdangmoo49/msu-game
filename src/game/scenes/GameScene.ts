import Phaser from 'phaser';
import { CONFIG } from '../config';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { XpOrb } from '../entities/XpOrb';
import { ProjectilePool } from '../systems/ProjectilePool';
import { XpOrbPool } from '../systems/XpOrbPool';
import { EnemySpawner, type EnemySpawnAsset } from '../systems/EnemySpawner';
import { CollisionSystem, GameEvents } from '../systems/CollisionSystem';
import { WeaponSystem, WeaponDef, PassiveDef } from '../systems/WeaponSystem';
import { LevelUpPanel, LevelUpChoice, WeaponChoice, PassiveChoice } from '../ui/LevelUpPanel';
import { CORE_TEXTURE_KEYS, resolveTextureKey, type MatchStartData } from '../assets';
import type { MsuGameManifest } from '../../msu/manifest';
import { PerfOverlay } from '../debug/PerfOverlay';
import WEAPON_DATA from '../data/weapons.json';

const ALL_WEAPONS: WeaponDef[] = WEAPON_DATA.weapons as WeaponDef[];
const ALL_PASSIVES: PassiveDef[] = WEAPON_DATA.passives as unknown as PassiveDef[];

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private projectilePool!: ProjectilePool;
  private xpOrbPool!: XpOrbPool;
  private spawner!: EnemySpawner;
  private weaponSystem!: WeaponSystem;
  private levelUpPanel!: LevelUpPanel;
  private perfOverlay!: PerfOverlay;
  private startData: MatchStartData | null = null;

  // progression
  private level = 1;
  private xpTotal = 0;
  private xpToNext: number = CONFIG.LEVEL.XP_BASE;
  private killCount = 0;
  private gameOver = false;
  private levelingUp = false;

  // HUD
  private xpText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private weaponHud!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  init(data: unknown): void {
    this.startData = isMatchStartData(data) ? data : null;
  }

  /* ================================================
     CREATE
     ================================================ */

  create(): void {
    this.level = 1;
    this.xpTotal = 0;
    this.xpToNext = CONFIG.LEVEL.XP_BASE;
    this.killCount = 0;
    this.gameOver = false;
    this.levelingUp = false;

    this.generateTextures();
    this.physics.world.setBounds(0, 0, CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT);
    this.drawBackground();

    // --- entities ---
    this.player = new Player(this, CONFIG.WORLD.WIDTH / 2, CONFIG.WORLD.HEIGHT / 2);
    this.applySelectedCharacterTexture();
    this.enemyGroup = this.physics.add.group({ classType: Enemy, maxSize: CONFIG.ENEMY.POOL_SIZE });
    this.projectilePool = new ProjectilePool(this);
    this.xpOrbPool = new XpOrbPool(this);

    // --- systems ---
    this.weaponSystem = new WeaponSystem(this, this.projectilePool);
    // grant starting weapon
    const starter = ALL_WEAPONS.find(w => w.id === 'energy_bolt')!;
    this.weaponSystem.addWeapon(starter);

    this.spawner = new EnemySpawner(this, this.enemyGroup, resolveEnemySpawnAssets(this, this.startData?.manifest));
    new CollisionSystem(this, this.player, this.projectilePool, this.xpOrbPool, this.enemyGroup);
    this.levelUpPanel = new LevelUpPanel(this);
    this.perfOverlay = new PerfOverlay(this, {
      projectileGroup: this.projectilePool.group,
      enemyGroup: this.enemyGroup,
    });

    // --- HUD ---
    this.xpText = this.add.text(16, 16, 'XP 0/20', hudStyle()).setDepth(100);
    this.hpText = this.add.text(16, 36, hpLabel(this.player), hudStyle()).setDepth(100);
    this.levelText = this.add.text(16, 56, 'Lv 1', hudStyle()).setDepth(100);
    this.waveText = this.add.text(CONFIG.WORLD.WIDTH - 16, 16, 'Kills 0', { ...hudStyle(), align: 'right' })
      .setOrigin(1, 0).setDepth(100);
    this.weaponHud = this.add.text(CONFIG.WORLD.WIDTH - 16, 36, '', { ...hudStyle(), align: 'right', fontSize: '11px' })
      .setOrigin(1, 0).setDepth(100);

    // --- events ---
    this.events.on(GameEvents.XP_COLLECTED, this.onXpCollected, this);
    this.events.on(GameEvents.PLAYER_HIT, this.onPlayerHit, this);
    this.events.on(GameEvents.PLAYER_DEATH, this.onPlayerDeath, this);
    this.events.on(GameEvents.ENEMY_KILLED, this.onEnemyKilled, this);
  }

  /* ================================================
     UPDATE
     ================================================ */

  update(time: number): void {
    if (this.gameOver || this.levelingUp) return;

    // apply passive modifiers
    this.applyPassives();

    // player movement
    this.player.update();

    // weapon system fires all owned weapons
    const nearest = this.findNearestEnemy();
    this.weaponSystem.update(time, this.player.x, this.player.y, nearest);

    // enemy tracking
    const playerPos = { x: this.player.x, y: this.player.y };
    for (const child of this.enemyGroup.getChildren() as Enemy[]) {
      if (child.active) child.trackTarget(playerPos);
    }

    // xp orb magnetism (passive-boosted range)
    const magnetRange = CONFIG.XP_ORB.MAGNET_RANGE *
      (1 + this.weaponSystem.getPassiveMultiplier('magnetRangePercent') / 100);
    for (const child of this.xpOrbPool.group.getChildren() as XpOrb[]) {
      if (child.active) child.magnetizeTo(playerPos, magnetRange);
    }

    // weapon HUD
    this.updateWeaponHud();
    this.perfOverlay.update(time);
  }

  /* ================================================
     PASSIVES
     ================================================ */

  private applyPassives(): void {
    const speedPct = this.weaponSystem.getPassiveMultiplier('speedPercent');
    this.player.setSpeedMultiplier(1 + speedPct / 100);

    const armorPct = this.weaponSystem.getPassiveMultiplier('damageReductionPercent');
    this.player.setDamageReduction(armorPct);
  }

  /* ================================================
     LEVEL UP
     ================================================ */

  private checkLevelUp(): void {
    if (this.levelingUp) return;
    if (this.xpTotal < this.xpToNext) return;

    this.xpTotal -= this.xpToNext;
    this.level++;
    this.xpToNext = Math.floor(CONFIG.LEVEL.XP_BASE * Math.pow(CONFIG.LEVEL.XP_GROWTH, this.level - 1));
    this.levelText.setText(`Lv ${this.level}`);

    const choices = this.buildChoices();
    if (choices.length === 0) return; // nothing to offer

    this.levelingUp = true;
    this.levelUpPanel.show(choices, (index) => {
      this.applyChoice(choices[index]);
      this.levelingUp = false;
      // check for chained level-ups
      this.checkLevelUp();
    });
  }

  private buildChoices(): LevelUpChoice[] {
    const pool: LevelUpChoice[] = [];

    // new weapons
    const available = this.weaponSystem.getAvailableWeapons();
    for (const def of available) {
      pool.push({ kind: 'weapon', def, currentLevel: 0 });
    }

    // weapon upgrades
    for (const w of this.weaponSystem.getOwnedWeapons()) {
      if (w.level < CONFIG.LEVEL.MAX_WEAPON_LEVEL) {
        pool.push({ kind: 'weapon', def: w.def, currentLevel: w.level });
      }
    }

    // passives
    const passives = this.weaponSystem.getAllPassives();
    for (const p of passives) {
      if (p.level < CONFIG.LEVEL.MAX_PASSIVE_LEVEL) {
        pool.push({ kind: 'passive', def: p.def, currentLevel: p.level });
      }
    }

    // shuffle and pick 3
    Phaser.Utils.Array.Shuffle(pool);
    return pool.slice(0, 3);
  }

  private applyChoice(choice: LevelUpChoice): void {
    if (choice.kind === 'weapon') {
      if (choice.currentLevel === 0) {
        this.weaponSystem.addWeapon(choice.def);
      } else {
        this.weaponSystem.upgradeWeapon(choice.def.id);
      }
    } else {
      this.weaponSystem.upgradePassive(choice.def.id);

      // immediate effects for HP passive
      if (choice.def.id === 'max_hp_up') {
        const bonus = choice.def.perLevel['flatHp'] ?? 0;
        this.player.addBonusMaxHp(bonus);
        this.onPlayerHit(this.player.getHp(), this.player.getMaxHp());
      }
    }

    this.updateWeaponHud();
  }

  /* ================================================
     TEXTURES  (procedural — no external assets)
     ================================================ */

  private generateTextures(): void {
    circleTexture(this, 'player', CONFIG.PLAYER.SIZE, CONFIG.PLAYER.COLOR);
    circleTexture(this, 'enemy', CONFIG.ENEMY.SIZE, CONFIG.ENEMY.COLOR);
    // white base — tinted per weapon at fire-time
    circleTexture(this, 'projectile', 8, CONFIG.PROJECTILE.COLOR);
    circleTexture(this, 'xp_orb', CONFIG.XP_ORB.SIZE, CONFIG.XP_ORB.COLOR);
  }

  private drawBackground(): void {
    const background = this.startData?.manifest.backgrounds?.find((candidate) =>
      this.textures.exists(candidate.id),
    );

    this.cameras.main.setBackgroundColor(CONFIG.WORLD.BG_COLOR);

    if (background === undefined) {
      return;
    }

    this.add
      .image(CONFIG.WORLD.WIDTH / 2, CONFIG.WORLD.HEIGHT / 2, background.id)
      .setDisplaySize(CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT)
      .setAlpha(0.48)
      .setDepth(-100);
    this.add
      .rectangle(CONFIG.WORLD.WIDTH / 2, CONFIG.WORLD.HEIGHT / 2, CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT, 0x020617, 0.38)
      .setDepth(-90);
  }

  /* ================================================
     HELPERS
     ================================================ */

  private findNearestEnemy(): Enemy | null {
    let nearest: Enemy | null = null;
    let minDist = Infinity;

    for (const child of this.enemyGroup.getChildren() as Enemy[]) {
      if (!child.active) continue;
      const dist = Phaser.Math.Distance.Squared(
        this.player.x, this.player.y, child.x, child.y,
      );
      if (dist < minDist) {
        minDist = dist;
        nearest = child;
      }
    }

    return nearest;
  }

  private applySelectedCharacterTexture(): void {
    const selectedCharacter = this.startData?.selectedCharacter;
    if (selectedCharacter === undefined) return;

    const textureKey = resolveTextureKey(this, selectedCharacter.id, CORE_TEXTURE_KEYS.player);
    if (textureKey === CORE_TEXTURE_KEYS.player) return;

    this.player.setTexture(textureKey);
    this.player.setDisplaySize(CONFIG.PLAYER.SIZE * 2, CONFIG.PLAYER.SIZE * 2);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(CONFIG.PLAYER.SIZE, CONFIG.PLAYER.SIZE);
    body.setOffset(
      Math.max(0, (this.player.width - CONFIG.PLAYER.SIZE) / 2),
      Math.max(0, (this.player.height - CONFIG.PLAYER.SIZE) / 2),
    );
  }

  private updateWeaponHud(): void {
    const lines = this.weaponSystem.getOwnedWeapons().map(w =>
      `${w.def.name} Lv${w.level}`,
    );
    this.weaponHud.setText(lines.join('  |  '));
  }

  /* ---------- event handlers ---------- */

  private onXpCollected(value: number): void {
    this.xpTotal += value;
    this.xpText.setText(`XP ${this.xpTotal}/${this.xpToNext}`);
    this.checkLevelUp();
  }

  private onPlayerHit(hp: number, maxHp: number): void {
    this.hpText.setText(`HP ${Math.ceil(hp)}/${maxHp}`);
  }

  private onEnemyKilled(): void {
    this.killCount++;
    this.waveText.setText(`Kills ${this.killCount}`);
  }

  private onPlayerDeath(): void {
    this.gameOver = true;
    this.physics.pause();

    const cx = CONFIG.WORLD.WIDTH / 2;
    const cy = CONFIG.WORLD.HEIGHT / 2;

    this.add.rectangle(cx, cy, CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT, 0x000000, 0.6).setDepth(200);
    this.add.text(cx, cy - 40, 'GAME OVER', {
      color: '#ef4444', fontFamily: 'Arial, sans-serif', fontSize: '32px', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(201);

    this.add.text(cx, cy, `Lv ${this.level}  ·  XP ${this.xpTotal}  ·  Kills ${this.killCount}`, {
      color: '#fbbf24', fontFamily: 'monospace', fontSize: '16px',
    }).setOrigin(0.5).setDepth(201);

    const weapons = this.weaponSystem.getOwnedWeapons()
      .map(w => `${w.def.name} Lv${w.level}`).join(', ');
    this.add.text(cx, cy + 28, weapons, {
      color: '#94a3b8', fontFamily: 'monospace', fontSize: '12px',
    }).setOrigin(0.5).setDepth(201);

    const restartText = this.add.text(cx, cy + 60, '[ click or press any key to restart ]', {
      color: '#94a3b8', fontFamily: 'monospace', fontSize: '13px',
    }).setOrigin(0.5).setDepth(201);

    this.tweens.add({ targets: restartText, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    const restart = () => {
      this.input.keyboard!.off('keydown', restart);
      this.input.off('pointerdown', restart);
      this.scene.restart(this.startData ?? undefined);
    };

    this.input.keyboard!.on('keydown', restart);
    this.input.on('pointerdown', restart);
  }
}

/* ================================================
   MODULE-LOCAL HELPERS
   ================================================ */

function hudStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return { color: '#f8fafc', fontFamily: 'monospace', fontSize: '14px' };
}

function hpLabel(player: Player): string {
  return `HP ${player.getHp()}/${player.getMaxHp()}`;
}

function circleTexture(scene: Phaser.Scene, key: string, size: number, color: number): void {
  if (scene.textures.exists(key)) return;

  const g = scene.add.graphics();
  g.fillStyle(color);
  g.fillCircle(size / 2, size / 2, size / 2);
  g.generateTexture(key, size, size);
  g.destroy();
}

function isMatchStartData(value: unknown): value is MatchStartData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<MatchStartData>;

  return (
    typeof candidate.selectedCharacter === 'object' &&
    candidate.selectedCharacter !== null &&
    typeof candidate.selectedCharacter.id === 'string' &&
    typeof candidate.selectedCharacter.name === 'string' &&
    typeof candidate.manifest === 'object' &&
    candidate.manifest !== null &&
    typeof candidate.loadState === 'object' &&
    candidate.loadState !== null
  );
}

function resolveEnemySpawnAssets(
  scene: Phaser.Scene,
  manifest: MsuGameManifest | undefined,
): readonly EnemySpawnAsset[] {
  const enemies = manifest?.enemies ?? [];

  return enemies
    .filter((enemy) => scene.textures.exists(enemy.id))
    .map((enemy) => ({
      textureKey: enemy.id,
      name: enemy.name,
      role: enemy.role ?? 'basic',
      displaySize: clampNumber(enemy.displaySize, CONFIG.ENEMY.SIZE, 24, 92),
      healthMultiplier: clampNumber(enemy.healthMultiplier, 1, 0.2, 8),
      speedMultiplier: clampNumber(enemy.speedMultiplier, 1, 0.2, 3),
      xpMultiplier: clampNumber(enemy.xpMultiplier, 1, 0.1, 10),
    }));
}

function clampNumber(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Phaser.Math.Clamp(value, min, max);
}
