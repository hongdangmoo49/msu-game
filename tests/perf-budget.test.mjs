import { performance } from 'node:perf_hooks';

const PROJECTILE_COUNT = 300;
const ENEMY_COUNT = 100;
const FRAME_COUNT = 600;
const WARMUP_FRAMES = 120;
const TARGET_FRAME_MS = 1000 / 60;
const DT_SECONDS = 1 / 60;
const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;

const projectiles = Array.from({ length: PROJECTILE_COUNT }, (_, index) => {
  const angle = (index / PROJECTILE_COUNT) * Math.PI * 2;
  return {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    startX: WORLD_WIDTH / 2,
    startY: WORLD_HEIGHT / 2,
    vx: Math.cos(angle) * 480,
    vy: Math.sin(angle) * 480,
    range: 500,
    active: true,
  };
});

const enemies = Array.from({ length: ENEMY_COUNT }, (_, index) => {
  const ring = index % 2 === 0 ? 1 : -1;
  const angle = (index / ENEMY_COUNT) * Math.PI * 2;
  return {
    x: WORLD_WIDTH / 2 + Math.cos(angle) * WORLD_WIDTH * ring,
    y: WORLD_HEIGHT / 2 + Math.sin(angle) * WORLD_HEIGHT * ring,
    vx: 0,
    vy: 0,
    hp: 60,
    active: true,
  };
});

for (let i = 0; i < WARMUP_FRAMES; i++) {
  simulateFrame(i);
}

const frameTimes = [];
for (let i = 0; i < FRAME_COUNT; i++) {
  const startedAt = performance.now();
  simulateFrame(i + WARMUP_FRAMES);
  frameTimes.push(performance.now() - startedAt);
}

const result = {
  scenario: {
    projectiles: PROJECTILE_COUNT,
    enemies: ENEMY_COUNT,
    frames: FRAME_COUNT,
  },
  meanFrameMs: round(average(frameTimes)),
  p95FrameMs: round(percentile(frameTimes, 0.95)),
  maxFrameMs: round(Math.max(...frameTimes)),
  estimatedFpsFromMean: round(1000 / average(frameTimes)),
  targetFrameMs: round(TARGET_FRAME_MS),
};

console.log(JSON.stringify(result, null, 2));

if (result.p95FrameMs > TARGET_FRAME_MS) {
  throw new Error(`perf budget failed: p95 ${result.p95FrameMs}ms > ${round(TARGET_FRAME_MS)}ms`);
}

function simulateFrame(frame) {
  const player = {
    x: WORLD_WIDTH / 2 + Math.cos(frame / 90) * 80,
    y: WORLD_HEIGHT / 2 + Math.sin(frame / 120) * 50,
  };

  let nearestEnemy = null;
  let nearestDistance = Infinity;

  for (const enemy of enemies) {
    if (!enemy.active) continue;

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    enemy.vx = (dx / len) * 95;
    enemy.vy = (dy / len) * 95;
    enemy.x += enemy.vx * DT_SECONDS;
    enemy.y += enemy.vy * DT_SECONDS;

    const distSq = dx * dx + dy * dy;
    if (distSq < nearestDistance) {
      nearestDistance = distSq;
      nearestEnemy = enemy;
    }
  }

  const targetAngle = nearestEnemy === null
    ? frame / 60
    : Math.atan2(nearestEnemy.y - player.y, nearestEnemy.x - player.x);

  for (let i = 0; i < projectiles.length; i++) {
    const projectile = projectiles[i];
    if (!projectile.active) continue;

    projectile.x += projectile.vx * DT_SECONDS;
    projectile.y += projectile.vy * DT_SECONDS;

    const traveledX = projectile.x - projectile.startX;
    const traveledY = projectile.y - projectile.startY;
    if (traveledX * traveledX + traveledY * traveledY > projectile.range * projectile.range) {
      const angle = targetAngle + ((i % 9) - 4) * 0.08;
      projectile.x = player.x;
      projectile.y = player.y;
      projectile.startX = player.x;
      projectile.startY = player.y;
      projectile.vx = Math.cos(angle) * 480;
      projectile.vy = Math.sin(angle) * 480;
    }
  }

  let collisionChecks = 0;
  for (const projectile of projectiles) {
    for (const enemy of enemies) {
      const dx = projectile.x - enemy.x;
      const dy = projectile.y - enemy.y;
      if (dx * dx + dy * dy < 18 * 18) {
        enemy.hp -= 10;
        if (enemy.hp <= 0) {
          enemy.hp = 60;
          enemy.x = WORLD_WIDTH / 2 + Math.cos(frame + collisionChecks) * WORLD_WIDTH;
          enemy.y = WORLD_HEIGHT / 2 + Math.sin(frame + collisionChecks) * WORLD_HEIGHT;
        }
      }
      collisionChecks++;
    }
  }
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
