import { Pst_Keyboard } from './utils/input/keyboard/pst_keyboard.js';
import { Pst_Maze } from './game/pst_maze.js';
import { pst_createShaderModule } from './rnd/res/shd/pst_shaders.js';
import { pst_createPipeline } from './rnd/pst_pipeline.js';
import { Pst_Mesh } from './rnd/pst_mesh.js';
import { Pst_Pacman } from './game/pst_pacman.js';
import { Pst_Coin } from './game/pst_coins.js';
import { Pst_Sprite } from './game/pst_sprite.js';
import { Pst_Primitive } from './rnd/pst_primitive.js';

let socket = null;
let myId = null;
let isConnected = false;

const remotePlayers = {};
let remoteGhosts = [];

let isDying = false;
let ghostsHidden = false;
let gameOver = false;
let invincibleTimer = 0;

let isFinalDeath = false;
let deathAnimTimer = 0;
let deathFrameIndex = 0;
let deathX = 0;
let deathY = 0;

let coinMap = new Map();
const nicknameLabels = {};

let superCoins = [];
const PST_SUPER_COIN_COUNT = 5;
const PST_SUPER_COIN_SIZE = 1.5;
const PST_SUPER_COIN_POINTS = 50;
let superCoinSprites = [];

const PST_DEATH_ANIM_DURATION = 0.15;
const PST_DEATH_TOTAL_FRAMES = 11;
const MAX_PLAYERS = 10;

function removeNicknameLabel(id)
{
    if (nicknameLabels[id])
    {
        nicknameLabels[id].remove();
        delete nicknameLabels[id];
    }
}

function updateNicknameLabel(id, playerData)
{
    if (!playerData || !playerData.pacman || typeof playerData.pacman.x !== 'number' || typeof playerData.pacman.y !== 'number')
    {
        if (nicknameLabels[id])
        {
            nicknameLabels[id].remove();
            delete nicknameLabels[id];
        }
        return;
    }

    let label = nicknameLabels[id];

    if (!label)
    {
        label = document.createElement('div');
        label.style.cssText = 'position:fixed;color:white;font:12px monospace;pointer-events:none;z-index:5;text-align:center;text-shadow:1px 1px 2px black;transform:translate(-50%, -100%);';
        document.body.appendChild(label);
        nicknameLabels[id] = label;
    }

    const canvas = document.getElementById('game');
    const rect = canvas.getBoundingClientRect();

    const worldW = 30;
    const worldH = 20;

    const scaleX = 2.0 / worldW;
    const scaleY = 2.0 / worldH;

    const worldX = playerData.pacman.x + 0.5;
    const worldY = playerData.pacman.y + 0.5;

    const ndcX = worldX * scaleX - 1.0;
    const ndcY = worldY * scaleY - 1.0;

    const screenX = rect.left + (ndcX + 1.0) / 2.0 * rect.width;
    const screenY = rect.top + (1.0 - ndcY) / 2.0 * rect.height;

    label.style.left = screenX + 'px';
    label.style.top = (screenY - 20) + 'px';
    label.textContent = playerData.nickname || 'Player';
}

