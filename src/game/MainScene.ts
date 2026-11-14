import Phaser from 'phaser'

// Placeholder scene: proves Phaser is running. No gameplay yet.
export class MainScene extends Phaser.Scene {
  private label?: Phaser.GameObjects.Text

  constructor() {
    super('main')
  }

  create() {
    this.label = this.add
      .text(0, 0, 'Phaser is running', { fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#9ca3af' })
      .setOrigin(0.5)
    this.centre()
    this.scale.on('resize', this.centre, this)
  }

  private centre() {
    this.label?.setPosition(this.scale.width / 2, this.scale.height / 2)
  }
}
