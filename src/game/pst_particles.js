export class Pst_Particles
{
    constructor(device, count = 40)
    {
        this.device = device;
        this.count = count;
        this.particles = [];
        this.pipeline = null;
        this.bindGroup = null;
        this.uniformBuffer = null;
        this.vbo = null;
        this.ibo = null;

        for (let i = 0; i < count; i++)
        {
            this.particles.push(this._spawn(0, 0));
        }
    }

    _spawn(cx, cy)
    {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        return {
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed + Math.random() * 2,
            life: 0.5 + Math.random() * 1.5,
            maxLife: 2.0,
            size: 0.03 + Math.random() * 0.08,
            r: 1.0,
            g: 0.7 + Math.random() * 0.3,
            b: 0.0,
        };
    }

    init(device, layout, format)
    {
        this.device = device;

        const shader = device.createShaderModule({
            code: `struct U { model: mat4x4f, } @group(0) @binding(0) var<uniform> u: U;
                @vertex fn vs(@location(0) p: vec3f) -> @builtin(position) vec4f { return u.model * vec4f(p, 1.0); }
                @fragment fn fs() -> @location(0) vec4f { return vec4f(1.0, 0.8, 0.0, 0.8); }`
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

        const verts = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
        const inds = new Uint16Array([0,1,2,0,2,3]);
        this.vbo = device.createBuffer({ size: verts.byteLength, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
        new Float32Array(this.vbo.getMappedRange()).set(verts); this.vbo.unmap();
        this.ibo = device.createBuffer({ size: inds.byteLength, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
        new Uint16Array(this.ibo.getMappedRange()).set(inds); this.ibo.unmap();
        this.indexCount = 6;
    }
    update(dt, cx, cy)
    {
        for (const p of this.particles)
        {
            p.life -= dt;
            if (p.life <= 0)
            {
                Object.assign(p, this._spawn(cx, cy));
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy -= 1.0 * dt; // гравитация
            p.size *= 0.995;   // затухание
        }
    }

    draw(device, pass, scaleX, scaleY)
    {
        const model = new Float32Array(16);

        for (const p of this.particles)
        {
            if (p.life <= 0) continue;

            const s = p.size * (p.life / p.maxLife);

            model.fill(0);
            model[0] = scaleX * s;
            model[5] = scaleY * s;
            model[10] = 1; model[15] = 1;
            model[12] = p.x * scaleX - 1;
            model[13] = p.y * scaleY - 1;

            device.queue.writeBuffer(this.uniformBuffer, 0, model);
            pass.setPipeline(this.pipeline);
            pass.setBindGroup(0, this.bindGroup);
            pass.setVertexBuffer(0, this.vbo);
            pass.setIndexBuffer(this.ibo, 'uint16');
            pass.drawIndexed(this.indexCount);
        }
    }
}