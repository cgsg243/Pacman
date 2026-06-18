import { Pst_Keyboard }          from './utils/input/keyboard/pst_keyboard.js';
import { Pst_Maze }              from './game/pst_maze.js';
import { pst_createShaderModule } from './rnd/res/shd/pst_shaders.js';
import { pst_createPipeline }    from './rnd/pst_pipeline.js';
import { Pst_Mesh }              from './rnd/pst_mesh.js';
import { Pst_Pacman }            from './game/pst_pacman.js';
import { Pst_Coin }              from './game/pst_coins.js';
import { Pst_Sprite }            from './game/pst_sprite.js';
import { Pst_Primitive }         from './rnd/pst_primitive.js';

(async () =>
{
    const canvas = document.getElementById('game');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format });

    const kb = new Pst_Keyboard();
    kb.init();

    const maze = new Pst_Maze();
    const mazeShader = pst_createShaderModule(device);
    const layout = device.createBindGroupLayout({
        entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} }],
    });

    const mazePipeline = pst_createPipeline(device, mazeShader, layout, format);
    const mazeMesh = Pst_Mesh.createMaze(device, maze);
    maze.setMesh(mazeMesh);

    const pacman = new Pst_Pacman(maze, 3, 3);
    pacman.setDirection(1, 0);

    let score = 0;
    const scoreEl = document.createElement('div');
    scoreEl.style.cssText = 'position:fixed;top:10px;left:10px;color:white;font:20px monospace;z-index:10;';
    document.body.appendChild(scoreEl);

    pacman.onEatCoin = () =>
    {
        score += 10;
        scoreEl.textContent = 'Score: ' + score;
    };

    const fruitSprites = {};
    const fruitNames = ['cherry', 'strawberry', 'orange', 'apple', 'melon', 'bell', 'key', 'boss'];
    const fruitPoints = [100, 200, 300, 400, 500, 700, 1000, 2000];

    for (const name of fruitNames)
    {
        const s = new Pst_Sprite();
        await s.loadFromFile(device, null, format, `/targets/${name}.png`);
        s.frames = 1;
        fruitSprites[name] = s;
    }

    const redFrames = [], blueFrames = [], orangeFrames = [], pinkFrames = [], blinkyFrames = [], phantomFrames = [];

    for (let i = 0; i < 8; i++)
    {
        for (const [arr, path] of
        [
            [redFrames, '/all_ghosts/red_ghost'],
            [blueFrames, '/all_ghosts/blue_ghost'],
            [orangeFrames, '/all_ghosts/orange_ghost'],
            [pinkFrames, '/all_ghosts/pink_ghost'],
            [blinkyFrames, '/all_ghosts/angry_blinky'],
            [phantomFrames, '/all_ghosts/fantom'],
        ])
        {
            const s = new Pst_Sprite();
            await s.loadFromFile(device, null, format, `${path}/frame_${i}.png`);
            s.frames = 1;
            arr.push(s);
        }
    }

    const pacmanFrames = [];
    for (let i = 0; i < 12; i++)
    {
        const s = new Pst_Sprite();
        await s.loadFromFile(device, null, format, `/pacman/frame_${i}.png`);
        s.frames = 1;
        pacmanFrames.push(s);
    }

    const mazeUB = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const mazeBG = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: mazeUB } }] });

    const coinShader = device.createShaderModule({
        code: `struct U { model: mat4x4f, } @group(0) @binding(0) var<uniform> u: U;
               @vertex fn vs(@location(0) p: vec3f) -> @builtin(position) vec4f { return u.model * vec4f(p, 1.0); }
               @fragment fn fs() -> @location(0) vec4f { return vec4f(1.0, 0.8, 0.0, 1.0); }`
    });
    const coinPipeline = pst_createPipeline(device, coinShader, layout, format);
    const coinUB = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const coinBG = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: coinUB } }] });

    const coins = [];
    for (let y = 0; y < maze.height; y++)
    {
        for (let x = 0; x < maze.width; x++)
        {
            if (maze.grid[y][x] === 2)
            {
                const c = new Pst_Coin(x, y, device);
                c.initGeometry();
                coins.push(c);
            }
        }
    }

    const playerColors = [[1, 1, 1], [0, 1, 0], [1, 0, 1], [0.5, 0.5, 1], [1, 1, 0.5]];
    const playerPipelines = [], playerUBs = [], playerBGs = [];
    for (const [r, g, b] of playerColors)
    {
        const sh = device.createShaderModule(
        {
            code: `struct U { model: mat4x4f, } @group(0) @binding(0) var<uniform> u: U;
                   @vertex fn vs(@location(0) p: vec3f) -> @builtin(position) vec4f { return u.model * vec4f(p, 1.0); }
                   @fragment fn fs() -> @location(0) vec4f { return vec4f(${r},${g},${b},1.0); }`
        });
        playerPipelines.push(pst_createPipeline(device, sh, layout, format));
        const ub = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        playerUBs.push(ub);
        playerBGs.push(device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: ub } }] }));
    }

    const playerPrim = Pst_Primitive.circle(0.3, 32, 0, 0);
    let playerVS = playerPrim.vertices.byteLength;
    if (playerVS % 4)
      playerVS += 4 - playerVS % 4;
    let playerIS = playerPrim.indices.byteLength;
    if (playerIS % 4)
       playerIS += 4 - playerIS % 4;
    const playerVBO = device.createBuffer({ size: playerVS, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
    new Float32Array(playerVBO.getMappedRange()).set(playerPrim.vertices); playerVBO.unmap();
    const playerIBO = device.createBuffer({ size: playerIS, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
    new Uint16Array(playerIBO.getMappedRange()).set(playerPrim.indices); playerIBO.unmap();

    const ws = new WebSocket('ws://localhost:8080');
    let myId = 0;
    const remotePlayers = {};
    let remoteGhosts = [];

    ws.onmessage = (e) =>
    {
        const msg = JSON.parse(e.data);

        if (msg.type === 'init')
        {
            myId = msg.id;
            for (const p of msg.players)
            {
                if (p.id !== myId)
                  remotePlayers[p.id] = { pacman: p.pacman, score: 0 };
            }
        }
        if (msg.type === 'newPlayer')
           remotePlayers[msg.id] = { pacman: msg.pacman, score: 0 };
        if (msg.type === 'update' && remotePlayers[msg.id])
        {
            remotePlayers[msg.id].pacman = msg.pacman;
            remotePlayers[msg.id].score = msg.score;
        }
        if (msg.type === 'playerLeft')
          delete remotePlayers[msg.id];
        if (msg.type === 'ghostsUpdate')
        {
            remoteGhosts = msg.ghosts;
        }
    };

    const worldW = maze.width * maze.tileSize;
    const worldH = maze.height * maze.tileSize;
    let lastTime = performance.now();
    let sendTimer = 0;
    let fruit = null;
    let fruitTimer = 3;

    function getGhostFrame(dirX, dirY)
    {
        let base;

        if (dirY === 1)      base = 0;
        else if (dirY === -1) base = 2;
        else if (dirX === 1)  base = 6;
        else                  base = 4;

        const wiggle = Math.floor(performance.now() / 200) % 2;
        return base + wiggle;
    }

    function getPacmanFrame(dirX, dirY, mouthOpen)
    {
        let dirIndex;
        if (dirX === 1)      dirIndex = 0;
        else if (dirY === 1) dirIndex = 1;
        else if (dirX === -1) dirIndex = 2;
        else                 dirIndex = 3;

        const mouthIndex = Math.min(2, Math.floor(mouthOpen * 4));
        return dirIndex * 3 + mouthIndex;
    }

    function loop()
    {   
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        
        lastTime = now;

        if (kb.isDown('ArrowRight'))
          pacman.setDirection(1, 0);
        if (kb.isDown('ArrowLeft'))
          pacman.setDirection(-1, 0);
        if (kb.isDown('ArrowUp'))
          pacman.setDirection(0, 1);
        if (kb.isDown('ArrowDown'))
          pacman.setDirection(0, -1);

        pacman.update(dt);

        if (pacman.tileX < 1) pacman.tileX = 1;
        if (pacman.tileX >= maze.width - 1) pacman.tileX = maze.width - 2;
        if (pacman.tileY < 1) pacman.tileY = 1;
        if (pacman.tileY >= maze.height - 1) pacman.tileY = maze.height - 2;

        sendTimer += dt;
        if (sendTimer > 0.1)
        {
            sendTimer = 0;
            if (ws.readyState === WebSocket.OPEN)
            {
                ws.send(JSON.stringify({ type: 'move', pacman: { x: pacman.tileX, y: pacman.tileY }, score }));
            }
        }

        fruitTimer -= dt;
        if (!fruit && fruitTimer <= 0)
        {
            const idx = Math.floor(Math.random() * fruitNames.length);
            const fx = 1 + Math.floor(Math.random() * (maze.width - 2));
            const fy = 1 + Math.floor(Math.random() * (maze.height - 2));

            console.log(fx, fy);

            if (maze.grid[fy][fx] === 0)
            {
                fruit = { x: fx, y: fy, name: fruitNames[idx], points: fruitPoints[idx], alive: true };
                fruitTimer = 1 + Math.random() * 3;
            }
            else
            {
               fruitTimer = 0.5;
            }
        }

        if (fruit && fruit.alive && pacman.tileX === fruit.x && pacman.tileY === fruit.y)
        {
            score += fruit.points;
            scoreEl.textContent = 'Score: ' + score;
            fruit.alive = false;
        }

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass(
        {
            colorAttachments:
            [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });

        const scaleX = 2 / worldW;
        const scaleY = 2 / worldH;
        const model = new Float32Array(16);

        maze.draw(device, pass, mazePipeline, mazeBG, mazeUB, scaleX, scaleY);
        for (const c of coins)
           c.draw(device, pass, coinPipeline, coinBG, coinUB, scaleX, scaleY, worldW, worldH, maze);

        const frame = getPacmanFrame(pacman.dirX, pacman.dirY, pacman.mouthOpen);
        pacmanFrames[frame].draw(device, pass, scaleX, scaleY,
                                 pacman.tileX + 0.5, pacman.tileY + 0.5,
                                 0, 0.6, 0.6, 0);

        const ghostFrameSets = [redFrames, blueFrames, orangeFrames, pinkFrames, blinkyFrames, phantomFrames];

        for (let i = 0; i < remoteGhosts.length; i++)
        {
            const g = remoteGhosts[i];

            if (g.x === undefined)
               continue;
            const gf = getGhostFrame(g.dirX || 0, g.dirY || 0);
            ghostFrameSets[i % 6][gf].draw(device, pass, scaleX, scaleY,
                g.x + 0.5, g.y + 0.5,
                0, 0.6, 0.6, 0);
        }

        for (const id in remotePlayers)
        {
            const rp = remotePlayers[id];
            const idx = parseInt(id) % playerColors.length;

            model.fill(0);
            model[0] = scaleX; model[5] = scaleY; model[10] = 1; model[15] = 1;
            model[12] = (rp.pacman.x + 0.5) * scaleX - 1;
            model[13] = (rp.pacman.y + 0.5) * scaleY - 1;
            device.queue.writeBuffer(playerUBs[idx], 0, model);
            pass.setPipeline(playerPipelines[idx]);
            pass.setBindGroup(0, playerBGs[idx]);
            pass.setVertexBuffer(0, playerVBO);
            pass.setIndexBuffer(playerIBO, 'uint16');
            pass.drawIndexed(playerPrim.indices.length);
        }

        if (fruit && fruit.alive)
        {
            fruitSprites[fruit.name].draw(device, pass, scaleX, scaleY,
                fruit.x + 0.5, fruit.y + 0.5,
                0, 0.5, 0.5, 0);
        }

        pass.end();
        device.queue.submit([encoder.finish()]);
        kb.endFrame();
        requestAnimationFrame(loop);
    }

    console.log('PST: Maze ready', maze.width, 'x', maze.height);
    loop();
})();