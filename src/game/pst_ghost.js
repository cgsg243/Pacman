import { Pst_Primitive } from '../rnd/pst_primitive.js';

export class Pst_Ghost
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
        this.speed = 2;
        this.progress = 0;
        this.path = null;
        this.pathTimer = 0;
        this.ibo = null;
        this.vbo = null;
    }

    setDirection(dx, dy)
    {
        this.nextDirX = dx;
        this.nextDirY = dy;
    }

    update(dt, targetX, targetY)
    {
        this.pathTimer += dt;

        if (this.pathTimer > 0.0)
        {
          this.path = this.BFS(this.tileX, this.tileY, targetX, targetY);
          this.pathTimer = 0;
        }

        if (this.tileX === targetX && this.tileY === targetY)
        {
            return true;
        }

        if (this.progress === 0)
        {
            if (this.path && this.path.length > 0)
            {
                const next = this.path[0];
                this.nextDirX = next.x - this.tileX;
                this.nextDirY = next.y - this.tileY;
                this.path.shift();
            }

            if (this.nextDirX !== 0 || this.nextDirY !== 0)
            {
                const nx = this.tileX + this.nextDirX;
                const ny = this.tileY + this.nextDirY;
                if (!this.maze.isWall(nx, ny))
                {
                    this.dirX = this.nextDirX;
                    this.dirY = this.nextDirY;
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
            this.progress += dt * this.speed;
            
            if (this.progress >= 1)
            {
                this.progress = 0;
                this.tileX += this.dirX;
                this.tileY += this.dirY;
            }
        }

        return false;
    }

    BFS(sx, sy, gx, gy)
    {
        const h = this.maze.height;
        const w = this.maze.width;
        const dist = [];

        for (let y = 0; y < h; y++)
        {
            dist[y] = new Array(w).fill(-1);
        }
        dist[sy][sx] = 0;

        const queue = [{x: sx, y: sy}];

        while (queue.length > 0)
        {
            const {x, y} = queue.shift();
            if (x === gx && y === gy) break;

            for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]])
            {
                const nx = x + dx;
                const ny = y + dy;

                if (nx >= 0 && nx < w && ny >= 0 && ny < h &&
                    this.maze.grid[ny][nx] !== 1 && dist[ny][nx] === -1)
                {
                    dist[ny][nx] = dist[y][x] + 1;
                    queue.push({x: nx, y: ny});
                }
            }
        }

        if (dist[gy][gx] === -1)
          return null;

        const path = [];
        let x = gx, y = gy;

        while (x !== sx || y !== sy)
        {
            path.push({x, y});
            for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]])
            {
                const nx = x + dx, ny = y + dy;

                if (nx >= 0 && nx < w && ny >= 0 && ny < h && dist[ny][nx] === dist[y][x] - 1)
                {
                    x = nx;
                    y = ny;
                    break;
                }
            }
        }
        path.reverse();
        return path;
    }

    getPosition()
    {
        const ts = this.maze.tileSize;

        return {
            x: (this.tileX + this.dirX * this.progress + 0.5) * ts,
            y: (this.tileY + this.dirY * this.progress + 0.5) * ts,
        };
    }

    getAngle()
    {
        if (this.dirX === 1)
           return 0;
        if (this.dirX === -1) return Math.PI;
        if (this.dirY === 1) return Math.PI / 2;
        if (this.dirY === -1) return -Math.PI / 2;
        return 0;
    }

    draw(device, pass, pipeline, bindGroup, uniformBuffer, scaleX, scaleY, worldW, worldH)
    {
        const pos = this.getPosition();
        const angle = this.getAngle();
        const prim = Pst_Primitive.ghost(0.4, 25, performance.now() / 100);

        let vbSize = prim.vertices.byteLength;
        if (vbSize % 4 !== 0)
        {
            vbSize += 4 - (vbSize % 4);
            const pad = new Float32Array(vbSize / 4);
            pad.set(prim.vertices);
            prim.vertices = pad;
        }

        let ibSize = prim.indices.byteLength;
        if (ibSize % 4 !== 0)
        {
            ibSize += 4 - (ibSize % 4);
            const pad = new Uint16Array(ibSize / 2);
            pad.set(prim.indices);
            prim.indices = pad;
        }

        this.vbo = device.createBuffer({
            size: vbSize,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        });
        new Float32Array(vbo.getMappedRange()).set(prim.vertices);
        vbo.unmap();

        this.ibo = device.createBuffer({
            size: ibSize,
            usage: GPUBufferUsage.INDEX,
            mappedAtCreation: true,
        });
        new Uint16Array(ibo.getMappedRange()).set(prim.indices);
        ibo.unmap();

        const model = new Float32Array(16);
        model.fill(0);
        model[0] = scaleX;
        model[5] = scaleY;
        model[10] = 1;
        model[12] = pos.x * scaleX - 1;
        model[13] = pos.y * scaleY - 1;
        model[15] = 1;

        device.queue.writeBuffer(uniformBuffer, 0, model);
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, vbo);
        pass.setIndexBuffer(ibo, 'uint16');
        pass.drawIndexed(prim.indices.length);
    }
    free()
    {
      this.ibo.destroy();
      this.vbo.destroy();

    }
}