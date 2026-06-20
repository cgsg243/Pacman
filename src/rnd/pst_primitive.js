export class Pst_Primitive
{
    static circle(radius, segments = 32, mouthOpen = 0, angle = 0)
    {
        const verts = [];
        const inds = [];

        verts.push(0, 0, 0);
        const center = 0;

        const mouthHalf = mouthOpen * Math.PI;

        for (let i = 0; i < segments; i++)
        {
            let a = (i / segments) * Math.PI * 2;
            let da = a - angle;

            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;

            if (mouthOpen > 0.01 && Math.abs(da) < mouthHalf)
            {
                continue;
            }

            const x = Math.cos(a) * radius;
            const y = Math.sin(a) * radius;
            verts.push(x, y, 0);
        }

        const count = verts.length / 3 - 1;

        if (count < 2)
        {
            verts.length = 3;
            for (let i = 0; i < segments; i++)
            {
                const a = (i / segments) * Math.PI * 2;
                verts.push(Math.cos(a) * radius, Math.sin(a) * radius, 0);
            }
            for (let i = 1; i < segments; i++)
            {
                inds.push(center, i, i + 1);
            }
            inds.push(center, segments, 1);
        }
        else
        {
            for (let i = 1; i < count; i++)
            {
                inds.push(center, i, i + 1);
            }
            inds.push(center, count, 1);
        }

        return { vertices: new Float32Array(verts), indices: new Uint16Array(inds) };
    }

    static ghost(radius, segments = 32, time = 0)
    {
        const verts = [];
        const inds = [];
        const waveHeight = radius * 0.25;

        verts.push(0, 0, 0);

        for (let i = 0; i < segments; i++)
        {
            let a = (i / segments) * Math.PI * 2;
            let x = Math.cos(a) * radius;
            let y = Math.sin(a) * radius;

            if (a > Math.PI && a < Math.PI * 2)
            {
                const t = (a - Math.PI) / Math.PI;
                y -= waveHeight * 0.1;
                y += Math.sin(t * Math.PI * 4 + time  * 2) * waveHeight * (t);
            }

            verts.push(x, y, 0);
        }

        const count = verts.length / 3 - 1;

        for (let i = 1; i < count; i++)
        {
            inds.push(0, i, i + 1);
        }
        inds.push(0, count, 1);

        return { vertices: new Float32Array(verts), indices: new Uint16Array(inds) };
    }
    static coin(radius, segments = 16, time = 0)
    {
        const verts = [];
        const inds = [];

        verts.push(0, 0, 0);

        const sx = Math.abs(Math.cos(time));

        for (let i = 0; i < segments; i++)
        {
            const a = (i / segments) * Math.PI * 2;
            const x = Math.cos(a) * radius * sx;
            const y = Math.sin(a) * radius;
            verts.push(x, y, 0);
        }

        const count = verts.length / 3 - 1;

        for (let i = 1; i < count; i++)
        {
            inds.push(0, i, i + 1);
        }
        inds.push(0, count, 1);

        return { vertices: new Float32Array(verts), indices: new Uint16Array(inds) };
    }

    static skull(radius, eyeRadius, mouthOpen = 0)
    {
        const verts = [];
        const inds = [];

        verts.push(0, 0, 0);
        const center = 0;

        for (let i = 0; i < 32; i++)
        {
            const a = (i / 32) * Math.PI * 2;
            const x = Math.cos(a) * radius;
            const y = Math.sin(a) * radius;
            verts.push(x, y, 0);
        }

        for (let i = 1; i < 32; i++)
        {
            inds.push(center, i, i + 1);
        }
        inds.push(center, 32, 1);

        const jawBase = verts.length / 3;
        const jawOffset = -radius * 0.4 - mouthOpen * radius * 0.3;
        verts.push(0, jawOffset, 0);

        for (let i = 0; i < 16; i++)
        {
            const a = Math.PI + (i / 15) * Math.PI;
            const x = Math.cos(a) * radius * 0.8;
            const y = Math.sin(a) * radius * 0.6 + jawOffset;
            verts.push(x, y, 0);
        }

        for (let i = jawBase + 1; i < jawBase + 16; i++)
        {
            inds.push(jawBase, i, i + 1);
        }
        inds.push(jawBase, jawBase + 16, jawBase + 1);

        const eyeVerts = [];
        const eyeInds = [];

        for (const [ex, ey] of [[-radius * 0.3, radius * 0.2], [radius * 0.3, radius * 0.2]])
        {
            const eyeBase = eyeVerts.length / 3;
            eyeVerts.push(ex, ey, 0);
            for (let i = 0; i < 8; i++)
            {
                const a = (i / 8) * Math.PI * 2;
                eyeVerts.push(ex + Math.cos(a) * eyeRadius, ey + Math.sin(a) * eyeRadius, 0);
            }
            for (let i = 1; i < 8; i++)
            {
                eyeInds.push(eyeBase, eyeBase + i, eyeBase + i + 1);
            }
            eyeInds.push(eyeBase, eyeBase + 8, eyeBase + 1);
        }

        return {
            headVertices: new Float32Array(verts),
            headIndices: new Uint16Array(inds),
            eyeVertices: new Float32Array(eyeVerts),
            eyeIndices: new Uint16Array(eyeInds),
        };
    }
    static circleUV(radius, segments = 16)
    {
        const verts = [];
        const inds = [];
        
        verts.push(0, 0, 0, 0.5, 0.5);

        for (let i = 0; i < segments; i++)
        {
            const a = (i / segments) * Math.PI * 2;
            const x = Math.cos(a) * radius;
            const y = Math.sin(a) * radius;
            const u = Math.cos(a) * 0.5 + 0.5;
            const v = Math.sin(a) * 0.5 + 0.5;
            verts.push(x, y, 0, u, v);
        }

        for (let i = 1; i < segments; i++)
        {
            inds.push(0, i, i + 1);
        }
        inds.push(0, segments, 1);

        return { vertices: new Float32Array(verts), indices: new Uint16Array(inds) };
    }
    static heart(size)
    {
       const verts = [];
        const inds = [];
        verts.push(0, 0, 0);

        const steps = 64;
        for (let i = 0; i < steps; i++)
        {
            const t = (i / steps) * Math.PI * 2;
            const x = 16 * Math.pow(Math.sin(t), 3) * size * 0.02;
            const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * size * 0.02;

            verts.push(x, y, 0);
        }

        for (let i = 1; i < steps; i++)
           inds.push(0, i, i + 1);
        inds.push(0, steps, 1);

        return { vertices: new Float32Array(verts), indices: new Uint16Array(inds) };
    }
}