import { Pst_Keyboard }          from '../utils/input/keyboard/pst_keyboard.js';
import { Pst_Boss }              from './pst_boss.js';
import { Pst_Laser }             from './pst_lazer.js';
import { pst_createPipeline }    from '../rnd/pst_pipeline.js';
import { Pst_Pacman }            from './pst_pacman.js';
import { Pst_Primitive }         from '../rnd/pst_primitive.js';
import { Pst_Scull }             from './pst_scull.js';
import { Pst_Cherry } from './pst_cherry.js';
import { Pst_SceneSpamton } from './pst_scene_spamton.js';

export class Pst_SceneBoss
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
        const canvas = document.getElementById('boss');
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

        const layoutSimple = device.createBindGroupLayout({
            entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} }],
        });

        const pacmanShader = device.createShaderModule({
            code: `struct U
                   {
                      model: mat4x4f,
                   }
                   @group(0) @binding(0) var<uniform> u: U;

                   @vertex fn vs(@location(0) p: vec3f) -> @builtin(position) vec4f
                   { 
                     return u.model * vec4f(p, 1.0);
                   }
                   @fragment fn fs() -> @location(0) vec4f
                   { 
                     return vec4f(1.0, 1.0, 0.0, 1.0);
                   }`
        });
        const bossShader = device.createShaderModule(
        {
            code: `struct U
                   {
                     model: mat4x4f,
                   }
                   @group(0) @binding(0) var<uniform> u: U;

                   @vertex fn
                   vs(@location(0) p: vec3f) -> @builtin(position) vec4f
                   { 
                      return u.model * vec4f(p, 1.0);
                   }
                   @fragment fn  fs() -> @location(0)  vec4f
                   {
                    return vec4f(1.0, 0.0, 0.0, 1.0);
                   }`
        });
        const laserShader = device.createShaderModule({
            code: `
                struct U
                {
                  model: mat4x4f,
                }
                @group(0) @binding(0) var<uniform> u: U;

                struct VOut 
                {
                  @builtin(position) pos: vec4f,
                  @location(0) uv: vec2f,
                }
                @vertex fn vs(@location(0) p: vec3f, @location(1) uv: vec2f) -> VOut
                {
                    var out: VOut;
                    out.pos = u.model * vec4f(p, 1.0);
                    out.uv = uv;
                    return out;
                }
                @fragment fn fs(in: VOut) -> @location(0) vec4f
                {
                    let alpha = (1.0 - in.uv.x) * 0.8;

                    return vec4f(0.0, 1.0, 1.0, alpha);
                }
            `
        });

        this.pacmanPipeline = pst_createPipeline(device, pacmanShader, layoutSimple, format);
        this.bossPipeline = pst_createPipeline(device, bossShader, layoutSimple, format);
        this.cherryPipeline = pst_createPipeline(device, cherryShader, layoutSimple, format);
        this.laserPipeline = device.createRenderPipeline(
        {
            layout: device.createPipelineLayout({ bindGroupLayouts: [layoutSimple] }),
            vertex:
            {
                module: laserShader,
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
            fragment: { module: laserShader, entryPoint: 'fs', targets: [{ format }] },
            primitive: { topology: 'triangle-list' },
        });

        const skullProto = new Pst_Scull(0, 0, 0);
        skullProto.init(device, layoutSimple, format);
        this.skullHeadPipeline = skullProto.headPipeline;
        this.skullEyePipeline = skullProto.eyePipeline;
        this.skullUB = skullProto.uniformBuffer;
        this.skullBG = skullProto.bindGroup;

        this.pacmanUB = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.pacmanBG = device.createBindGroup({ layout: layoutSimple, entries: [{ binding: 0, resource: { buffer: this.pacmanUB } }] });

        this.bossUB = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.bossBG = device.createBindGroup({ layout: layoutSimple, entries: [{ binding: 0, resource: { buffer: this.bossUB } }] });

        this.cherryUB = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.cherryBG = device.createBindGroup({ layout: layoutSimple, entries: [{ binding: 0, resource: { buffer: this.cherryUB } }] });

        this.laserUB = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.laserBG = device.createBindGroup({ layout: layoutSimple, entries: [{ binding: 0, resource: { buffer: this.laserUB } }] });

        this.boss = new Pst_Boss(10, 9);
        this.pacman = new Pst_Pacman(null, 5, 5);
        this.pacman.setDirection(1, 0);
        this.laser = new Pst_Laser();
        this.skulls = [];
        this.skullTimer = 0;
        this.cherries = [];
        const cherryPositions =
        [
            {x: 2, y: 2}, {x: 5, y: 7}, {x: 15, y: 3},
        ];

        for (const pos of cherryPositions)
        {
           const cherry = new Pst_Cherry(pos.x, pos.y);
           cherry.init(device, layoutSimple, format);
           this.cherries.push(cherry);
        }
        if (this.skulls.length > 15)
        {
           this.skulls = this.skulls.slice(-15);
        }
        this.Cherry = new Pst_Cherry(4, 4);
        this.Cherry.init(device, layoutSimple, format);
        this.cherryCount = 0;
        this.canAttack = false;
        this.bossHp = 3;
        this.gameOver = false;
        this.victory = false;
        this.worldW = 20;
        this.worldH = 18;
        this.lastTime = performance.now();
        this.cherrycount = 0;
    }

    loop()
    {
        const now = performance.now();
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        if (this.gameOver || this.victory)
        {
            requestAnimationFrame(() => this.loop());
            return;
        }

        const kb = this.kb;
        const device = this.device;
        const context = this.context;

        if (kb.isDown('ArrowRight'))
        { 
           this.pacman.tileX += 5 * dt;
           this.pacman.dirX = 1;
           this.pacman.dirY = 0;
        }
        if (kb.isDown('ArrowLeft'))
        {
           this.pacman.tileX -= 5 * dt;
           this.pacman.dirX = -1;
           this.pacman.dirY = 0;
        }
        if (kb.isDown('ArrowUp'))    { this.pacman.tileY += 5 * dt; this.pacman.dirX = 0; this.pacman.dirY = 1; }
        if (kb.isDown('ArrowDown'))  { this.pacman.tileY -= 5 * dt; this.pacman.dirX = 0; this.pacman.dirY = -1; }

        const px = this.pacman.tileX;
        const py = this.pacman.tileY;
        if (px < 0.3)
          this.pacman.tileX = 0.3;
        if (px > this.worldW - 0.3)
          this.pacman.tileX = this.worldW - 0.3;
        if (py < 0.3)
          this.pacman.tileY = 0.3;
        if (py > this.worldH - 0.3)
          this.pacman.tileY = this.worldH - 0.3;

        this.boss.update(px, py, dt);
        this.laser.update(dt, this.boss.x, this.boss.y, this.boss.angle);

        if (this.laser.state === 'firing' && this.laser.checkCollision(px, py))
        {
            this.gameOver = true;

            document.getElementById('boss').remove();
            document.getElementById('gameover').style.display = 'block';
            document.getElementById('restart').style.display = 'block';
        }

       this.skullTimer -= dt;
       if (this.skullTimer <= 0)
       {
           this.skullTimer = 0.5;
           for (let i = -1; i <= 1; i++)
           {
               const a = this.boss.angle + i * 0.2;

               this.skulls.push(new Pst_Scull(this.boss.x, this.boss.y, a));
           }
       } 
       for (const s of this.skulls)
        s.update(dt);

       this.skulls = this.skulls.filter(s => s.alive);

        for (const s of this.skulls)
        {
            if (Math.hypot(px - s.x, py - s.y) < 0.5)
               this.gameOver = true;
        }

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass(
        {
            colorAttachments:
            [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });

        const scaleX = 2 / this.worldW;
        const scaleY = 2 / this.worldH;
        const model = new Float32Array(16);

        for (const c of this.cherries)
        {
            if (!c.alive)
               continue;

            if (Math.hypot(px - c.x, py - c.y) < 0.5)
            {
                c.alive = false;
                this.cherryCount++;

                if (this.cherryCount >= 3)
                {
                    document.getElementById('boss').style.display = 'none';
                    const spamtonCanvas = document.createElement('canvas');
                    spamtonCanvas.id = 'spamton';
                    document.body.appendChild(spamtonCanvas);

                    const spamtonScene = new Pst_SceneSpamton();
                    spamtonScene.onEnd = (result) =>
                    {
                        document.getElementById('spamton').remove();
                        document.getElementById('game').style.display = 'block';
                        if (this.onEnd) this.onEnd(result);
                    };
                    spamtonScene.init().then(() => spamtonScene.loop());
                    return;
                }
            }
        } 
        if (this.victory)
        {
            document.getElementById('boss').style.display = 'none';
            const spamtonCanvas = document.createElement('canvas');
            spamtonCanvas.id = 'spamton';
            document.body.appendChild(spamtonCanvas);

            const spamtonScene = new Pst_SceneSpamton();
            spamtonScene.onEnd = (result) =>
            {
                document.getElementById('spamton').remove();
                document.getElementById('game').style.display = 'block';
                if (this.onEnd)
                  this.onEnd(result);
            };
            spamtonScene.init().then(() => spamtonScene.loop());
            return;
        }

        for (const c of this.cherries)
        {
          c.draw(device, pass, scaleX, scaleY);
        }
        model.fill(0);
        model[0] = scaleX;
        model[5] = scaleY;
        model[10] = 1;
        model[15] = 1;
        model[12] = px * scaleX - 1;
        model[13] = py * scaleY - 1;
        device.queue.writeBuffer(this.pacmanUB, 0, model);
        pass.setPipeline(this.pacmanPipeline);
        pass.setBindGroup(0, this.pacmanBG);
        const primP = Pst_Primitive.circle(0.3, 32, 0, 0);
        let vs = primP.vertices.byteLength;
        if (vs % 4)
          vs += 4 - vs % 4;
        let is = primP.indices.byteLength;
        if (is % 4)
          is += 4 - is % 4;
        const vboP = device.createBuffer({ size: vs, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
        new Float32Array(vboP.getMappedRange()).set(primP.vertices); vboP.unmap();
        const iboP = device.createBuffer({ size: is, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
        new Uint16Array(iboP.getMappedRange()).set(primP.indices); iboP.unmap();
        
        pass.setVertexBuffer(0, vboP); pass.setIndexBuffer(iboP, 'uint16');
        pass.drawIndexed(primP.indices.length);

        this.boss.draw(device, pass, this.bossPipeline, this.bossBG, this.bossUB, scaleX, scaleY);
        this.laser.draw(device, pass, this.laserPipeline, this.laserBG, this.laserUB, scaleX, scaleY);

        for (const s of this.skulls)
        {
          s.draw(device, pass, this.skullHeadPipeline, this.skullEyePipeline, this.skullBG, this.skullUB, scaleX, scaleY);
        }
        pass.end();
        device.queue.submit([encoder.finish()]);
        kb.endFrame();
        requestAnimationFrame(() => this.loop());
    }
}