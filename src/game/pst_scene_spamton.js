import { Pst_Keyboard } from '../utils/input/keyboard/pst_keyboard.js';
import { Pst_Heart }    from './pst_heart.js';
import { Pst_Sprite }   from './pst_sprite.js';
import { Pst_MiniSpamton } from './pst_mini_spamton.js';

export class Pst_SceneSpamton
{
    constructor()
    {
        this.device = null;
        this.context = null;
        this.format = null;
        this.kb = null;
    }

    async init()
    {
        const canvas = document.getElementById('spamton');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter.requestDevice();
        const context = canvas.getContext('webgpu');
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format });

        this.device = device;
        this.context = context;
        this.format = format;

        this.kb = new Pst_Keyboard();
        this.kb.init();

        const layoutSimple = device.createBindGroupLayout(
        {
            entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} }],
        });

        this.heart = new Pst_Heart(10, 15);
        this.heart.init(device, layoutSimple, format);

        this.spamton = new Pst_Sprite();
        await this.spamton.loadFromFile(device, null, format, '/spamton3.png');
        this.spamton.frames = 1;
        this.spamton.frameSpeed = 1;
        this.spamtonX = 16;
        this.spamtonY = 6;

        this.headSprite = new Pst_Sprite();
        await this.headSprite.loadFromFile(device, null, format, '/spamton_head.png');
        this.headSprite.frames = 1;

        this.minis = [];
        this.miniTimer = 0;
        this.deathTimer = 0;
        this.gameOver = false;
        this.victory = false;
        this.worldW = 20;
        this.worldH = 18;
        this.lastTime = performance.now();
    }

    loop()
    {
        const now = performance.now();
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        if (this.gameOver)
        {
            this.deathTimer += dt;
            this.heart.broken = true;

            const device = this.device;
            const context = this.context;
            const encoder = device.createCommandEncoder();
            const pass = encoder.beginRenderPass(
            {
                colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store',
                }],
            });

            const scaleX = 2 / this.worldW;
            const scaleY = 2 / this.worldH;

            this.heart.draw(device, pass, scaleX, scaleY);
            this.spamton.draw(device, pass, scaleX, scaleY, this.spamtonX, this.spamtonY, 0, 0.05, 0.05, 0);

            if (this.deathTimer > 2.0)
            {
                const fadeVerts = new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]);
                const fadeInds = new Uint16Array([0,1,2,0,2,3]);
                const vbo = device.createBuffer({ size: fadeVerts.byteLength, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
                new Float32Array(vbo.getMappedRange()).set(fadeVerts); vbo.unmap();
                const ibo = device.createBuffer({ size: fadeInds.byteLength, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
                new Uint16Array(ibo.getMappedRange()).set(fadeInds); ibo.unmap();

                const model = new Float32Array(20);
                model.fill(0);
                model[0] = 1;
                model[5] = 1;
                model[10] = 1;
                model[15] = 1;
                model[16] = Math.min(1, (this.deathTimer - 2.0));
                device.queue.writeBuffer(this.spamton.uniformBuffer, 0, model);
                pass.setPipeline(this.spamton.pipeline);
                pass.setBindGroup(0, this.spamton.bindGroup);
                pass.setVertexBuffer(0, vbo);
                pass.setIndexBuffer(ibo, 'uint16');
                pass.drawIndexed(6);
            }

            pass.end();
            device.queue.submit([encoder.finish()]);
            requestAnimationFrame(() => this.loop());

            if (this.deathTimer > 4.0)
            {
                document.getElementById('spamton').remove();
                document.getElementById('gameover').style.display = 'block';
                document.getElementById('restart').style.display = 'block';
            }
            return;
        }

        if (this.victory)
        {
            requestAnimationFrame(() => this.loop());
            return;
        }

        const kb = this.kb;
        const device = this.device;
        const context = this.context;

        let dx = 0, dy = 0;
        if (kb.isDown('ArrowRight')) dx = 1;
        if (kb.isDown('ArrowLeft'))  dx = -1;
        if (kb.isDown('ArrowUp'))    dy = 1;
        if (kb.isDown('ArrowDown'))  dy = -1;
        this.heart.move(dx, dy, dt, this.worldW, this.worldH);

        this.miniTimer -= dt;
        if (this.miniTimer <= 0)
        {
            this.miniTimer = 0.7;
            const angle = Math.atan2(this.heart.y - this.spamtonY, this.heart.x - this.spamtonX);
            const mx = this.spamtonX + Math.cos(angle) * 2;
            const my = this.spamtonY + Math.sin(angle) * 2;
            const a = Math.atan2(this.heart.y - my, this.heart.x - mx);
            this.minis.push(new Pst_MiniSpamton(mx, my, Math.cos(a) * 4, Math.sin(a) * 3));
        }

         for (const m of this.minis)
         {
             m.update(dt, this.worldW, this.worldH);
             if (m.checkCollision(this.heart.x, this.heart.y))
             {
                this.heart.breakHeart();
                this.gameOver = true;
             }
         }
        this.minis = this.minis.filter(m => m.alive);

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass(
        {
            colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });

        const scaleX = 2 / this.worldW;
        const scaleY = 2 / this.worldH;

        this.heart.draw(device, pass, scaleX, scaleY);

        this.spamton.draw(device, pass, scaleX, scaleY, this.spamtonX, this.spamtonY, 0, 0.05, 0.05, 0);
        
        for (const m of this.minis)
        {
            m.draw(device, pass, scaleX, scaleY, this.headSprite);
        }

        pass.end();
        device.queue.submit([encoder.finish()]);
        kb.endFrame();
        requestAnimationFrame(() => this.loop());
    }
}