import Phaser from 'phaser';
import { WeaponDef, PassiveDef } from '../systems/WeaponSystem';

/* ================================================
   TYPES
   ================================================ */

export interface WeaponChoice {
  kind: 'weapon';
  def: WeaponDef;
  /** Current owned level (0 = new weapon). */
  currentLevel: number;
}

export interface PassiveChoice {
  kind: 'passive';
  def: PassiveDef;
  currentLevel: number;
}

export type LevelUpChoice = WeaponChoice | PassiveChoice;

/* ================================================
   LEVEL UP PANEL
   ================================================ */

const CARD_W = 180;
const CARD_H = 220;
const CARD_GAP = 24;
const CARD_RADIUS = 10;
const BG_ALPHA = 0.7;

export class LevelUpPanel {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private choices: LevelUpChoice[] = [];
  private onSelect?: (index: number) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Show the panel with up to 3 choices. Calls back with selected index. */
  show(choices: LevelUpChoice[], onSelect: (index: number) => void): void {
    this.choices = choices.slice(0, 3);
    this.onSelect = onSelect;
    this.buildUI();
  }

  /** Tear down the panel. */
  destroy(): void {
    if (this.container) this.container.destroy();
    this.container = undefined as unknown as Phaser.GameObjects.Container;
  }

  /* ---------- build ---------- */

  private buildUI(): void {
    const { WIDTH, HEIGHT } = { WIDTH: 960, HEIGHT: 540 };
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;
    const count = this.choices.length;

    this.container = this.scene.add.container(0, 0).setDepth(300).setScrollFactor(0);

    // dark overlay
    const overlay = this.scene.add.rectangle(cx, cy, WIDTH, HEIGHT, 0x0f172a, BG_ALPHA);
    this.container.add(overlay);

    // title
    const title = this.scene.add.text(cx, cy - CARD_H / 2 - 40, 'LEVEL UP', {
      color: '#fbbf24',
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(title);

    // cards
    const totalW = count * CARD_W + (count - 1) * CARD_GAP;
    const startX = cx - totalW / 2 + CARD_W / 2;

    for (let i = 0; i < count; i++) {
      this.buildCard(i, startX + i * (CARD_W + CARD_GAP), cy);
    }

    // pause physics while choosing
    this.scene.physics.pause();
  }

  private buildCard(index: number, x: number, y: number): void {
    const choice = this.choices[index];
    const isNew = choice.kind === 'weapon'
      ? choice.currentLevel === 0
      : choice.currentLevel === 0;

    const nextLevel = isNew ? 1 : choice.currentLevel + 1;

    // card background
    const bg = this.scene.add.rectangle(x, y, CARD_W, CARD_H, 0x1e293b)
      .setStrokeStyle(2, 0x475569)
      .setInteractive({ useHandCursor: true });

    // hover highlight
    bg.on('pointerover', () => bg.setStrokeStyle(2, 0xfbbf24));
    bg.on('pointerout', () => bg.setStrokeStyle(2, 0x475569));

    // click
    bg.on('pointerdown', () => {
      this.scene.physics.resume();
      const cb = this.onSelect;
      this.destroy();
      cb?.(index);
    });

    this.container.add(bg);

    // weapon color dot or passive icon
    let yOffset = -CARD_H / 2 + 24;

    if (choice.kind === 'weapon') {
      const dotSize = 20;
      const dot = this.scene.add.circle(x, y + yOffset, dotSize / 2, choice.def.color);
      this.container.add(dot);
    } else {
      const icon = this.scene.add.text(x, y + yOffset, choice.def.icon, {
        fontSize: '22px',
      }).setOrigin(0.5);
      this.container.add(icon);
    }

    yOffset += 28;

    // name
    const nameText = this.scene.add.text(x, y + yOffset, choice.def.name, {
      color: '#f8fafc',
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: CARD_W - 20 },
    }).setOrigin(0.5);
    this.container.add(nameText);

    yOffset += 24;

    // level badge
    const badge = isNew ? 'NEW' : `Lv ${nextLevel}`;
    const badgeColor = isNew ? '#22c55e' : '#94a3b8';
    const badgeText = this.scene.add.text(x, y + yOffset, badge, {
      color: badgeColor,
      fontFamily: 'monospace',
      fontSize: '11px',
    }).setOrigin(0.5);
    this.container.add(badgeText);

    yOffset += 20;

    // stat preview
    const preview = choice.kind === 'weapon'
      ? this.weaponStatLines(choice as WeaponChoice, nextLevel)
      : this.passiveStatLines(choice as PassiveChoice);

    const statText = this.scene.add.text(x, y + yOffset, preview, {
      color: '#94a3b8',
      fontFamily: 'monospace',
      fontSize: '10px',
      align: 'center',
      lineSpacing: 3,
    }).setOrigin(0.5);
    this.container.add(statText);
  }

  /* ---------- stat preview helpers ---------- */

  private weaponStatLines(choice: WeaponChoice, nextLevel: number): string {
    const d = choice.def;
    const u = nextLevel > 1 ? d.upgrades[nextLevel - 2] : null;
    const dmg = u?.damage ?? d.baseDamage;
    const cd = u?.cooldown ?? d.baseCooldown;
    const count = u?.count ?? d.baseCount;
    const patternLabel = { single: '단일', spread: '확산', ring: '링', spiral: '나선' }[d.pattern];
    return [
      `패턴: ${patternLabel}`,
      `데미지: ${dmg}`,
      `쿨다운: ${cd}ms`,
      `투사체: ${count}개`,
    ].join('\n');
  }

  private passiveStatLines(choice: PassiveChoice): string {
    const lines = Object.entries(choice.def.perLevel)
      .map(([k, v]) => `${k}: +${v}/Lv`);
    return lines.join('\n');
  }
}
