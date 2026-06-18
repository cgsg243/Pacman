import { Pst_Primitive } from '../rnd/pst_primitive.js';

export class Pst_Boss
{
   constructor(x, y)
   {
       this.x = x;
       this.y = y;
       this.angle = 0;
       this.radius = 1.5;
       this.turnSpeed = 3;
       this.hp = 3;
   }

    update(targetX, targetY, dt)
    {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const targetAngle = Math.atan2(dy, dx);
        let diff = targetAngle - this.angle;

        while (diff > Math.PI)
           diff -= Math.PI * 2;
        while (diff < -Math.PI)
           diff += Math.PI * 2;

        this.angle += diff * this.turnSpeed * dt;
    }

    draw(device, pass, pipeline, bindGroup, uniformBuffer, scaleX, scaleY)
    {
        const prim = Pst_Primitive.circle(this.radius, 48);

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

        const vbo = device.createBuffer({
            size: vbSize,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        });
        new Float32Array(vbo.getMappedRange()).set(prim.vertices);
        vbo.unmap();

        const ibo = device.createBuffer({
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
        model[12] = this.x * scaleX - 1;
        model[13] = this.y * scaleY - 1;
        model[15] = 1;

        device.queue.writeBuffer(uniformBuffer, 0, model);
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, vbo);
        pass.setIndexBuffer(ibo, 'uint16');
        pass.drawIndexed(prim.indices.length);
    }
}
