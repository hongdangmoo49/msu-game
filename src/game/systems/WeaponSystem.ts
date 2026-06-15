import Phaser from 'phaser';
import { ProjectilePool } from './ProjectilePool';
import WEAPON_DATA from '../data/weapons.json';

/* ================================================
   TYPES
   ================================================ */

export type PatternType = 'single' | 'spread' | 'ring' | 'spiral';

export interface WeaponDef {
  id: string;
  name: string;
  pattern: PatternType;
  baseDamage: number;
  baseSpeed: number;
  baseCooldown: number;
  baseCount: number;
  baseRange: number;
  color: number;
  size: number;
  iconTextureKey?: string;
  projectileTextureKey?: string;
  spreadAngleDeg?: number;
  spiralSpeedDegPerSec?: number;
  upgrades: WeaponUpgrade[];
}

export interface WeaponUpgrade {
  level: number;
  damage?: number;
  cooldown?: number;
  count?: number;
  spreadAngleDeg?: number;
}

export interface PassiveDef {
  id: string;
  name: string;
  icon: string;
  perLevel: Record<string, number>;
}

export interface OwnedWeapon {
  def: WeaponDef;
  level: number;
  lastFired: number;
  spiralAngle: number;
}

/* ================================================
   WEAPON SYSTEM
   ================================================ */

const ALL_WEAPONS: WeaponDef[] = WEAPON_DATA.weapons as WeaponDef[];
const ALL_PASSIVES: PassiveDef[] = WEAPON_DATA.passives as unknown as PassiveDef[];

export class WeaponSystem {
  private scene: Phaser.Scene;
  private pool: ProjectilePool;
  private owned: OwnedWeapon[] = [];
  private passiveLevels: Record<string, number> = {};

  /** Cumulative spiral angle in radians for visual rotation. */
  constructor(scene: Phaser.Scene, pool: ProjectilePool) {
    this.scene = scene;
    this.pool = pool;
  }

  /* ---------- queries ---------- */

  getOwnedWeapons(): ReadonlyArray<Readonly<OwnedWeapon>> {
    return this.owned;
  }

  getPassiveLevels(): Readonly<Record<string, number>> {
    return this.passiveLevels;
  }

  getPassiveMultiplier(key: string): number {
    let total = 0;
    for (const [id, lvl] of Object.entries(this.passiveLevels)) {
      const def = ALL_PASSIVES.find(p => p.id === id);
      if (def && key in def.perLevel) total += def.perLevel[key] * lvl;
    }
    return total;
  }

  /** All weapons not yet owned. */
  getAvailableWeapons(): WeaponDef[] {
    const ownedIds = new Set(this.owned.map(w => w.def.id));
    return ALL_WEAPONS.filter(w => !ownedIds.has(w.id));
  }

  /** All passives (with current levels). */
  getAllPassives(): { def: PassiveDef; level: number }[] {
    return ALL_PASSIVES.map(def => ({ def, level: this.passiveLevels[def.id] ?? 0 }));
  }

  /* ---------- mutations ---------- */

  addWeapon(def: WeaponDef): void {
    this.owned.push({
      def,
      level: 1,
      lastFired: 0,
      spiralAngle: 0,
    });
  }

  upgradeWeapon(defId: string): boolean {
    const owned = this.owned.find(w => w.def.id === defId);
    if (!owned || owned.level >= 5) return false;
    owned.level++;
    return true;
  }

  upgradePassive(id: string): void {
    this.passiveLevels[id] = (this.passiveLevels[id] ?? 0) + 1;
  }

  /* ---------- per-frame ---------- */

  update(time: number, playerX: number, playerY: number, nearestEnemy: { x: number; y: number } | null): void {
    for (const weapon of this.owned) {
      const stats = this.resolveStats(weapon);
      if (time - weapon.lastFired < stats.cooldown) continue;
      if (!nearestEnemy && weapon.def.pattern !== 'ring' && weapon.def.pattern !== 'spiral') continue;

      weapon.lastFired = time;
      this.firePattern(weapon, stats, playerX, playerY, nearestEnemy);
    }
  }

