import Phaser from 'phaser';

export interface TextButton {
  readonly container: Phaser.GameObjects.Container;
  setEnabled(enabled: boolean): void;
  setText(text: string): void;
}

interface ButtonOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly onClick: () => void;
  readonly enabled?: boolean;
}

export function createTextButton(scene: Phaser.Scene, options: ButtonOptions): TextButton {
  let enabled = options.enabled ?? true;
  const bg = scene.add
    .rectangle(0, 0, options.width, options.height, 0x2563eb, 1)
    .setStrokeStyle(1, 0x93c5fd, 0.8);
  const label = scene.add
    .text(0, 0, options.label, {
      color: '#f8fafc',
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
    })
    .setOrigin(0.5);
  const container = scene.add.container(options.x, options.y, [bg, label]);

  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', () => {
    if (enabled) options.onClick();
  });
  bg.on('pointerover', () => {
    if (enabled) bg.setFillStyle(0x1d4ed8, 1);
  });
  bg.on('pointerout', () => {
    bg.setFillStyle(enabled ? 0x2563eb : 0x475569, enabled ? 1 : 0.7);
  });

  const renderState = (): void => {
    bg.setFillStyle(enabled ? 0x2563eb : 0x475569, enabled ? 1 : 0.7);
    bg.setStrokeStyle(1, enabled ? 0x93c5fd : 0x64748b, enabled ? 0.8 : 0.5);
    label.setAlpha(enabled ? 1 : 0.65);
  };
  renderState();

  return {
    container,
    setEnabled(nextEnabled: boolean): void {
      enabled = nextEnabled;
      renderState();
    },
    setText(text: string): void {
      label.setText(text);
    },
  };
}

export function panelTextStyle(size: number, color = '#e2e8f0'): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    color,
    fontFamily: 'Arial, sans-serif',
    fontSize: `${size}px`,
  };
}
