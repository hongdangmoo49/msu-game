import Phaser from 'phaser';
import {
  createManifestLoadState,
  ensureCoreFallbackTextures,
  installManifestImageFallbacks,
  loadManifestWithFallback,
  queueManifestImages,
  storeManifestAssets,
} from '../assets';
import { CONFIG } from '../config';
import { panelTextStyle } from '../../ui/phaserUi';

export class BootScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  private detailText!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('BootScene');
  }

  create(): void {
    this.drawLoader();
    ensureCoreFallbackTextures(this);
    void this.prepareAssets();
  }

  private async prepareAssets(): Promise<void> {
    this.setStatus('Loading manifest', 'server cache or local fallback');

    const result = await loadManifestWithFallback();
    const manifest = result.manifest;
    const imageFailures: string[] = [];

    this.setStatus('Loading images', `${manifest.characters.length} characters, ${manifest.icons.length} icons`);

    const queue = queueManifestImages(this, manifest);
    const removeFallbackHandler = installManifestImageFallbacks(this, queue.entityMap, (key) => {
      imageFailures.push(key);
      this.detailText.setText(`fallback texture: ${key}`);
    });

    const finish = (): void => {
      removeFallbackHandler();
      storeManifestAssets(this, manifest, createManifestLoadState(result, imageFailures));
      this.scene.start('LobbyScene');
    };

    if (queue.queuedKeys.length === 0) {
      this.progressFill.width = 360;
      finish();
      return;
    }

    this.load.on('progress', this.onProgress, this);
    this.load.once('complete', () => {
      this.load.off('progress', this.onProgress, this);
      finish();
    });
    this.load.start();
  }

  private drawLoader(): void {
    const cx = CONFIG.WORLD.WIDTH / 2;
    const cy = CONFIG.WORLD.HEIGHT / 2;

    this.cameras.main.setBackgroundColor(CONFIG.WORLD.BG_COLOR);
    this.add.rectangle(cx, cy, 440, 190, 0x0f172a, 0.95).setStrokeStyle(1, 0x334155, 1);
    this.add.text(cx, cy - 58, 'MSU SURVIVAL', {
      ...panelTextStyle(24, '#f8fafc'),
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.statusText = this.add.text(cx, cy - 16, '', panelTextStyle(15, '#cbd5e1')).setOrigin(0.5);
    this.detailText = this.add.text(cx, cy + 16, '', panelTextStyle(12, '#94a3b8')).setOrigin(0.5);

    this.add.rectangle(cx, cy + 52, 360, 8, 0x1e293b, 1).setOrigin(0.5);
    this.progressFill = this.add.rectangle(cx - 180, cy + 52, 1, 8, 0x38bdf8, 1).setOrigin(0, 0.5);
  }

  private setStatus(status: string, detail: string): void {
    this.statusText.setText(status);
    this.detailText.setText(detail);
  }

  private onProgress(value: number): void {
    this.progressFill.width = Math.max(1, Math.floor(360 * value));
  }
}