  /* ---------- pattern dispatch ---------- */

  private firePattern(weapon: OwnedWeapon, stats: ResolvedStats, px: number, py: number, target: { x: number; y: number } | null): void {
    switch (weapon.def.pattern) {
      case 'single': this.fireSingle(stats, px, py, target!); break;
      case 'spread': this.fireSpread(weapon, stats, px, py, target!); break;
      case 'ring': this.fireRing(stats, px, py); break;
      case 'spiral': this.fireSpiral(weapon, stats, px, py); break;
    }
  }

  /** Single aimed shot toward nearest enemy. */
  private fireSingle(stats: ResolvedStats, px: number, py: number, target: { x: number; y: number }): void {
    for (let i = 0; i < stats.count; i++) {
      const angle = Phaser.Math.Angle.Between(px, py, target.x, target.y);
      // slight offset for multi-count
      const spreadOffset = stats.count > 1
        ? (i - (stats.count - 1) / 2) * Phaser.Math.DegToRad(8)
        : 0;
      this.pool.fireColored(px, py, angle + spreadOffset, stats.speed, stats.range, stats.damage, stats.color, stats.size, stats.textureKey);
    }
  }

  /** Fan of projectiles aimed toward enemy. */
  private fireSpread(weapon: OwnedWeapon, stats: ResolvedStats, px: number, py: number, target: { x: number; y: number }): void {
    const baseAngle = Phaser.Math.Angle.Between(px, py, target.x, target.y);
    const spreadRad = Phaser.Math.DegToRad(stats.spreadAngle ?? weapon.def.spreadAngleDeg ?? 45);
    const count = stats.count;

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1) - 0.5);
      const angle = baseAngle + t * spreadRad;
      this.pool.fireColored(px, py, angle, stats.speed, stats.range, stats.damage, stats.color, stats.size, stats.textureKey);
    }
  }

  /** 360° ring fired from player, no target needed. */
  private fireRing(stats: ResolvedStats, px: number, py: number): void {
    const count = stats.count;
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      this.pool.fireColored(px, py, step * i, stats.speed, stats.range, stats.damage, stats.color, stats.size, stats.textureKey);
    }
  }

  /** Rotating spiral, fires continuously at spiralSpeed. */
  private fireSpiral(weapon: OwnedWeapon, stats: ResolvedStats, px: number, py: number): void {
    const rotSpeed = Phaser.Math.DegToRad(weapon.def.spiralSpeedDegPerSec ?? 180);
    // deltaTime approximation: use the weapon cooldown as step
    weapon.spiralAngle += rotSpeed * (stats.cooldown / 1000);

    for (let i = 0; i < stats.count; i++) {
      const angle = weapon.spiralAngle + (i * Math.PI * 2 / stats.count);
      this.pool.fireColored(px, py, angle, stats.speed, stats.range, stats.damage, stats.color, stats.size, stats.textureKey);
    }
  }

  /* ---------- stat resolution ---------- */

  private resolveStats(weapon: OwnedWeapon): ResolvedStats {
    const d = weapon.def;
    const u = weapon.level > 1 ? d.upgrades[weapon.level - 2] : null;

    return {
      damage: u?.damage ?? d.baseDamage,
      speed: d.baseSpeed,
      cooldown: u?.cooldown ?? d.baseCooldown,
      count: u?.count ?? d.baseCount,
      range: d.baseRange,
      color: d.color,
      size: d.size,
      textureKey: d.projectileTextureKey,
      spreadAngle: u?.spreadAngleDeg ?? d.spreadAngleDeg,
    };
  }
}

/* ================================================
   RESOLVED STATS (internal)
   ================================================ */

interface ResolvedStats {
  damage: number;
  speed: number;
  cooldown: number;
  count: number;
  range: number;
  color: number;
  size: number;
  textureKey?: string;
  spreadAngle?: number;
}
