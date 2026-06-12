/**
 * Central game-tuning constants.
 * Every magic number lives here so balance iteration doesn't touch logic files.
 */
export const CONFIG = {
  WORLD: {
    WIDTH: 960,
    HEIGHT: 540,
    BG_COLOR: '#0f172a',
  },

  PLAYER: {
    SPEED: 200,
    MAX_HEALTH: 100,
    ATTACK_INTERVAL_MS: 400,
    INVINCIBLE_MS: 500,
    SIZE: 24,
    COLOR: 0x3b82f6,
  },

  ENEMY: {
    BASE_SPEED: 70,
    BASE_HEALTH: 30,
    SIZE: 18,
    COLOR: 0xef4444,
    SPAWN_INTERVAL_MS: 1200,
    POOL_SIZE: 300,
    SPEED_PER_WAVE: 3,
    HEALTH_PER_WAVE: 8,
    CONTACT_DAMAGE: 15,
    XP_VALUE: 10,
  },

  PROJECTILE: {
    SPEED: 480,
    DAMAGE: 10,
    SIZE: 6,
    COLOR: 0xffffff,
    POOL_SIZE: 500,
    MAX_RANGE: 500,
  },

  LEVEL: {
    XP_BASE: 20,
    XP_GROWTH: 1.4,
    MAX_WEAPON_LEVEL: 5,
    MAX_PASSIVE_LEVEL: 5,
  },

  XP_ORB: {
    SIZE: 8,
    COLOR: 0x22c55e,
    MAGNET_RANGE: 80,
    COLLECT_SPEED: 220,
    POOL_SIZE: 300,
  },
} as const;
