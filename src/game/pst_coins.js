import { Pst_Primitive } from '../rnd/pst_primitive.js';

export class Pst_Coin
{
    constructor(tileX, tileY, device, layout)
    {
        this.tileX = tileX;
        this.tileY = tileY;
        this.device = device;
        this.vbo = null;
        this.ibo = null;
        this.indexCount = 0;
        
        this.uniformBuffer = device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        
        this.bindGroup = device.createBindGroup({
            layout: layout,
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
        });
    }

    getPosition()
    {
        return {
            x: this.tileX + 0.5,
            y: this.tileY + 0.5,
        };
    }

    initGeometry()
    {
        if (this.vbo)
          return;

        const prim = Pst_Primitive.coin(0.1, 12, 0);

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

        this.vbo = this.device.createBuffer({ size: vbSize, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
        new Float32Array(this.vbo.getMappedRange()).set(prim.vertices); this.vbo.unmap();
        this.ibo = this.device.createBuffer({ size: ibSize, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
        new Uint16Array(this.ibo.getMappedRange()).set(prim.indices); this.ibo.unmap();
        this.indexCount = prim.indices.length;
    }

    updateMatrix(scaleX, scaleY) {
        const pos = this.getPosition();
        const model = new Float32Array(16);
        model.fill(0);
        model[0] = scaleX;
        model[5] = scaleY;
        model[10] = 1;
        model[15] = 1;
        model[12] = pos.x * scaleX - 1;
        model[13] = pos.y * scaleY - 1;
        this.device.queue.writeBuffer(this.uniformBuffer, 0, model);
    }

    draw(device, pass, pipeline)
    {
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.setVertexBuffer(0, this.vbo);
        pass.setIndexBuffer(this.ibo, 'uint16');
        pass.drawIndexed(this.indexCount);
    }
}