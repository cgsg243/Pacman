import { Pst_Sprite } from './pst_sprite.js';

export class Pst_MiniSpamton
{
    constructor(x, y, vx, vy)
    {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.alive = true;
    }

    update(dt, worldW, worldH)
    {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.x < -2 || this.x > worldW + 2 || this.y < -2 || this.y > worldH + 2)
            this.alive = false;
    }

    draw(device, pass, scaleX, scaleY, headSprite)
    {
        if (!this.alive)
           return;

        headSprite.draw(device, pass, scaleX, scaleY, this.x, this.y, 0, 0.03, 0.03, 0);
    }
    checkCollision(heartX, heartY, radius = 0.1)
    {
        if (!this.alive)
          return false;

        return Math.hypot(heartX - this.x, heartY - this.y) < radius;
    }
}