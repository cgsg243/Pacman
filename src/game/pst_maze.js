export class Pst_Maze
{
    constructor()
    {
        this.tileSize = 1;
        this.grid =
        [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
            [1,2,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,2,2,1],
            [1,2,1,0,1,2,1,0,0,0,1,2,1,0,2,0,0,2,1,0,0,0,1,2,1,0,1,2,2,1],
            [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
            [1,2,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,2,2,1],
            [1,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
            [1,1,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1],
            [1,0,0,0,1,2,1,0,0,0,0,0,0,1,2,1,0,0,0,1,2,1,0,0,0,1,2,1,0,1],
            [1,1,1,0,1,2,1,1,1,1,1,1,0,1,2,1,0,1,1,1,2,1,1,1,0,1,2,1,0,1],
            [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
            [1,2,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,2,2,1],
            [1,2,2,2,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
            [1,1,1,2,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1],
            [1,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
            [1,2,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,2,1],
            [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
            [1,2,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,2,2,1],
            [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ];
        this.width = this.grid[0].length;
        this.height = this.grid.length;
        this.mesh = null;
    }

    isWall(x, y)
    {
        if (y < 0 || y >= this.grid.length)
          return true;
        if (x < 0 || x >= this.grid[0].length)
          return true;
        return this.grid[y][x] === 1;
    }

    setMesh(mesh) { this.mesh = mesh; }

    isCoin(x, y)
    {
        if (y < 0 || y >= this.grid.length)
          return false;
        if (x < 0 || x >= this.grid[0].length)
          return false;
        return this.grid[y][x] === 2;
    }

    eatCoin(x, y)
    {
        if (y >= 0 && y < this.grid.length && x >= 0 && x < this.grid[0].length)
        {
            if (this.grid[y][x] === 2)
            {
                this.grid[y][x] = 0;
                return true;
            }
        }
        return false;
    }

    getCenter(tx, ty)
    {
        return {
            x: tx * this.tileSize + this.tileSize / 2,
            y: ty * this.tileSize + this.tileSize / 2,
        };
    }

    isOut(x, y)
    {
       return x < 0 || x >= this.width || y < 0 || y >= this.height;
    }

    getCountMoney()
    {
        let g = 0;

        for (let y = 0; y < this.height; y++)
        {
            for (let x = 0; x < this.width; x++)
            {
                if (this.grid[y][x] === 2)
                  g++;
            }
        }
        return g;
    }

    draw(device, pass, pipeline, bindGroup, uniformBuffer, scaleX, scaleY)
    {
        const model = new Float32Array(16);
        model.fill(0);
        
        model[0] = scaleX;
        model[5] = scaleY; 
        model[10] = 1;
        model[12] = -1.0; 
        model[13] = -1.0;  
        model[15] = 1;

        device.queue.writeBuffer(uniformBuffer, 0, model);

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, this.mesh.vbo);
        pass.setIndexBuffer(this.mesh.ibo, 'uint16');
        pass.drawIndexed(this.mesh.indexCount);
    }

    free()
    {
        if (this.mesh)
        {
            this.mesh.ibo.destroy();
            this.mesh.vbo.destroy();
        }
    }
}