function hashCode(str)
{
    let hash = 0;
    for (let i = 0; i < str.length; i++)
    {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function generateSuperCoins(maze, count)
{
    const superCoins = [];
    const occupiedPositions = new Set();

    for (let i = 0; i < count; i++)
    {
        let attempts = 0;
        let placed = false;

        while (!placed && attempts < 100)
        {
            const x = 2 + Math.floor(Math.random() * (maze.width - 4));
            const y = 2 + Math.floor(Math.random() * (maze.height - 4));
            const posKey = `${x},${y}`;

            if (!occupiedPositions.has(posKey) && maze.grid[y][x] === 0)
            {
                const startDist = Math.sqrt(Math.pow(x - 3, 2) + Math.pow(y - 3, 2));
                if (startDist > 3)
                {
                    superCoins.push({
                        x: x,
                        y: y,
                        collected: false,
                        rotation: Math.random() * Math.PI * 2,
                        pulsePhase: Math.random() * Math.PI * 2
                    });
                    occupiedPositions.add(posKey);
                    placed = true;
                }
            }
            attempts++;
        }
    }

    return superCoins;
}

(async () =>
{
    const nickname = await new Promise((resolve) =>
    {
        const loginScreen = document.getElementById('login-screen');
        const nicknameInput = document.getElementById('nickname-input');
        const startBtn = document.getElementById('start-game-btn');
        const errorEl = document.getElementById('nickname-error');

        startBtn.addEventListener('click', () =>
        {
            const name = nicknameInput.value.trim();
            if (name)
            {
                loginScreen.style.display = 'none';
                resolve(name);
            }
            else
            {
                errorEl.style.display = 'block';
            }
        });

        nicknameInput.addEventListener('keypress', (e) =>
        {
            if (e.key === 'Enter')
            {
                const name = nicknameInput.value.trim();
                if (name)
                {
                    loginScreen.style.display = 'none';
                    resolve(name);
                }
                else
                {
                    errorEl.style.display = 'block';
                }
            }
        });

        nicknameInput.focus();
    });

    console.log('Player nickname:', nickname);

    const canvas = document.getElementById('game');
    if (!canvas)
    {
        console.error('Canvas element not found');
        return;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    console.log('Waiting for WebGPU initialization...');

    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('navigator.gpu:', navigator.gpu);
    console.log('typeof:', typeof navigator.gpu);

    if (!navigator.gpu)
    {
        console.error('WebGPU not supported');
        console.log('Enable: chrome://flags/#enable-unsafe-webgpu');
        return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter)
    {
        console.error('No WebGPU adapter found');
        return;
    }

    console.log('adapter:', adapter);

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format });

    console.log('WebGPU initialized successfully!');

    console.log('Connecting to Socket.IO server...');

    await new Promise((resolve) =>
    {
        if (typeof io !== 'undefined')
        {
            console.log('Socket.IO already loaded');
            resolve();
            return;
        }

        console.log('Loading Socket.IO client...');
        const script = document.createElement('script');
        script.src = '/socket.io/socket.io.js';
        script.onload = () =>
        {
            console.log('Socket.IO loaded from server');
            resolve();
        };
        script.onerror = () =>
        {
            console.error('Failed to load Socket.IO client');
            resolve();
        };
        document.head.appendChild(script);
    });

    const socketUrl = window.location.origin;
    console.log('Connecting to:', socketUrl);

    socket = io(socketUrl, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000,
        forceNew: true
    });

    socket.on('connect', () =>
    {
        console.log('Socket.IO connected! ID:', socket.id);
        isConnected = true;
        socket.emit('register', { nickname: nickname });
    });

    socket.on('connect_error', (error) =>
    {
        console.error('Socket.IO connection error:', error);
        console.log('Trying to reconnect...');
    });

    socket.on('disconnect', () =>
    {
        console.log('Socket.IO disconnected');
        isConnected = false;
    });

    socket.on('init', (data) =>
    {
        myId = data.id;
        console.log('My ID:', myId);

        for (const key in nicknameLabels)
        {
            removeNicknameLabel(key);
        }
        for (const key in remotePlayers)
        {
            delete remotePlayers[key];
        }

        if (Array.isArray(data.players))
        {
            for (let i = 0; i < data.players.length; i++)
            {
                const p = data.players[i];
                if (p.id !== myId)
                {
                    remotePlayers[p.id] = {
                        nickname: p.nickname || 'Player',
                        pacman: {
                            x: (p.pacman && typeof p.pacman.x === 'number') ? p.pacman.x : 3,
                            y: (p.pacman && typeof p.pacman.y === 'number') ? p.pacman.y : 3
                        },
                        score: p.score || 0,
                        lives: p.lives || 3
                    };
                }
            }
        }

        if (data.ghosts && Array.isArray(data.ghosts))
        {
            remoteGhosts = data.ghosts.filter(function(g)
            {
                return g && typeof g.x === 'number' && typeof g.y === 'number';
            });
        }
    });

    socket.on('newPlayer', (data) =>
    {
        if (data.id !== myId)
        {
            remotePlayers[data.id] = {
                nickname: data.nickname || 'Player',
                pacman: {
                    x: (data.pacman && typeof data.pacman.x === 'number') ? data.pacman.x : 3,
                    y: (data.pacman && typeof data.pacman.y === 'number') ? data.pacman.y : 3
                },
                score: data.score || 0,
                lives: data.lives || 3
            };
            console.log('New player:', data.nickname);
        }
    });

    socket.on('update', (data) =>
    {
        if (data.id !== myId && remotePlayers[data.id])
        {
            if (data.nickname) remotePlayers[data.id].nickname = data.nickname;
            if (data.pacman && typeof data.pacman.x === 'number')
            {
                remotePlayers[data.id].pacman = {
                    x: data.pacman.x,
                    y: data.pacman.y
                };
            }
            if (typeof data.score === 'number') remotePlayers[data.id].score = data.score;
            if (typeof data.lives === 'number') remotePlayers[data.id].lives = data.lives;
        }
    });

    socket.on('nicknameUpdate', (data) =>
    {
        if (remotePlayers[data.id])
        {
            remotePlayers[data.id].nickname = data.nickname;
        }
    });

    socket.on('playerLeft', (data) =>
    {
        removeNicknameLabel(data.id);
        delete remotePlayers[data.id];
        console.log('Player left:', data.id);
    });

    socket.on('ghostsUpdate', (data) =>
    {
        if (!isDying && !ghostsHidden)
        {
            if (Array.isArray(data.ghosts))
            {
                remoteGhosts = data.ghosts.filter(function(ghost)
                {
                    return ghost &&
                        typeof ghost.x === 'number' &&
                        typeof ghost.y === 'number' &&
                        !isNaN(ghost.x) &&
                        !isNaN(ghost.y);
                });
            }
            else
            {
                remoteGhosts = [];
            }
        }
    });

    socket.on('coinCollected', (data) =>
    {
        const coin = coinMap.get(`${data.x},${data.y}`);
        if (coin)
        {
            coin.collected = true;
        }
    });

    socket.on('superCoinCollected', (data) =>
    {
        const superCoin = superCoins.find(c => c.x === data.x && c.y === data.y);
        if (superCoin)
        {
            superCoin.collected = true;
        }
    });

    socket.on('playerDied', (data) =>
    {
        if (remotePlayers[data.id])
        {
            remotePlayers[data.id].lives = data.lives;
        }
    });

    socket.on('messageFromServer', (msg) =>
    {
        console.log('Server message:', msg);
    });

    await new Promise((resolve) =>
    {
        let attempts = 0;
        const checkInterval = setInterval(() =>
        {
            attempts++;
            if (isConnected || attempts > 50)
            {
                clearInterval(checkInterval);
                console.log('Socket.IO connected:', isConnected);
                resolve();
            }
        }, 100);
    });

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
    let lives = 3;
    const scoreEl = document.createElement('div');
    scoreEl.style.cssText = 'position:fixed;top:10px;left:10px;color:white;font:20px monospace;z-index:10;text-shadow:1px 1px 3px black;';
    document.body.appendChild(scoreEl);

    const livesEl = document.createElement('div');
    livesEl.style.cssText = 'position:fixed;top:40px;left:10px;color:red;font:20px monospace;z-index:10;text-shadow:1px 1px 3px black;';
    document.body.appendChild(livesEl);

    const fruitSprites = {};
    const fruitNames = ['cherry', 'strawberry', 'orange', 'apple', 'melon', 'bell', 'key', 'boss'];
    const fruitPoints = [100, 200, 300, 400, 500, 700, 1000, 2000];

    const coinSprite = new Pst_Sprite();
    try
    {
        await coinSprite.loadFromFile(device, null, format, `/targets/pill.png`);
        coinSprite.frames = 1;
        console.log('coinSprite loaded successfully!');
        console.log('texture:', coinSprite.texture);
    }
    catch (err)
    {
        console.error('Failed to load pill.png:', err);
    }

    superCoinSprites = [];
    const superCoinColors = ['gold', 'diamond', 'ruby', 'emerald', 'sapphire'];

    for (let i = 0; i < superCoinColors.length; i++)
    {
        const color = superCoinColors[i];
        try
        {
            const s = new Pst_Sprite();
            await s.loadFromFile(device, null, format, `/targets/pill.png`);
            s.frames = 1;
            superCoinSprites.push(s);
        }
        catch (err)
        {
            console.warn(`Failed to load super coin sprite: ${color}`, err);
            if (coinSprite.texture)
            {
                superCoinSprites.push(coinSprite);
            }
        }
    }

    if (superCoinSprites.length === 0 && coinSprite.texture)
    {
        for (let i = 0; i < PST_SUPER_COIN_COUNT; i++)
        {
            superCoinSprites.push(coinSprite);
        }
    }

    for (let i = 0; i < fruitNames.length; i++)
    {
        const name = fruitNames[i];
        try
        {
            const s = new Pst_Sprite();
            await s.loadFromFile(device, null, format, `/targets/${name}.png`);
            s.frames = 1;
            fruitSprites[name] = s;
        }
        catch (err)
        {
            console.error(`Failed to load fruit sprite: ${name}`, err);
        }
    }

    const redFrames = [];
    const blueFrames = [];
    const orangeFrames = [];
    const pinkFrames = [];
    const blinkyFrames = [];
    const phantomFrames = [];

    const framePaths = [
        { arr: redFrames, path: '/all_ghosts/red_ghost' },
        { arr: blueFrames, path: '/all_ghosts/blue_ghost' },
        { arr: orangeFrames, path: '/all_ghosts/orange_ghost' },
        { arr: pinkFrames, path: '/all_ghosts/pink_ghost' },
        { arr: blinkyFrames, path: '/all_ghosts/angry_blinky' },
        { arr: phantomFrames, path: '/all_ghosts/fantom' }
    ];

    for (let i = 0; i < 8; i++)
    {
        for (let j = 0; j < framePaths.length; j++)
        {
            const arr = framePaths[j].arr;
            const path = framePaths[j].path;
            try
            {
                const s = new Pst_Sprite();
                await s.loadFromFile(device, null, format, `${path}/frame_${i}.png`);
                s.frames = 1;
                arr.push(s);
            }
            catch (err)
            {
                console.warn(`Failed to load ghost frame: ${path}/frame_${i}.png`, err);
                arr.push(null);
            }
        }
    }

    const pacmanFrames = [];
    for (let i = 0; i < 12; i++)
    {
        try
        {
            const s = new Pst_Sprite();
            await s.loadFromFile(device, null, format, `/pacman/frame_${i}.png`);
            s.frames = 1;
            pacmanFrames.push(s);
        }
        catch (err)
        {
            console.warn(`Failed to load pacman frame: ${i}`, err);
            pacmanFrames.push(null);
        }
    }

    const deathFrames = [];
    for (let i = 0; i < 11; i++)
    {
        try
        {
            const s = new Pst_Sprite();
            await s.loadFromFile(device, null, format, `/pacman/death/frame_${i}.png`);
            s.frames = 1;
            deathFrames.push(s);
        }
        catch (err)
        {
            console.warn(`Failed to load death frame: ${i}`, err);
            deathFrames.push(null);
        }
    }

    const mazeUB = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const mazeBG = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: mazeUB } }] });

    const coinShader = device.createShaderModule({
        code: `struct U { model: mat4x4f, }
               @group(0) @binding(0) var<uniform> u: U;
               @vertex fn vs(@location(0) p: vec3f) -> @builtin(position) vec4f { return u.model * vec4f(p, 1.0); }
               @fragment fn fs() -> @location(0) vec4f { return vec4f(1.0, 0.8, 0.0, 1.0); }`
    });
    const coinPipeline = pst_createPipeline(device, coinShader, layout, format);
    const coinUB = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const coinBG = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: coinUB } }] });

    const coins = [];
    coinMap = new Map();

    for (let y = 0; y < maze.height; y++)
    {
        for (let x = 0; x < maze.width; x++)
        {
            if (maze.grid[y][x] === 2)
            {
                const c = new Pst_Coin(x, y, device, layout);
                
                c.initGeometry();
                c.collected = false;
                coins.push(c);
                coinMap.set(`${x},${y}`, c);
            }
        }
    }

    console.log('Total coins:', coins.length);

    superCoins = generateSuperCoins(maze, PST_SUPER_COIN_COUNT);
    console.log('Super coins generated:', superCoins.length);

    const playerColors =
    [
        [1, 0.2, 0.2],
        [0.2, 1, 0.2],
        [0.2, 0.2, 1],
        [1, 1, 0.2],
        [1, 0.2, 1],
        [0.2, 1, 1],
        [1, 0.5, 0],
        [0.5, 0.2, 1],
        [1, 0.7, 0.7],
        [0.7, 1, 0.7],
    ];

    const playerPipelines = [];
    const playerUBs = [];
    const playerBGs = [];

    for (let i = 0; i < MAX_PLAYERS; i++)
    {
        const colorIndex = i % playerColors.length;
        const r = playerColors[colorIndex][0];
        const g = playerColors[colorIndex][1];
        const b = playerColors[colorIndex][2];

        const sh = device.createShaderModule({
            code: `struct U { model: mat4x4f, } @group(0) @binding(0) var<uniform> u: U;
                   @vertex fn vs(@location(0) p: vec3f) -> @builtin(position) vec4f { return u.model * vec4f(p, 1.0); }
                   @fragment fn fs() -> @location(0) vec4f { return vec4f(${r},${g},${b},0.4); }`
        });

        const pipeline = pst_createPipeline(device, sh, layout, format);
        const ub = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        const bg = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: ub } }] });

        playerPipelines.push(pipeline);
        playerUBs.push(ub);
        playerBGs.push(bg);
    }

    const playerPrim = Pst_Primitive.circle(0.25, 32, 0, 0);
    let playerVS = playerPrim.vertices.byteLength;
    if (playerVS % 4) playerVS += 4 - playerVS % 4;
    let playerIS = playerPrim.indices.byteLength;
    if (playerIS % 4) playerIS += 4 - playerIS % 4;
    const playerVBO = device.createBuffer({ size: playerVS, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
    new Float32Array(playerVBO.getMappedRange()).set(playerPrim.vertices);
    playerVBO.unmap();
    const playerIBO = device.createBuffer({ size: playerIS, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
    new Uint16Array(playerIBO.getMappedRange()).set(playerPrim.indices);
    playerIBO.unmap();

    const worldW = maze.width * maze.tileSize;
    const worldH = maze.height * maze.tileSize;
    let lastTime = performance.now();
    let sendTimer = 0;
    let fruit = null;
    let fruitTimer = 3;

    function startDeathAnimation(x, y, isFinal)
    {
        isDying = true;
        isFinalDeath = isFinal || false;
        deathAnimTimer = 0;
        deathFrameIndex = 0;
        deathX = x;
        deathY = y;
        ghostsHidden = true;
        remoteGhosts = [];
    }

    function updateDeathAnimation(dt)
    {
        if (!isDying)
            return false;

        deathAnimTimer += dt;

        if (deathAnimTimer >= PST_DEATH_ANIM_DURATION)
        {
            deathAnimTimer = 0;
            deathFrameIndex++;

            if (deathFrameIndex >= PST_DEATH_TOTAL_FRAMES)
            {
                isDying = false;
                deathFrameIndex = 0;

                if (isFinalDeath)
                    gameOver = true;
                else
                    ghostsHidden = false;

                isFinalDeath = false;
                return true;
            }
        }

        return false;
    }

    function handleGhostCollision()
    {
        const deathPosX = pacman.tileX;
        const deathPosY = pacman.tileY;

        lives--;

        pacman.tileX = 3;
        pacman.tileY = 3;
        pacman.setDirection(1, 0);

        if (lives <= 0)
        {
            startDeathAnimation(deathPosX, deathPosY, true);
            if (socket && socket.connected)
                socket.emit('gameOver', { score });
        }
        else
        {
            startDeathAnimation(deathPosX, deathPosY, false);
            invincibleTimer = 3;
            if (socket && socket.connected)
                socket.emit('playerDied', { lives });
        }

        updateUI();
    }

    function checkCoinCollection()
    {
        if (isDying)
        {
            return;
        }

        const coinKey = `${Math.floor(pacman.tileX)},${Math.floor(pacman.tileY)}`;
        const coin = coinMap.get(coinKey);

        if (coin && !coin.collected)
        {
            coin.collected = true;
            score += 10;

            if (pacman.onEatCoin)
            {
                pacman.onEatCoin();
            }

            if (socket && socket.connected)
            {
                socket.emit('coinCollected', {
                    x: Math.floor(pacman.tileX),
                    y: Math.floor(pacman.tileY)
                });
            }
        }
    }

    function checkSuperCoinCollection()
    {
        if (isDying)
        {
            return;
        }

        for (let i = 0; i < superCoins.length; i++)
        {
            const superCoin = superCoins[i];
            if (!superCoin.collected)
            {
                const dist = Math.sqrt(
                    Math.pow(pacman.tileX + 0.5 - superCoin.x - 0.5, 2) +
                    Math.pow(pacman.tileY + 0.5 - superCoin.y - 0.5, 2)
                );

                if (dist < 0.8)
                {
                    superCoin.collected = true;
                    score += PST_SUPER_COIN_POINTS;
                    invincibleTimer = Math.max(invincibleTimer, 5);

                    if (socket && socket.connected)
                    {
                        socket.emit('superCoinCollected', {
                            x: superCoin.x,
                            y: superCoin.y
                        });
                    }

                    break;
                }
            }
        }
    }

    function checkGhostCollision()
    {
        if (invincibleTimer > 0 || isDying || ghostsHidden)
        {
            return false;
        }

        const pacmanX = pacman.tileX + 0.5;
        const pacmanY = pacman.tileY + 0.5;
        const collisionDistance = 0.8;

        if (!Array.isArray(remoteGhosts))
        {
            return false;
        }

        for (let i = 0; i < remoteGhosts.length; i++)
        {
            const ghost = remoteGhosts[i];
            if (!ghost || typeof ghost.x !== 'number' || typeof ghost.y !== 'number')
            {
                continue;
            }

            const dx = pacmanX - (ghost.x + 0.5);
            const dy = pacmanY - (ghost.y + 0.5);
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < collisionDistance)
            {
                return true;
            }
        }

        return false;
    }

    function getGhostFrame(dirX, dirY)
    {
        let base;
        if (dirY === 1) base = 0;
        else if (dirY === -1) base = 2;
        else if (dirX === 1) base = 6;
        else base = 4;
        const wiggle = Math.floor(performance.now() / 200) % 2;
        return base + wiggle;
    }

    function getPacmanFrame(dirX, dirY, mouthOpen)
    {
        let dirIndex;
        if (dirX === 1) dirIndex = 0;
        else if (dirY === 1) dirIndex = 1;
        else if (dirX === -1) dirIndex = 2;
        else dirIndex = 3;
        const mouthIndex = Math.min(2, Math.floor(mouthOpen * 4));
        return dirIndex * 3 + mouthIndex;
    }

    function updateUI()
    {
        const playerCount = Object.keys(remotePlayers).length;
        const remainingSuperCoins = superCoins.filter(function(c) { return !c.collected; }).length;
        scoreEl.textContent = `${nickname} | Score: ${score} | Players: ${playerCount + 1} | Special: ${remainingSuperCoins}`;

        if (gameOver)
        {
            livesEl.textContent = 'Lives: DEAD';
            const gameOverEl = document.getElementById('game-over');
            const restartEl = document.getElementById('restart');
            if (gameOverEl) gameOverEl.style.display = 'block';
            if (restartEl) restartEl.style.display = 'block';
        }
        else
        {
            livesEl.textContent = `Lives: ${'*'.repeat(Math.max(0, lives))}`;
        }
    }

    function loop()
    {
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        if (isDying)
        {
            updateDeathAnimation(dt);
        }

        if (gameOver)
        {
            updateUI();
            requestAnimationFrame(loop);
            return;
        }

        if (invincibleTimer > 0)
        {
            invincibleTimer -= dt;
        }

        if (!isDying)
        {
            if (kb.isDown('ArrowRight')) pacman.setDirection(1, 0);
            if (kb.isDown('ArrowLeft')) pacman.setDirection(-1, 0);
            if (kb.isDown('ArrowUp')) pacman.setDirection(0, 1);
            if (kb.isDown('ArrowDown')) pacman.setDirection(0, -1);

            pacman.update(dt);

            if (pacman.tileX < 1) pacman.tileX = 1;
            if (pacman.tileX >= maze.width - 1) pacman.tileX = maze.width - 2;
            if (pacman.tileY < 1) pacman.tileY = 1;
            if (pacman.tileY >= maze.height - 1) pacman.tileY = maze.height - 2;

            checkCoinCollection();
            checkSuperCoinCollection();

            if (checkGhostCollision())
            {
                handleGhostCollision();
            }
        }

        sendTimer += dt;
        if (sendTimer > 0.1)
        {
            sendTimer = 0;
            if (socket && socket.connected && !isDying)
            {
                socket.emit('move', {
                    pacman: { x: pacman.tileX, y: pacman.tileY },
                    score,
                    lives
                });
            }
        }

        fruitTimer -= dt;
        if (!fruit && fruitTimer <= 0 && !isDying)
        {
            const idx = Math.floor(Math.random() * fruitNames.length);
            const fx = 1 + Math.floor(Math.random() * (maze.width - 2));
            const fy = 1 + Math.floor(Math.random() * (maze.height - 2));

            if (maze.grid[fy][fx] === 0)
            {
                fruit = { x: fx, y: fy, name: fruitNames[idx], points: fruitPoints[idx], alive: true };
                fruitTimer = 10 + Math.random() * 20;
            }
            else
            {
                fruitTimer = 0.5;
            }
        }

        if (fruit && fruit.alive && !isDying && Math.abs(pacman.tileX - fruit.x) < 0.5 && Math.abs(pacman.tileY - fruit.y) < 0.5)
        {
            score += fruit.points;
            fruit.alive = false;
            fruitTimer = 10 + Math.random() * 20;
        }

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });

        const scaleX = 2 / worldW;
        const scaleY = 2 / worldH;
        const model = new Float32Array(16);

        for (let i = 0; i < coins.length; i++)
        {
            const coin = coins[i];
            if (!coin.collected)
            {
                coin.updateMatrix(scaleX, scaleY);
            }
        }

        maze.draw(device, pass, mazePipeline, mazeBG, mazeUB, scaleX, scaleY);

        for (let i = 0; i < coins.length; i++)
        {
            const coin = coins[i];
            if (!coin.collected)
            {
                coin.draw(device, pass, coinPipeline);
            }
        }

        const currentTime = performance.now() / 1000;
        for (let i = 0; i < superCoins.length; i++)
        {
            const superCoin = superCoins[i];
            if (!superCoin.collected && i < superCoinSprites.length && superCoinSprites[i])
            {
                const pulseScale = 1 + Math.sin(currentTime * 2 + superCoin.pulsePhase) * 0.2;
                const rotation = currentTime * 0.5 + superCoin.rotation;

                superCoinSprites[i].draw(device, pass, scaleX, scaleY,
                                         superCoin.x + 0.5, superCoin.y + 0.5,
                                         rotation,
                                         PST_SUPER_COIN_SIZE * pulseScale * scaleX + 0.8,
                                         PST_SUPER_COIN_SIZE * pulseScale * scaleY + 0.8, 0);
            }
        }

        if (isDying)
        {
            if (deathFrames[deathFrameIndex])
            {
                deathFrames[deathFrameIndex].draw(device, pass, scaleX, scaleY,
                                                  deathX + 0.5, deathY + 0.5, 0, 0.6, 0.6, 0);
            }
        }
        else
        {
            const shouldDrawPacman = invincibleTimer <= 0 || Math.floor(invincibleTimer * 10) % 2 === 0;
            if (shouldDrawPacman)
            {
                const frame = getPacmanFrame(pacman.dirX, pacman.dirY, pacman.mouthOpen);
                if (pacmanFrames[frame])
                {
                    pacmanFrames[frame].draw(device, pass, scaleX, scaleY,
                                             pacman.tileX + 0.5, pacman.tileY + 0.5,
                                             0, 0.6, 0.6, 0);
                }
            }
        }

        if (!ghostsHidden)
        {
            const ghostFrameSets = [redFrames, blueFrames, orangeFrames, pinkFrames, blinkyFrames, phantomFrames];
            if (Array.isArray(remoteGhosts))
            {
                for (let i = 0; i < remoteGhosts.length; i++)
                {
                    const g = remoteGhosts[i];
                    if (!g || typeof g.x !== 'number' || typeof g.y !== 'number')
                    {
                        continue;
                    }

                    const gf = getGhostFrame(g.dirX || 0, g.dirY || 0);
                    const frameSet = ghostFrameSets[i % 6];
                    if (frameSet && frameSet[gf])
                    {
                        frameSet[gf].draw(device, pass, scaleX, scaleY,
                                          g.x + 0.5, g.y + 0.5,
                                          0, 0.6, 0.6, 0);
                    }
                }
            }
        }

        for (const id in remotePlayers)
        {
            const rp = remotePlayers[id];

            if (!rp || !rp.pacman || typeof rp.pacman.x !== 'number' || typeof rp.pacman.y !== 'number')
            {
                removeNicknameLabel(id);
                continue;
            }

            const mouthOpen = Math.abs(Math.sin(Date.now() / 200)) * 0.8;
            const frame = getPacmanFrame(1, 0, mouthOpen);

            if (pacmanFrames[frame])
            {
                pacmanFrames[frame].draw(device, pass, scaleX, scaleY,
                                         rp.pacman.x + 0.5, rp.pacman.y + 0.5,
                                         0, 0.6, 0.6, 0);
            }

            const colorIdx = hashCode(id) % MAX_PLAYERS;
            if (colorIdx < playerUBs.length)
            {
                model.fill(0);
                model[0] = scaleX * 0.25;
                model[5] = scaleY * 0.25;
                model[10] = 1;
                model[15] = 1;
                model[12] = (rp.pacman.x + 0.5) * scaleX - 1;
                model[13] = (rp.pacman.y + 0.5) * scaleY - 1;

                device.queue.writeBuffer(playerUBs[colorIdx], 0, model);
                pass.setPipeline(playerPipelines[colorIdx]);
                pass.setBindGroup(0, playerBGs[colorIdx]);
                pass.setVertexBuffer(0, playerVBO);
                pass.setIndexBuffer(playerIBO, 'uint16');
                pass.drawIndexed(playerPrim.indices.length);
            }

            updateNicknameLabel(id, rp);
        }

        for (const id in nicknameLabels)
        {
            if (!remotePlayers[id])
            {
                removeNicknameLabel(id);
            }
        }

        if (fruit && fruit.alive && fruitSprites[fruit.name])
        {
            fruitSprites[fruit.name].draw(device, pass, scaleX, scaleY,
                                          fruit.x + 0.5, fruit.y + 0.5,
                                          0, 0.5, 0.5, 0);
        }

        pass.end();
        device.queue.submit([encoder.finish()]);
        kb.endFrame();
        updateUI();
        requestAnimationFrame(loop);
    }

    console.log('PST: Maze ready', maze.width, 'x', maze.height);
    console.log('Super coins system initialized');
    loop();
})();