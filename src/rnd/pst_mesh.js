import { Pst_Primitive } from './pst_primitive.js';
export class Pst_Mesh
{
    constructor(device, vertices, indices)
    {
        this.indexCount = indices.length;

        this.vbo = device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        });
        new Float32Array(this.vbo.getMappedRange()).set(vertices);
        this.vbo.unmap();

        this.ibo = device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX,
            mappedAtCreation: true,
        });
        new Uint16Array(this.ibo.getMappedRange()).set(indices);
        this.ibo.unmap();
    }

    static createMaze(device, maze)
    {
        const verts = [];
        const inds = [];
        const ts = maze.tileSize;
        const h = ts / 2;

        for (let y = 0; y < maze.height; y++)
        {
            for (let x = 0; x < maze.width; x++)
            {
                if (maze.grid[y][x] === 1)
                {
                    const cx = x * ts + h;
                    const cy = y * ts + h;
                    const base = verts.length / 3;

                    verts.push(
                        cx - h, cy - h, 0,
                        cx + h, cy - h, 0,
                        cx + h, cy + h, 0,
                        cx - h, cy + h, 0,
                    );

                    inds.push(
                        base, base + 1, base + 2,
                        base, base + 2, base + 3,
                    );
                }
            }
        }

        return new Pst_Mesh(device, new Float32Array(verts), new Uint16Array(inds));
    }
    static createCircle(device, radius, segments = 32)
    {
       const prim = Pst_Primitive.circle(radius, segments, 0, 0);
       return new Pst_Mesh(device, prim.vertices, prim.indices);
    }
}