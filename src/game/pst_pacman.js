import { Pst_Primitive } from '../rnd/pst_primitive.js';

export class Pst_Pacman
{
    constructor(maze, tileX, tileY)
    {
        this.maze = maze;
        this.tileX = tileX;
        this.tileY = tileY;
        this.dirX = 0;
        this.dirY = 0;
        this.nextDirX = 0;
        this.nextDirY = 0;
        this.speed = 3;
        this.progress = 0;
        this.mouthOpen = 0;
        this.mouthDir = 1;
        this.onEatCoin = null;
    }

    setDirection(dx, dy)
    {
        this.nextDirX = dx;
        this.nextDirY = dy;
    }

    update(dt)
    {
        this.mouthOpen += this.mouthDir * dt * 8;
        if (this.mouthOpen > 0.4) { this.mouthOpen = 0.4; this.mouthDir = -1; }
        if (this.mouthOpen < 0.0) { this.mouthOpen = 0.0; this.mouthDir = 1; }

        if (this.progress === 0)
        {
            if (this.nextDirX !== 0 || this.nextDirY !== 0)
            {
                const nx = this.tileX + this.nextDirX;
                const ny = this.tileY + this.nextDirY;
                if (!this.maze.isWall(nx, ny))
                {
                    this.dirX = this.nextDirX;
                    this.dirY = this.nextDirY;
                    this.nextDirX = 0;
                    this.nextDirY = 0;
                }
            }

            const nx = this.tileX + this.dirX;
            const ny = this.tileY + this.dirY;
            if (!this.maze.isWall(nx, ny) && (this.dirX !== 0 || this.dirY !== 0))
            {
                this.progress += dt * this.speed;
            }
        }
        else
        {
            this.progress += dt * this.speed * 0.4;
            if (this.progress > 0.7)
            {
                this.progress = 0;
                this.tileX += this.dirX;
                this.tileY += this.dirY;
                
                if (this.tileX < 0)
                   this.tileX = 0;
                if (this.tileX >= this.maze.width)
                   this.tileX = this.maze.width - 1;
                if (this.tileY < 0)
                   this.tileY = 0;
                if (this.tileY >= this.maze.height)
                   this.tileY = this.maze.height - 1;
                
                if (this.maze.eatCoin && this.maze.eatCoin(this.tileX, this.tileY))
                {
                    if (this.onEatCoin)
                      this.onEatCoin();
                }
            }
        }
    }

    getPosition()
    {
        return  {
            x: this.tileX + this.dirX * this.progress,
            y: this.tileY + this.dirY * this.progress
        };
    }

    getAngle()
    {
        if (this.dirX === 1) return 0;
        if (this.dirX === -1) return Math.PI;
        if (this.dirY === 1) return Math.PI / 2;
        if (this.dirY === -1) return -Math.PI / 2;
        return 0;
    }

    draw(device, pass, pipeline, bindGroup, uniformBuffer, scaleX, scaleY, worldW, worldH)
    {
        const pos = this.getPosition();
        const ts = this.maze.tileSize;
        const angle = this.getAngle();
        const prim = Pst_Primitive.circle(0.3, 32, this.mouthOpen, angle);
        
        let vbSize = prim.vertices.byteLength;
        if (vbSize % 4 !== 0)
        {
            vbSize += 4 - (vbSize % 4);
            const pad = new Float32Array(vbSize / 4);
            pad.set(prim.vertices);
            prim.vertices = pad;
        }

        let ibSize = prim.indices.byteLength;
        if (ibSize % 4 !== 0) {
            ibSize += 4 - (ibSize % 4);
            const pad = new Uint16Array(ibSize / 2);
            pad.set(prim.indices);
            prim.indices = pad;
        }

        const vbo = device.createBuffer({ size: vbSize, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
        new Float32Array(vbo.getMappedRange()).set(prim.vertices); vbo.unmap();
        const ibo = device.createBuffer({ size: ibSize, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
        new Uint16Array(ibo.getMappedRange()).set(prim.indices); ibo.unmap();
        
        const model = new Float32Array(16);
        model.fill(0);
        model[0] = scaleX;
        model[5] = scaleY;
        model[10] = 1;
        model[12] = pos.x * scaleX;
        model[13] = pos.y * scaleY;
        model[15] = 1;

        device.queue.writeBuffer(uniformBuffer, 0, model);

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, vbo);
        pass.setIndexBuffer(ibo, 'uint16');
        pass.drawIndexed(prim.indices.length);
    }
}