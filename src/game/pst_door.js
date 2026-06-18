export class Pst_Door
{
    constructor(device, tileX, tileY)
    {
        this.tileX = tileX;
        this.tileY = tileY;
        this.visible = false;
        this.vbo = null;
        this.ibo = null;
        this.indexCount = 0;
        this.pipeline = null;
        this.bindGroup = null;
        this.uniformBuffer = null;
        this.device = device;
    }

    init(device, layout, format)
    {
        const shader = device.createShaderModule({
            code: `struct U { model: mat4x4f, } @group(0) @binding(0) var<uniform> u: U;
                   @vertex fn vs(@location(0) p: vec3f) -> @builtin(position) vec4f { return u.model * vec4f(p, 1.0); }
                   @fragment fn fs() -> @location(0) vec4f { return vec4f(1.0, 0.9, 0.0, 1.0); }`
        });

        this.pipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
            vertex: {
                module: shader,
                entryPoint: 'vs',
                buffers: [{
                    arrayStride: 12,
                    attributes: [{ format: 'float32x3', offset: 0, shaderLocation: 0 }],
                }],
            },
            fragment: {
                module: shader,
                entryPoint: 'fs',
                targets: [{ format }],
            },
            primitive: { topology: 'triangle-list' },
        });

        this.uniformBuffer = device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.bindGroup = device.createBindGroup({
            layout,
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
        });
    }

    show()
    {
        this.visible = true;
    }

    hide()
    {
        this.visible = false;
    }

    getPosition()
    {
        return { x: this.tileX + 0.5, y: this.tileY + 0.5 };
    }

    updateGeometry(device, time)
    {
        if (this.vbo) this.vbo.destroy();
        if (this.ibo) this.ibo.destroy();

        const pulse = 1 + Math.sin(time * 3) * 0.2;
        const half = 0.4 * pulse;

        const verts = new Float32Array([
            -half, -half, 0,
             half, -half, 0,
             half,  half, 0,
            -half,  half, 0,
        ]);

        const inds = new Uint16Array([0, 1, 2, 0, 2, 3]);

        let vs = verts.byteLength;
        if (vs % 4)
           vs += 4 - vs % 4;

        let is = inds.byteLength;
        if (is % 4)
          is += 4 - is % 4;

        this.vbo = device.createBuffer({
            size: vs,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        });
        new Float32Array(this.vbo.getMappedRange()).set(verts);
        this.vbo.unmap();

        this.ibo = device.createBuffer({
            size: is,
            usage: GPUBufferUsage.INDEX,
            mappedAtCreation: true,
        });
        new Uint16Array(this.ibo.getMappedRange()).set(inds);
        this.ibo.unmap();
        this.indexCount = inds.length;
    }

    draw(device, pass, scaleX, scaleY, time)
    {
        if (!this.visible)
          return;

        this.updateGeometry(device, time);

        const pos = this.getPosition();
        const model = new Float32Array(16);

        model.fill(0);
        model[0] = scaleX;
        model[5] = scaleY;
        model[10] = 1;
        model[12] = pos.x * scaleX - 1;
        model[13] = pos.y * scaleY - 1;
        model[15] = 1;

        device.queue.writeBuffer(this.uniformBuffer, 0, model);
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.setVertexBuffer(0, this.vbo);
        pass.setIndexBuffer(this.ibo, 'uint16');
        pass.drawIndexed(this.indexCount);
    }
    free()
    {
       this.ibo.destroy();
       this.vbo.destroy();
    }
}
