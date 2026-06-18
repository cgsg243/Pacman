import { Pst_Primitive } from '../rnd/pst_primitive.js';

export class Pst_Scull
{
    constructor(x, y, angle)
    {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.alive = true;
        this.mouthOpen = 0;
        this.mouthDir = 1;
        this.speed = 1.0;
        this.lifeTime = 0.0;
    }
    update(dt)
    {
        this.lifeTime += dt;
        if (this.lifeTime > 1.0)
           this.alive = false;

        this.x += Math.cos(this.angle) * this.speed * dt * 3;
        this.y += Math.sin(this.angle) * this.speed * dt * 3;
        this.mouthOpen += this.mouthDir * dt * 4;
        if (this.mouthOpen > 0.5)
           this.mouthDir = -1;
        if (this.mouthOpen < 0)
           this.mouthDir = 1;

    }
    getPos()
    { 
       return {
         x: this.x,
         y: this.y,
       }
    }
    init(device, layout, format)
    {
        const headShader = device.createShaderModule({
            code: `struct U { model: mat4x4f, } @group(0) @binding(0) var<uniform> u: U;
                @vertex fn vs(@location(0) p: vec3f) -> @builtin(position) vec4f { return u.model * vec4f(p, 1.0); }
                @fragment fn fs() -> @location(0) vec4f { return vec4f(0.7, 0.7, 0.7, 1.0); }`
        });

        this.headPipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
            vertex: {
                module: headShader,
                entryPoint: 'vs',
                buffers: [{ arrayStride: 12, attributes: [{ format: 'float32x3', offset: 0, shaderLocation: 0 }] }],
            },
            fragment: { module: headShader, entryPoint: 'fs', targets: [{ format }] },
            primitive: { topology: 'triangle-list' },
        });

        const eyeShader = device.createShaderModule({
            code: `struct U { model: mat4x4f, } @group(0) @binding(0) var<uniform> u: U;
                @vertex fn vs(@location(0) p: vec3f) -> @builtin(position) vec4f { return u.model * vec4f(p, 1.0); }
                @fragment fn fs() -> @location(0) vec4f { return vec4f(1.0, 0.0, 0.0, 1.0); }`
        });

        this.eyePipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
            vertex: {
                module: eyeShader,
                entryPoint: 'vs',
                buffers: [{ arrayStride: 12, attributes: [{ format: 'float32x3', offset: 0, shaderLocation: 0 }] }],
            },
            fragment: { module: eyeShader, entryPoint: 'fs', targets: [{ format }] },
            primitive: { topology: 'triangle-list' },
        });

        this.uniformBuffer = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.bindGroup = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }] });
    }
    draw(device, pass, headPipeline, eyePipeline, bindGroup, uniformBuffer, scaleX, scaleY)
    {
        if (!this.alive) return;

        const pos = this.getPos();
        const geom = Pst_Primitive.skull(0.3, 0.08, this.mouthOpen);

        const model = new Float32Array(16);
        model.fill(0);
        model[0] = scaleX; model[5] = scaleY; model[10] = 1; model[15] = 1;
        model[12] = pos.x * scaleX - 1;
        model[13] = pos.y * scaleY - 1;
        device.queue.writeBuffer(uniformBuffer, 0, model);

        
        const vboH = device.createBuffer({ size: geom.headVertices.byteLength, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
        new Float32Array(vboH.getMappedRange()).set(geom.headVertices); vboH.unmap();
        const iboH = device.createBuffer({ size: geom.headIndices.byteLength, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
        new Uint16Array(iboH.getMappedRange()).set(geom.headIndices); iboH.unmap();

        pass.setPipeline(headPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, vboH);
        pass.setIndexBuffer(iboH, 'uint16');
        pass.drawIndexed(geom.headIndices.length);

        
        const vboE = device.createBuffer({ size: geom.eyeVertices.byteLength, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
        new Float32Array(vboE.getMappedRange()).set(geom.eyeVertices); vboE.unmap();
        const iboE = device.createBuffer({ size: geom.eyeIndices.byteLength, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
        new Uint16Array(iboE.getMappedRange()).set(geom.eyeIndices); iboE.unmap();

        pass.setPipeline(eyePipeline);
        pass.setVertexBuffer(0, vboE);
        pass.setIndexBuffer(iboE, 'uint16');
        pass.drawIndexed(geom.eyeIndices.length);
    }
}
