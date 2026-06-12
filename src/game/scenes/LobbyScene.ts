import Phaser from 'phaser';
import type { MsuGameCharacter, MsuGameManifest } from '../../msu/manifest';
import {
  CORE_TEXTURE_KEYS,
  createClientFallbackManifest,
  ensureCoreFallbackTextures,
  readManifest,
  readManifestLoadState,
  resolveTextureKey,
  storeManifestAssets,
  type ManifestLoadState,
  type MatchStartData,
} from '../assets';
import { CONFIG } from '../config';
import { createTextButton, panelTextStyle, type TextButton } from '../../ui/phaserUi';

const PAGE_SIZE = 6;
const CARD_WIDTH = 260;
const CARD_HEIGHT = 128;

export class LobbyScene extends Phaser.Scene {
  private manifest!: MsuGameManifest;
  private loadState!: ManifestLoadState;
  private characters: readonly MsuGameCharacter[] = [];
  private selectedIndex = 0;
  private page = 0;
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private pageButtons: TextButton[] = [];
  private pageObjects: Phaser.GameObjects.GameObject[] = [];
  private startButton!: TextButton;
  private selectedText!: Phaser.GameObjects.Text;

  constructor() {
    super('LobbyScene');
  }

  create(): void {
    ensureCoreFallbackTextures(this);
    this.initData();
    this.drawStaticUi();
    this.renderCards();
    this.installKeyboard();
  }

  private initData(): void {
    let manifest = readManifest(this);
    if (manifest.characters.length === 0) {
      manifest = createClientFallbackManifest('manifest_without_characters');
    }

    this.manifest = manifest;
    this.loadState = readManifestLoadState(this, manifest);
    this.characters = manifest.characters;
    this.selectedIndex = 0;
    this.page = 0;

    storeManifestAssets(this, this.manifest, this.loadState);
  }

  private drawStaticUi(): void {
    this.cameras.main.setBackgroundColor('#020617');
    this.add.rectangle(CONFIG.WORLD.WIDTH / 2, 68, CONFIG.WORLD.WIDTH, 136, 0x0f172a, 1);
    this.add.text(42, 26, 'MSU SURVIVAL', {
      ...panelTextStyle(28, '#f8fafc'),
      fontStyle: 'bold',
    });
    this.add.text(44, 62, 'Select character', panelTextStyle(15, '#94a3b8'));

    const status = this.fallbackStatusText();
    const statusColor = status === null ? '#86efac' : '#fbbf24';
    this.add
      .text(CONFIG.WORLD.WIDTH - 42, 30, status ?? 'Manifest ready', {
        ...panelTextStyle(13, statusColor),
        align: 'right',
        wordWrap: { width: 420 },
      })
      .setOrigin(1, 0);
    this.add
      .text(CONFIG.WORLD.WIDTH - 42, 54, `source: ${this.loadState.source}`, panelTextStyle(12, '#94a3b8'))
      .setOrigin(1, 0);

    this.selectedText = this.add
      .text(44, 492, '', panelTextStyle(14, '#cbd5e1'))
      .setOrigin(0, 0.5);

    this.startButton = createTextButton(this, {
      x: CONFIG.WORLD.WIDTH - 122,
      y: 492,
      width: 160,
      height: 42,
      label: 'Start Match',
      onClick: () => this.startMatch(),
      enabled: this.characters.length > 0,
    });
  }

  private renderCards(): void {
    for (const container of this.cardContainers) container.destroy(true);
    for (const button of this.pageButtons) button.container.destroy(true);
    for (const pageObject of this.pageObjects) pageObject.destroy();
    this.cardContainers = [];
    this.pageButtons = [];
    this.pageObjects = [];

    const start = this.page * PAGE_SIZE;
    const pageCharacters = this.characters.slice(start, start + PAGE_SIZE);

    pageCharacters.forEach((character, pageIndex) => {
      const index = start + pageIndex;
      const col = pageIndex % 3;
      const row = Math.floor(pageIndex / 3);
      const x = 180 + col * 300;
      const y = 196 + row * 154;
      this.cardContainers.push(this.createCharacterCard(character, index, x, y));
    });

    if (this.pageCount() > 1) {
      this.pageButtons.push(createTextButton(this, {
        x: 380,
        y: 426,
        width: 112,
        height: 34,
        label: 'Prev',
        onClick: () => this.changePage(-1),
        enabled: this.page > 0,
      }));
      this.pageButtons.push(createTextButton(this, {
        x: 580,
        y: 426,
        width: 112,
        height: 34,
        label: 'Next',
        onClick: () => this.changePage(1),
        enabled: this.page < this.pageCount() - 1,
      }));
      this.pageObjects.push(
        this.add
          .text(480, 426, `${this.page + 1}/${this.pageCount()}`, panelTextStyle(12, '#94a3b8'))
          .setOrigin(0.5),
      );
    }

    this.updateSelectionLabel();
  }

