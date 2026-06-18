export class Pst_Sprite
{
    constructor()
    {
        this.texture = null;
        this.sampler = null;
        this.pipeline = null;
        this.bindGroup = null;
        this.uniformBuffer = null;
        this.frame = 0;
        this.frames = 0;
        this.frameTime = 0;
        this.frameSpeed = 0.1;
        this.frameWidth = 0;
        this.height = 0;
        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.vertexCount = 0;
        this.indexCount = 0;
    }

    async loadFromFile(device, layout, format, url)
    {
        const response = await fetch(url);
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'premultiply' });

        this.frameWidth = bitmap.width;
        this.height = bitmap.height;

        this.texture = device.createTexture(
        {
            size: [bitmap.width, bitmap.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        device.queue.copyExternalImageToTexture(
            { source: bitmap, flipY: true },
            { texture: this.texture },
            [bitmap.width, bitmap.height],
        );

        this.sampler = device.createSampler(
        {
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
        });

        const texLayout = device.createBindGroupLayout(
        {
            entries:
            [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
            ],
        });

        const shader = device.createShaderModule(
        {
            code: `
                struct Uniforms
                {
                    model: mat4x4f,
                    alpha: f32,
                }
                
                @group(0) @binding(0) var<uniform> u: Uniforms;
                @group(0) @binding(1) var t: texture_2d<f32>;
                @group(0) @binding(2) var s: sampler;

                struct VertexOutput {
                    @builtin(position) pos: vec4f,
                    @location(0) uv: vec2f,
                }

                @vertex
                fn vs(@location(0) p: vec3f, @location(1) uv: vec2f) -> VertexOutput
                {
                    var out: VertexOutput;
                    out.pos = u.model * vec4f(p, 1.0);
                    out.uv = uv;
                    return out;
                }

                @fragment
                fn fs(in: VertexOutput) -> @location(0) vec4f
                {
                    let color = textureSample(t, s, in.uv);
                    if (color.a < 0.5)
                    {
                        discard;
                    }
                    return vec4f(color.rgb, color.a * u.alpha);
                }
            `
        });

        this.pipeline = device.createRenderPipeline(
        {
            layout: device.createPipelineLayout({ bindGroupLayouts: [texLayout] }),
            vertex: {
                module: shader,
                entryPoint: 'vs',
                buffers:
                [{
                    arrayStride: 20,
                    attributes:
                    [
                        { format: 'float32x3', offset: 0, shaderLocation: 0 },
                        { format: 'float32x2', offset: 12, shaderLocation: 1 },
                    ],
                }],
            },
            fragment: { 
                module: shader, 
                entryPoint: 'fs', 
                targets: [{ format }] 
            },
            primitive: { topology: 'triangle-list' },
        });

        this.uniformBuffer = device.createBuffer({ 
            size: 80, 
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST 
        });
        
        this.bindGroup = device.createBindGroup({
            layout: texLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: this.texture.createView() },
                { binding: 2, resource: this.sampler },
            ],
        });
    }

    update(dt)
    {
        this.frameTime += dt;
        if (this.frameTime >= this.frameSpeed)
        {
            this.frameTime = 0;
            this.frame = (this.frame + 1) % this.frames;
        }
    }

    draw(device, pass, scaleX, scaleY, x, y, angle = 0, sizeX = 1, sizeY = 1, mouthOpen = 0)
    {
        if (!this.texture)
           return;

        const aspect = this.frameWidth / this.height;
        const hw = sizeX / 2;
        const hh = hw / aspect;

        const u0 = this.frame / this.frames;
        const u1 = (this.frame + 1) / this.frames;
        const splitY = 0.33;

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const jawOffset = mouthOpen * 0.3;

        const verts = new Float32Array(
        [
            -hw, -hh, 0, u0, 0,
             hw, -hh, 0, u1, 0,
             hw, -hh + hh * 2 * splitY, 0, u1, splitY,
            -hw, -hh + hh * 2 * splitY, 0, u0, splitY,
            
            -hw, -hh + hh * 2 * splitY, 0, u0, splitY,
             hw, -hh + hh * 2 * splitY, 0, u1, splitY,
             hw,  hh + jawOffset, 0, u1, 1,
            -hw,  hh + jawOffset, 0, u0, 1,
        ]);

        for (let i = 0; i < 8; i++)
        {
            const idx = i * 5;
            const vx = verts[idx], vy = verts[idx + 1];
            verts[idx] = vx * cos - vy * sin;
            verts[idx + 1] = vx * sin + vy * cos;
        }

        const inds = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);

        if (!this.vertexBuffer || this.vertexCount !== verts.length) {
            if (this.vertexBuffer)
              this.vertexBuffer.destroy();
            this.vertexBuffer = device.createBuffer(
            {
                size: verts.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            this.vertexCount = verts.length;
        }

        if (!this.indexBuffer || this.indexCount !== inds.length)
        {    
            if (this.indexBuffer)
               this.indexBuffer.destroy();
            this.indexBuffer = device.createBuffer(
            {
                size: inds.byteLength,
                usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            });
            this.indexCount = inds.length;
        }

        device.queue.writeBuffer(this.vertexBuffer, 0, verts);
        device.queue.writeBuffer(this.indexBuffer, 0, inds);

        const model = new Float32Array(16);
        model.fill(0);
        model[0] = scaleX;
        model[5] = scaleY;
        model[10] = 1;
        model[12] = x * scaleX - 1.0;
        model[13] = y * scaleY - 1.0;
        model[15] = 1;

        device.queue.writeBuffer(this.uniformBuffer, 0, model.buffer);
        
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.setIndexBuffer(this.indexBuffer, 'uint16');
        pass.drawIndexed(inds.length);
    }

    destroy()
    {
        if (this.vertexBuffer)
            this.vertexBuffer.destroy();
        if (this.indexBuffer)
            this.indexBuffer.destroy();
        if (this.uniformBuffer)
            this.uniformBuffer.destroy();
        if (this.texture)
            this.texture.destroy();
    }
}