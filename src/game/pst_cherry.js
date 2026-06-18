import { Pst_Sprite } from './pst_sprite.js';

export class Pst_Cherry
{
    constructor(x, y)
    {
        this.x = x;
        this.y = y;
        this.alive = true;
        this.sprite = null;
    }

    async init(device, layout, format)
    {
        this.sprite = new Pst_Sprite();
        await this.sprite.loadFromFile(device, null, format, '/cherry.png');
        this.sprite.frames = 1;
    }

    draw(device, pass, scaleX, scaleY)
    {
        if (!this.alive)
          return;
        this.sprite.draw(device, pass, scaleX, scaleY,
            this.x + 0.5, this.y + 0.5,
            0, 0.04, 0.04, 0);
    }
}