  private createCharacterCard(
    character: MsuGameCharacter,
    index: number,
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const selected = index === this.selectedIndex;
    const bg = this.add
      .rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, selected ? 0x1e3a8a : 0x111827, 1)
      .setStrokeStyle(2, selected ? 0x60a5fa : 0x334155, selected ? 1 : 0.85);
    const textureKey = resolveTextureKey(this, character.id, CORE_TEXTURE_KEYS.fallbackCharacter);
    const portrait = this.add.image(-86, -8, textureKey).setDisplaySize(72, 72);
    const name = this.add.text(-36, -46, character.name, {
      ...panelTextStyle(15, '#f8fafc'),
      fontStyle: 'bold',
      wordWrap: { width: 150 },
    });
    const detail = this.add.text(-36, -10, characterDetail(character), panelTextStyle(12, '#cbd5e1'));
    const assetKey = this.add.text(-36, 22, shortId(character.assetKey ?? character.tokenId ?? character.id), {
      ...panelTextStyle(11, '#94a3b8'),
      wordWrap: { width: 150 },
    });
    const mark = this.add
      .text(82, 42, selected ? 'READY' : '', {
        ...panelTextStyle(11, '#93c5fd'),
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const container = this.add.container(x, y, [bg, portrait, name, detail, assetKey, mark]);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => this.selectCharacter(index));
    bg.on('pointerover', () => {
      if (index !== this.selectedIndex) bg.setFillStyle(0x1f2937, 1);
    });
    bg.on('pointerout', () => {
      if (index !== this.selectedIndex) bg.setFillStyle(0x111827, 1);
    });

    return container;
  }

  private installKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (keyboard === null) return;

    keyboard.on('keydown-LEFT', this.selectPrevious, this);
    keyboard.on('keydown-RIGHT', this.selectNext, this);
    keyboard.on('keydown-UP', this.selectPreviousRow, this);
    keyboard.on('keydown-DOWN', this.selectNextRow, this);
    keyboard.on('keydown-ENTER', this.startMatch, this);
    keyboard.on('keydown-SPACE', this.startMatch, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown-LEFT', this.selectPrevious, this);
      keyboard.off('keydown-RIGHT', this.selectNext, this);
      keyboard.off('keydown-UP', this.selectPreviousRow, this);
      keyboard.off('keydown-DOWN', this.selectNextRow, this);
      keyboard.off('keydown-ENTER', this.startMatch, this);
      keyboard.off('keydown-SPACE', this.startMatch, this);
    });
  }

  private selectCharacter(index: number): void {
    if (index < 0 || index >= this.characters.length) return;
    this.selectedIndex = index;
    this.page = Math.floor(index / PAGE_SIZE);
    this.renderCards();
  }

  private selectPrevious(): void {
    this.selectCharacter(Math.max(0, this.selectedIndex - 1));
  }

  private selectNext(): void {
    this.selectCharacter(Math.min(this.characters.length - 1, this.selectedIndex + 1));
  }

  private selectPreviousRow(): void {
    this.selectCharacter(Math.max(0, this.selectedIndex - 3));
  }

  private selectNextRow(): void {
    this.selectCharacter(Math.min(this.characters.length - 1, this.selectedIndex + 3));
  }

  private changePage(delta: number): void {
    const nextPage = Phaser.Math.Clamp(this.page + delta, 0, this.pageCount() - 1);
    if (nextPage === this.page) return;
    this.page = nextPage;
    this.selectedIndex = Phaser.Math.Clamp(this.selectedIndex, this.page * PAGE_SIZE, this.page * PAGE_SIZE + PAGE_SIZE - 1);
    if (this.selectedIndex >= this.characters.length) this.selectedIndex = this.characters.length - 1;
    this.renderCards();
  }

  private startMatch(): void {
    const selectedCharacter = this.characters[this.selectedIndex];
    if (selectedCharacter === undefined) return;

    const data: MatchStartData = {
      manifest: this.manifest,
      selectedCharacter,
      loadState: this.loadState,
    };
    this.scene.start('GameScene', data);
  }

  private pageCount(): number {
    return Math.max(1, Math.ceil(this.characters.length / PAGE_SIZE));
  }

  private updateSelectionLabel(): void {
    const selectedCharacter = this.characters[this.selectedIndex];
    this.selectedText.setText(
      selectedCharacter === undefined
        ? 'No selectable character'
        : `Selected: ${selectedCharacter.name}`,
    );
  }

  private fallbackStatusText(): string | null {
    if (this.loadState.usedClientFallback) {
      return `Client fallback: ${this.loadState.errorMessage ?? 'manifest unavailable'}`;
    }
    if (this.loadState.source === 'fallback') {
      return 'Cache fallback active';
    }
    if (this.loadState.imageFailures.length > 0) {
      return `Image fallback: ${this.loadState.imageFailures.length}`;
    }
    if (this.loadState.warnings.length > 0) {
      return this.loadState.warnings[0] ?? null;
    }
    return null;
  }
}

function characterDetail(character: MsuGameCharacter): string {
  const parts = [
    character.job,
    character.level === undefined ? undefined : `Lv ${character.level}`,
  ].filter((part): part is string => typeof part === 'string' && part.length > 0);

  return parts.length > 0 ? parts.join(' / ') : 'Unknown class';
}

function shortId(value: string): string {
  return value.length <= 24 ? value : `${value.slice(0, 10)}...${value.slice(-10)}`;
}
