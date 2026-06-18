import { Pst_Primitive } from '../rnd/pst_primitive.js';

export class Pst_Laser
{
    constructor()
    {
        this.active = false;
        this.timer = 0;      
        this.chargeTimer = 0;
        this.state = 'idle'; 
        this.x1 = 0;
        this.y1 = 0;
        this.x2 = 20;
        this.y2 = 20;
        this.angle = 0;
        this.length = 30;
        this.thickness = 0.3;
    }

    update(dt, bossX, bossY, bossAngle)
    {
        this.x1 = bossX;
        this.y1 = bossY;
        
        this.angle = bossAngle;

        this.timer -= dt;

        if (this.state === 'idle' && this.timer <= 0)
        {
            this.state = 'charging';
            this.chargeTimer = 0.5;
        }

        if (this.state === 'charging')
        {
            this.chargeTimer -= dt;
            if (this.chargeTimer <= 0)
            {
                this.state = 'firing';
                this.timer = 1.0;
            }
        }

        if (this.state === 'firing')
        {
            this.timer -= dt;
            if (this.timer <= 0)
            {
                this.state = 'idle';
                this.timer = 2.0;
            }
        }

        this.x2 = bossX + Math.cos(bossAngle) * this.length;
        this.y2 = bossY + Math.sin(bossAngle) * this.length;
        this.active = (this.state === 'charging' || this.state === 'firing');
    }

    draw(device, pass, pipeline, bindGroup, uniformBuffer, scaleX, scaleY)
    {
        if (!this.active)
          return;

        const t = this.state === 'charging' ? this.thickness * 0.5 : this.thickness;
        const nx = -Math.sin(this.angle) * t;
        const ny = Math.cos(this.angle) * t;

        const verts = new Float32Array(
            [
            this.x1 + nx, this.y1 + ny, 0, 0, 0,
            this.x1 - nx, this.y1 - ny, 0, 0, 1,
            this.x2 - nx, this.y2 - ny, 0, 1, 1,
            this.x2 + nx, this.y2 + ny, 0, 1, 0,
        ]);
        const inds = new Uint16Array([0, 1, 2, 0, 2, 3]);

        let vs = verts.byteLength; if (vs % 4) vs += 4 - vs % 4;
        let is = inds.byteLength; if (is % 4) is += 4 - is % 4;

        const vbo = device.createBuffer({ size: vs, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
        new Float32Array(vbo.getMappedRange()).set(verts); vbo.unmap();
        const ibo = device.createBuffer({ size: is, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
        new Uint16Array(ibo.getMappedRange()).set(inds); ibo.unmap();

        const model = new Float32Array(16);
        model.fill(0);
        model[0] = scaleX; model[5] = scaleY; model[10] = 1; model[15] = 1;
        model[12] = -1; model[13] = -1;

        device.queue.writeBuffer(uniformBuffer, 0, model);
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, vbo);
        pass.setIndexBuffer(ibo, 'uint16');
        pass.drawIndexed(6);
    }

    checkCollision(px, py)
    {
        if (this.state !== 'firing')
           return false;

        const dx = this.x2 - this.x1;
        const dy = this.y2 - this.y1;
        const len2 = dx * dx + dy * dy;

        if (len2 === 0)
          return false;

        let t = ((px - this.x1) * dx + (py - this.y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));

        const cx = this.x1 + t * dx;
        const cy = this.y1 + t * dy;
        const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);

        return dist < this.thickness + 0.2;
    }
    }
