import { Pst_Primitive } from '../rnd/pst_primitive.js';

export class Pst_Heart
{
    constructor(x, y)
    {
        this.x = x;
        this.y = y;
        this.speed = 6;
        this.size = 0.7;
        this.pipeline = null;
        this.uniformBuffer = null;
        this.bindGroup = null;
        this.grid = 
        [
              [1, 1, 1, 1, 1],
              [1, 0, 0, 0, 1],
              [1, 0, 0, 0, 1],
              [1, 0, 0, 0, 1],
              [1, 1, 1, 1, 1],
        ];

    }

    init(device, layout, format)
    {
        const shader = device.createShaderModule({
            code: `struct U { model: mat4x4f, } @group(0) @binding(0) var<uniform> u: U;
                   @vertex fn vs(@location(0) p: vec3f) -> @builtin(position) vec4f { return u.model * vec4f(p, 1.0); }
                   @fragment fn fs() -> @location(0) vec4f { return vec4f(1.0, 0.0, 0.0, 1.0); }`
        });

        this.pipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
            vertex: {
                module: shader,
                entryPoint: 'vs',
                buffers: [{ arrayStride: 12, attributes: [{ format: 'float32x3', offset: 0, shaderLocation: 0 }] }],
            },
            fragment: { module: shader, entryPoint: 'fs', targets: [{ format }] },
            primitive: { topology: 'triangle-list' },
        });

        this.uniformBuffer = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.bindGroup = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }] });
    }

    move(dx, dy, dt, worldW, worldH, walls = [])
    {
        const nx = this.x + dx * this.speed * dt;
        const ny = this.y + dy * this.speed * dt;

        for (const w of walls)
        {
            if (nx + this.size > w.x && nx - this.size < w.x + w.w &&
                ny + this.size > w.y && ny - this.size < w.y + w.h)
            {
                return;
            }
        }

        if (nx - this.size > 0 && nx + this.size < worldW) this.x = nx;
        if (ny - this.size > 0 && ny + this.size < worldH) this.y = ny;
    }

    draw(device, pass, scaleX, scaleY)
    {
        const prim = Pst_Primitive.heart(this.size);

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
          pad.set(prim.indices); prim.indices = pad;
        }

        const vbo = device.createBuffer({ size: vbSize, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
        new Float32Array(vbo.getMappedRange()).set(prim.vertices); vbo.unmap();
        const ibo = device.createBuffer({ size: ibSize, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
        new Uint16Array(ibo.getMappedRange()).set(prim.indices); ibo.unmap();

        const model = new Float32Array(16);
        model.fill(0);
        model[0] = scaleX; model[5] = scaleY; model[10] = 1; model[15] = 1;
        model[12] = this.x * scaleX - 1;
        model[13] = this.y * scaleY - 1;
        device.queue.writeBuffer(this.uniformBuffer, 0, model);

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.setVertexBuffer(0, vbo);
        pass.setIndexBuffer(ibo, 'uint16');
        pass.drawIndexed(prim.indices.length);
    }
}

