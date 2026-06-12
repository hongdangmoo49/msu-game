import Phaser from 'phaser';

const SAMPLE_SIZE = 120;
const TARGET_FRAME_MS = 1000 / 60;
const TARGET_PROJECTILES = 300;
const TARGET_ENEMIES = 100;

export interface PerfOverlayTargets {
  readonly projectileGroup: Phaser.Physics.Arcade.Group;
  readonly enemyGroup: Phaser.Physics.Arcade.Group;
}

export class PerfOverlay {
  private readonly scene: Phaser.Scene;
  private readonly targets: PerfOverlayTargets;
  private readonly enabled: boolean;
  private readonly samples: number[] = [];
  private label: Phaser.GameObjects.Text | null = null;
  private lastTime = 0;
  private nextRefreshAt = 0;

  constructor(scene: Phaser.Scene, targets: PerfOverlayTargets, enabled = shouldEnablePerfOverlay()) {
    this.scene = scene;
    this.targets = targets;
    this.enabled = enabled;

    if (!this.enabled) return;

    this.label = scene.add.text(8, 96, '', {
      color: '#cbd5e1',
      fontFamily: 'monospace',
      fontSize: '11px',
      lineSpacing: 2,
      backgroundColor: '#020617cc',
      padding: { x: 6, y: 5 },
    }).setDepth(5000).setScrollFactor(0);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update(time: number): void {
    if (!this.enabled || this.label === null) return;

    if (this.lastTime > 0) {
      this.samples.push(Math.max(0, time - this.lastTime));
      if (this.samples.length > SAMPLE_SIZE) this.samples.shift();
    }
    this.lastTime = time;

    if (time < this.nextRefreshAt) return;
    this.nextRefreshAt = time + 250;

    const avgFrameMs = average(this.samples);
    const p95FrameMs = percentile(this.samples, 0.95);
    const fps = this.scene.game.loop.actualFps;
    const projectileCount = this.targets.projectileGroup.countActive(true);
    const enemyCount = this.targets.enemyGroup.countActive(true);
    const budgetOk = p95FrameMs <= TARGET_FRAME_MS;
    const stressReached = projectileCount >= TARGET_PROJECTILES && enemyCount >= TARGET_ENEMIES;

    this.label.setColor(budgetOk ? '#bbf7d0' : '#fecaca');
    this.label.setText([
      `FPS ${fps.toFixed(1)}  p95 ${p95FrameMs.toFixed(2)}ms`,
      `avg ${avgFrameMs.toFixed(2)}ms  target ${TARGET_FRAME_MS.toFixed(2)}ms`,
      `proj ${projectileCount}/${TARGET_PROJECTILES}  enemy ${enemyCount}/${TARGET_ENEMIES}`,
      `budget ${budgetOk ? 'OK' : 'SLOW'}  load ${stressReached ? 'MET' : 'LIVE'}`,
    ].join('\n'));
  }

  destroy(): void {
    this.label?.destroy();
    this.label = null;
    this.samples.length = 0;
  }
}

function shouldEnablePerfOverlay(): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  return (
    params.get('perf') === '1' ||
    params.get('msuPerf') === '1' ||
    window.localStorage.getItem('msu.perfOverlay') === '1'
  );
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}
