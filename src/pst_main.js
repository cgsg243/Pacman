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
let gameReady = false;

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
const PST_MAX_PLAYERS = 10;

let showReady = false;
let readyTimer = 0;
const PST_READY_DURATION = 2.0;

let currentLevel = 1;
let levelTransition = false;
let levelTransitionTimer = 0;
const PST_LEVEL_TRANSITION_DURATION = 2.0;

let serverFruit = null;

let isWinner = false;
let maxLevel = 3;
let showWinnerScreen = false;
let winnerTimer = 0;
const WINNER_SCREEN_DURATION = 5.0;

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

    if (playerData.level !== undefined && playerData.level !== currentLevel)
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

function rebuildCoins(maze, device, layout)
{
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

    return coins;
}

function rebuildMazeMesh(maze, device)
{
    if (maze.mesh)
    {
        maze.mesh.vbo.destroy();
        maze.mesh.ibo.destroy();
    }

    const newMesh = Pst_Mesh.createMaze(device, maze);

    maze.setMesh(newMesh);
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
                errorEl.style.display = 'block';
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
                    errorEl.style.display = 'block';
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

    if (!navigator.gpu)
    {
        console.error('WebGPU not supported');
        return;
    }

    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter)
    {
        console.error('No WebGPU adapter found');
        return;
    }

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

    socket = io(socketUrl,
    {
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
        
        if (gameReady)
        {
            console.log('Reconnecting to game...');
            socket.emit('register', { nickname: nickname });
        }
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

    socket.on('newPlayer', (data) =>
    {
        if (data.id !== myId)
        {
            remotePlayers[data.id] =
            {
                nickname: data.nickname || 'Player',
                pacman:
                {
                    x: (data.pacman && typeof data.pacman.x === 'number') ? data.pacman.x : 3,
                    y: (data.pacman && typeof data.pacman.y === 'number') ? data.pacman.y : 3
                },
                score: data.score || 0,
                lives: data.lives || 3,
                level: data.level || 1,
                isWinner: false
            };
            console.log('New player:', data.nickname);
        }
    });

    socket.on('update', (data) =>
    {
        if (data.id !== myId && remotePlayers[data.id])
        {
            if (data.nickname)
                remotePlayers[data.id].nickname = data.nickname;

            if (data.pacman && typeof data.pacman.x === 'number')
            {
                remotePlayers[data.id].pacman =
                {
                    x: data.pacman.x,
                    y: data.pacman.y
                };
            }

            if (typeof data.score === 'number')
                remotePlayers[data.id].score = data.score;

            if (typeof data.lives === 'number')
                remotePlayers[data.id].lives = data.lives;

            if (typeof data.level === 'number')
                remotePlayers[data.id].level = data.level;

            if (typeof data.isWinner === 'boolean')
                remotePlayers[data.id].isWinner = data.isWinner;
        }
    });

    socket.on('nicknameUpdate', (data) =>
    {
        if (remotePlayers[data.id])
            remotePlayers[data.id].nickname = data.nickname;
    });

    socket.on('playerLeft', (data) =>
    {
        removeNicknameLabel(data.id);
        delete remotePlayers[data.id];
        console.log('Player left:', data.id);
    });

    socket.on('ghostsUpdate', (data) =>
    {
        if (!isDying && !ghostsHidden && !levelTransition)
        {
            if (Array.isArray(data.ghosts))
            {
                remoteGhosts = data.ghosts.filter(function(ghost)
                {
                    return ghost && typeof ghost.x === 'number' && typeof ghost.y === 'number' && !isNaN(ghost.x) && !isNaN(ghost.y);
                });
            }
            else
                remoteGhosts = [];
        }
    });

    socket.on('coinCollected', (data) =>
    {
        const coin = coinMap.get(`${data.x},${data.y}`);

        if (coin)
            coin.collected = true;
    });

    socket.on('superCoinCollected', (data) =>
    {
        const superCoin = superCoins.find(c => c.x === data.x && c.y === data.y);

        if (superCoin)
            superCoin.collected = true;
    });

    socket.on('playerDied', (data) =>
    {
        if (remotePlayers[data.id])
            remotePlayers[data.id].lives = data.lives;
    });

    socket.on('messageFromServer', (msg) =>
    {
        console.log('Server message:', msg);
    });

    socket.on('fruitSpawned', (data) =>
    {
        serverFruit =
        {
            x: data.x,
            y: data.y,
            name: data.name,
            points: data.points,
            alive: true
        };
        console.log('Fruit spawned:', data.name, 'at', data.x, data.y);
    });

    socket.on('fruitExpired', (data) =>
    {
        if (serverFruit && serverFruit.x === data.x && serverFruit.y === data.y)
            serverFruit = null;
    });

    socket.on('fruitCollected', (data) =>
    {
        if (serverFruit && serverFruit.x === data.x && serverFruit.y === data.y)
            serverFruit = null;
    });

    socket.on('gameWinner', (data) =>
    {
        showWinnerScreen = true;
        winnerTimer = WINNER_SCREEN_DURATION;
        restartBtn.style.display = 'block';
        
        const winnerMsg = document.createElement('div');
        winnerMsg.id = 'winner-message';
        winnerMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#FFD700;font:48px monospace;z-index:100;text-align:center;text-shadow:0 0 20px rgba(255,215,0,0.5);background:rgba(0,0,0,0.8);padding:40px;border-radius:20px;border:3px solid #FFD700;';
        winnerMsg.innerHTML = `
            <b>${data.nickname}</b> WON! <br>
            <span style="font-size:24px;color:white;">Score: ${data.score}</span><br>
            <span style="font-size:18px;color:#aaa;margin-top:20px;display:block;">Press Restart button or wait ${WINNER_SCREEN_DURATION} seconds...</span>
        `;
        document.body.appendChild(winnerMsg);

        if (data.id === myId) {
            isWinner = true;
            const youWonMsg = document.createElement('div');
            youWonMsg.id = 'you-won-message';
            youWonMsg.style.cssText = 'position:fixed;top:30%;left:50%;transform:translate(-50%,-50%);color:#FF6B00;font:64px monospace;z-index:101;text-align:center;text-shadow:0 0 30px rgba(255,107,0,0.8);animation:pulse 1s infinite;';
            youWonMsg.textContent = '🎉 YOU WIN! 🎉';
            document.body.appendChild(youWonMsg);

            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse
                {
                    0% { transform: translate(-50%,-50%) scale(1); }
                    50% { transform: translate(-50%,-50%) scale(1.2); }
                    100% { transform: translate(-50%,-50%) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
    });

    socket.on('youWon', (data) =>
    {
        console.log('You won! Score:', data.score, 'Level:', data.level);
    });

    socket.on('gameReset', (data) =>
    {
        isWinner = false;
        showWinnerScreen = false;
        gameOver = false;
        isDying = false;
        lives = data.lives || 3;
        score = data.score || 0;
        currentLevel = data.level || 1;
        
        const winnerMsg = document.getElementById('winner-message');
        if (winnerMsg)
           winnerMsg.remove();
        const youWonMsg = document.getElementById('you-won-message');
        if (youWonMsg)
           youWonMsg.remove();
        
        restartBtn.style.display = 'block';
        
        if (data.mazeGrid)
        {
            maze.setGrid(data.mazeGrid);
            rebuildMazeMesh(maze, device);
            coins = rebuildCoins(maze, device, layout);
            superCoins = generateSuperCoins(maze, PST_SUPER_COIN_COUNT);
        }
        
        if (data.ghosts)
        {
            remoteGhosts = data.ghosts;
        }
        
        if (data.maxLevel)
        {
            maxLevel = data.maxLevel;
        }
        
        pacman.tileX = 3;
        pacman.tileY = 3;
        pacman.setDirection(1, 0);
        ghostsHidden = false;
        serverFruit = null;
        
        updateUI();
        showReadyMessage();
        console.log('Game reset to level 1');
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

    const levelEl = document.createElement('div');

    levelEl.style.cssText = 'position:fixed;top:70px;left:10px;color:#FFD700;font:20px monospace;z-index:10;text-shadow:1px 1px 3px black;';
    document.body.appendChild(levelEl);

    const restartBtn = document.createElement('button');
    restartBtn.id = 'restart-btn';
    restartBtn.textContent = 'Restart';
    restartBtn.style.cssText = `
        position:fixed;
        bottom:20px;
        right:20px;
        padding:12px 24px;
        background:rgba(255,215,0,0.2);
        color:#FFD700;
        border:2px solid #FFD700;
        border-radius:8px;
        font:18px monospace;
        cursor:pointer;
        z-index:50;
        text-shadow:0 0 10px rgba(255,215,0,0.3);
        transition: all 0.3s ease;
        display:none;
    `;
    restartBtn.onmouseover = () =>
    {
        restartBtn.style.background = 'rgba(255,215,0,0.3)';
        restartBtn.style.transform = 'scale(1.05)';
    };
    restartBtn.onmouseout = () => {
        restartBtn.style.background = 'rgba(255,215,0,0.2)';
        restartBtn.style.transform = 'scale(1)';
    };
    restartBtn.onclick = () => {
        if (socket && socket.connected)
        {
            socket.emit('resetGame');
            isWinner = false;
            showWinnerScreen = false;
            gameOver = false;
            isDying = false;
            lives = 3;
            score = 0;
            currentLevel = 1;
            pacman.tileX = 3;
            pacman.tileY = 3;
            pacman.setDirection(1, 0);
            ghostsHidden = false;
            serverFruit = null;
            
            const winnerMsg = document.getElementById('winner-message');
            if (winnerMsg)           
              winnerMsg.remove();
            const youWonMsg = document.getElementById('you-won-message');
            if (youWonMsg)
               youWonMsg.remove();
            
            const level1Map = LEVEL_MAPS ? LEVEL_MAPS[1] : null;
            if (level1Map)
            {
                maze.setGrid(level1Map);
                rebuildMazeMesh(maze, device);
                coins = rebuildCoins(maze, device, layout);
                superCoins = generateSuperCoins(maze, PST_SUPER_COIN_COUNT);
            }
            
            restartBtn.style.display = 'none';
            updateUI();
            showReadyMessage();
            
            console.log('Game restarted to level 1');
        }
    };
    document.body.appendChild(restartBtn);

    const fruitSprites = {};
    const fruitNames = ['cherry', 'strawberry', 'orange', 'apple', 'melon', 'bell', 'key', 'boss'];

    const coinSprite = new Pst_Sprite();

    try
    {
        await coinSprite.loadFromFile(device, null, format, `/targets/pill.png`);
        coinSprite.frames = 1;
        console.log('coinSprite loaded successfully!');
    }
    catch (err)
    {
        console.error('Failed to load pill.png:', err);
    }

    superCoinSprites = [];
    const superCoinColors = ['gold', 'diamond', 'ruby', 'emerald', 'sapphire'];

    for (let i = 0; i < superCoinColors.length; i++)
    {
        try
        {
            const s = new Pst_Sprite();

            await s.loadFromFile(device, null, format, `/targets/pill.png`);
            s.frames = 1;
            superCoinSprites.push(s);
        }
        catch (err)
        {
            console.warn('Failed to load super coin sprite:', err);
            if (coinSprite.texture)
                superCoinSprites.push(coinSprite);
        }
    }

    if (superCoinSprites.length === 0 && coinSprite.texture)
    {
        for (let i = 0; i < PST_SUPER_COIN_COUNT; i++)
            superCoinSprites.push(coinSprite);
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

    const framePaths =
    [
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

    const readySprite = new Pst_Sprite();

    try
    {
        await readySprite.loadFromFile(device, null, format, `/targets/ready.png`);
        readySprite.frames = 1;
        console.log('Ready sprite loaded successfully!');
    }
    catch (err)
    {
        console.warn('Failed to load ready sprite:', err);
    }

    const mazeUB = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const mazeBG = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: mazeUB } }] });

    const coinShader = device.createShaderModule({
        code: `
            struct Uniforms
            {
                model: mat4x4f,
            }
            @group(0) @binding(0) var<uniform> u: Uniforms;

            @vertex
            fn vs(@location(0) pos: vec3f) -> @builtin(position) vec4f
            {
                return u.model * vec4f(pos, 1.0);
            }

            @fragment
            fn fs() -> @location(0) vec4f
            {
                return vec4f(1.0, 0.8, 0.0, 1.0);
            }
        `
    });
    const coinPipeline = pst_createPipeline(device, coinShader, layout, format);
 //   const coinUB = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  //  const coinBG = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: coinUB } }] });

    let coins = rebuildCoins(maze, device, layout);

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

    for (let i = 0; i < PST_MAX_PLAYERS; i++)
    {
        const colorIndex = i % playerColors.length;
        const r = playerColors[colorIndex][0];
        const g = playerColors[colorIndex][1];
        const b = playerColors[colorIndex][2];

        const sh = device.createShaderModule({
            code: `
                struct Uniforms
                {
                    model: mat4x4f,
                }
                @group(0) @binding(0) var<uniform> u: Uniforms;

                @vertex
                fn vs(@location(0) pos: vec3f) -> @builtin(position) vec4f
                {
                    return u.model * vec4f(pos, 1.0);
                }

                @fragment
                fn fs() -> @location(0) vec4f
                {
                    return vec4f(${r}, ${g}, ${b}, 0.4);
                }
            `
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

    if (playerVS % 4)
        playerVS += 4 - playerVS % 4;

    let playerIS = playerPrim.indices.byteLength;

    if (playerIS % 4)
        playerIS += 4 - playerIS % 4;

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

    socket.on('init', (data) =>
    {
        myId = data.id;
        console.log('My ID:', myId);

        if (data.maxLevel)
        {
            maxLevel = data.maxLevel;
        }

        restartBtn.style.display = 'block';

        for (const key in nicknameLabels)
            removeNicknameLabel(key);

        for (const key in remotePlayers)
            delete remotePlayers[key];

        if (Array.isArray(data.players))
        {
            for (let i = 0; i < data.players.length; i++)
            {
                const p = data.players[i];

                if (p.id !== myId)
                {
                    remotePlayers[p.id] =
                    {
                        nickname: p.nickname || 'Player',
                        pacman:
                        {
                            x: (p.pacman && typeof p.pacman.x === 'number') ? p.pacman.x : 3,
                            y: (p.pacman && typeof p.pacman.y === 'number') ? p.pacman.y : 3
                        },
                        score: p.score || 0,
                        lives: p.lives || 3,
                        level: p.level || 1,
                        isWinner: p.isWinner || false
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

        if (data.level)
            currentLevel = data.level;

        if (data.mazeGrid)
        {
            maze.setGrid(data.mazeGrid);
            rebuildMazeMesh(maze, device);
            coins = rebuildCoins(maze, device, layout);
            superCoins = generateSuperCoins(maze, PST_SUPER_COIN_COUNT);
        }
        showReadyMessage();
    });

    socket.on('levelUp', (data) =>
    {
        currentLevel = data.level;
        
        if (data.maxLevel)
        {
            maxLevel = data.maxLevel;
        }

        if (!levelTransition)
        {
            levelTransition = true;
            levelTransitionTimer = PST_LEVEL_TRANSITION_DURATION;
        }

        if (data.mazeGrid)
        {
            maze.setGrid(data.mazeGrid);
        }
        
        rebuildMazeMesh(maze, device);
        coins = rebuildCoins(maze, device, layout);
        superCoins = generateSuperCoins(maze, PST_SUPER_COIN_COUNT);

        if (data.ghosts && Array.isArray(data.ghosts))
        {
            remoteGhosts = data.ghosts.filter(function(g)
            {
                return g && typeof g.x === 'number' && typeof g.y === 'number';
            });
        }

        pacman.tileX = 3;
        pacman.tileY = 3;
        pacman.setDirection(1, 0);
        ghostsHidden = false;
        serverFruit = null;

        console.log('Level up! Now on level ' + currentLevel);
    });

    socket.on('levelData', (data) =>
    {
        if (data.level)
            currentLevel = data.level;

        if (data.mazeGrid)
        {
            maze.setGrid(data.mazeGrid);
            rebuildMazeMesh(maze, device);
            coins = rebuildCoins(maze, device, layout);
            superCoins = generateSuperCoins(maze, PST_SUPER_COIN_COUNT);
        }

        if (data.ghosts && Array.isArray(data.ghosts))
        {
            remoteGhosts = data.ghosts.filter(function(g)
            {
                return g && typeof g.x === 'number' && typeof g.y === 'number';
            });
        }
    });

    socket.on('gameOver', (data) =>
    {
        if (data.id === myId)
        {
            gameOver = true;
            restartBtn.style.display = 'block';
            restartBtn.textContent = 'Restart';
            restartBtn.style.background = 'rgba(255,0,0,0.2)';
            restartBtn.style.borderColor = '#FF4444';
            restartBtn.style.color = '#FF4444';
        }
        if (remotePlayers[data.id])
        {
            remotePlayers[data.id].lives = 0;
        }
        updateUI();
    });

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

            showReadyMessage();

            if (socket && socket.connected)
                socket.emit('playerDied', { lives });

        }

        updateUI();
    }

    function checkCoinCollection()
    {
        if (isDying)
            return;

        const coinKey = `${Math.floor(pacman.tileX)},${Math.floor(pacman.tileY)}`;
        const coin = coinMap.get(coinKey);

        if (coin && !coin.collected)
        {
            coin.collected = true;
            score += 10;

            if (pacman.onEatCoin)
                pacman.onEatCoin();

            if (socket && socket.connected)
            {
                socket.emit('coinCollected',
                {
                    x: Math.floor(pacman.tileX),
                    y: Math.floor(pacman.tileY)
                });
            }

            const allCollected = coins.every(c => c.collected);
            if (allCollected && !levelTransition)
            {
                levelTransition = true;
                levelTransitionTimer = PST_LEVEL_TRANSITION_DURATION;
                ghostsHidden = true;
                console.log('All coins collected! Waiting for level up...');
            }
        }
    }

    function checkSuperCoinCollection()
    {
        if (isDying)
            return;

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
                        socket.emit('superCoinCollected', { x: superCoin.x, y: superCoin.y });
                    }

                    break;
                }
            }
        }
    }

    function checkFruitCollection()
    {
        if (isDying || !serverFruit || !serverFruit.alive)
            return;

        const dist = Math.sqrt(
            Math.pow(pacman.tileX + 0.5 - serverFruit.x - 0.5, 2) +
            Math.pow(pacman.tileY + 0.5 - serverFruit.y - 0.5, 2)
        );

        if (dist < 0.8)
        {
            score += serverFruit.points;

            if (socket && socket.connected)
            {
                socket.emit('fruitCollected', { x: serverFruit.x, y: serverFruit.y });
            }

            serverFruit = null;
        }
    }

    function checkGhostCollision()
    {
        if (invincibleTimer > 0 || isDying || ghostsHidden)
            return false;

        const pacmanX = pacman.tileX + 0.5;
        const pacmanY = pacman.tileY + 0.5;
        const collisionDistance = 0.8;

        if (!Array.isArray(remoteGhosts))
            return false;

        for (let i = 0; i < remoteGhosts.length; i++)
        {
            const ghost = remoteGhosts[i];

            if (!ghost || typeof ghost.x !== 'number' || typeof ghost.y !== 'number')
                continue;

            const dx = pacmanX - (ghost.x + 0.5);
            const dy = pacmanY - (ghost.y + 0.5);
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < collisionDistance)
                return true;
        }

        return false;
    }

    function getGhostFrame(dirX, dirY)
    {
        let base;

        if (dirY === 1)
            base = 0;
        else if (dirY === -1)
            base = 2;
        else if (dirX === 1)
            base = 6;
        else
            base = 4;

        const wiggle = Math.floor(performance.now() / 200) % 2;

        return base + wiggle;
    }

    function getPacmanFrame(dirX, dirY, mouthOpen)
    {
        let dirIndex;

        if (dirX === 1)
            dirIndex = 0;
        else if (dirY === 1)
            dirIndex = 1;
        else if (dirX === -1)
            dirIndex = 2;
        else
            dirIndex = 3;

        const mouthIndex = Math.min(2, Math.floor(mouthOpen * 4));

        return dirIndex * 3 + mouthIndex;
    }

    function updateUI()
    {
        const playerCount = Object.keys(remotePlayers).length;
        const remainingSuperCoins = superCoins.filter(function(c)
        {
            return !c.collected;
        }).length;

        if (isWinner)
        {
            scoreEl.textContent = `${nickname} | Score: ${score} | WINNER!`;
        }
        else
        {
            scoreEl.textContent = `${nickname} | Score: ${score} | Players: ${playerCount + 1} | Special: ${remainingSuperCoins}`;
        }
        levelEl.textContent = `Level: ${currentLevel}/${maxLevel}`;

        if (!gameOver && !isWinner)
        {
            restartBtn.style.display = 'block';
            restartBtn.textContent = '🔄 Restart';
            restartBtn.style.background = 'rgba(255,215,0,0.2)';
            restartBtn.style.borderColor = '#FFD700';
            restartBtn.style.color = '#FFD700';
        }

        if (gameOver)
        {
            livesEl.textContent = 'Lives: DEAD';
            const gameOverEl = document.getElementById('game-over');
            if (gameOverEl) gameOverEl.style.display = 'block';
            restartBtn.style.display = 'block';
            restartBtn.textContent = 'Restart';
            restartBtn.style.background = 'rgba(255,0,0,0.2)';
            restartBtn.style.borderColor = '#FF4444';
            restartBtn.style.color = '#FF4444';
        }
        else if (isWinner)
        {
            livesEl.textContent = 'VICTORY!';
            restartBtn.style.display = 'block';
            restartBtn.textContent = '🔄 Play Again';
            restartBtn.style.background = 'rgba(255,215,0,0.3)';
            restartBtn.style.borderColor = '#FFD700';
            restartBtn.style.color = '#FFD700';
        }
        else
        {
            livesEl.textContent = `Lives: ${'*'.repeat(Math.max(0, lives))}`;
        }
    }

    function showReadyMessage()
    {
        showReady = true;
        readyTimer = PST_READY_DURATION;
    }

    function loop()
    {
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.1);

        lastTime = now;

        if (showWinnerScreen)
        {
            winnerTimer -= dt;
            if (winnerTimer <= 0)
            {
                showWinnerScreen = false;

                if (socket && socket.connected)
                {
                    socket.emit('resetGame');
                }
            }
            updateUI();
            requestAnimationFrame(loop);
            return;
        }

        if (levelTransition)
        {
            levelTransitionTimer -= dt;

            if (levelTransitionTimer <= 0)
            {
                levelTransition = false;
                levelTransitionTimer = 0;
                ghostsHidden = false;
            }

            updateUI();
            requestAnimationFrame(loop);
            return;
        }

        if (isDying)
            updateDeathAnimation(dt);

        if (gameOver)
        {
            updateUI();
            requestAnimationFrame(loop);
            return;
        }

        if (invincibleTimer > 0)
            invincibleTimer -= dt;

        if (showReady)
        {
            readyTimer -= dt;
            
            if (readyTimer <= 0)
            {
                showReady = false;
                readyTimer = 0;
            }
        }

        if (!isDying)
        {
            if (kb.isDown('ArrowRight'))
                pacman.setDirection(1, 0);

            if (kb.isDown('ArrowLeft'))
                pacman.setDirection(-1, 0);

            if (kb.isDown('ArrowUp'))
                pacman.setDirection(0, 1);

            if (kb.isDown('ArrowDown'))
                pacman.setDirection(0, -1);

            pacman.update(dt);

            if (pacman.tileX < 1)
                pacman.tileX = 1;

            if (pacman.tileX >= maze.width - 1)
                pacman.tileX = maze.width - 2;

            if (pacman.tileY < 1)
                pacman.tileY = 1;

            if (pacman.tileY >= maze.height - 1)
                pacman.tileY = maze.height - 2;

            checkCoinCollection();
            checkSuperCoinCollection();
            checkFruitCollection();

            if (checkGhostCollision())
                handleGhostCollision();
        }

        sendTimer += dt;

        if (sendTimer > 0.1)
        {
            sendTimer = 0;

            if (socket && socket.connected && !isDying)
            {
                score += 10;
                socket.emit('move', {
                    pacman: { x: pacman.tileX, y: pacman.tileY },
                    score,
                    lives,
                    level: currentLevel
                });
            }
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
                coin.updateMatrix(scaleX, scaleY);
        }

        maze.draw(device, pass, mazePipeline, mazeBG, mazeUB, scaleX, scaleY);

        for (let i = 0; i < coins.length; i++)
        {
            const coin = coins[i];

            if (!coin.collected)
                coin.draw(device, pass, coinPipeline);
        }

        const currentTime = performance.now() / 1000;

        for (let i = 0; i < superCoins.length; i++)
        {
            const superCoin = superCoins[i];

            if (!superCoin.collected && i < superCoinSprites.length && superCoinSprites[i])
            {
                const pulseScale = 1 + Math.sin(currentTime * 2 + superCoin.pulsePhase) * 0.2;
                const rotation = currentTime * 0.5 + superCoin.rotation;

                superCoinSprites[i].draw(
                    device, pass, scaleX, scaleY,
                    superCoin.x + 0.5, superCoin.y + 0.5,
                    rotation,
                    PST_SUPER_COIN_SIZE * pulseScale * scaleX + 0.8,
                    PST_SUPER_COIN_SIZE * pulseScale * scaleY + 0.8,
                    0
                );
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

        if (!ghostsHidden && !levelTransition)
        {
            const ghostFrameSets = [redFrames, blueFrames, orangeFrames, pinkFrames, blinkyFrames, phantomFrames];

            if (Array.isArray(remoteGhosts))
            {
                for (let i = 0; i < remoteGhosts.length; i++)
                {
                    const g = remoteGhosts[i];

                    if (!g || typeof g.x !== 'number' || typeof g.y !== 'number')
                        continue;

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

            if (rp.level !== undefined && rp.level !== currentLevel)
                continue;

            const isWinnerPlayer = rp.isWinner || false;

            const colorIdx = hashCode(id) % PST_MAX_PLAYERS;

            if (colorIdx < playerUBs.length)
            {
                model.fill(0);
                const scale = isWinnerPlayer ? 0.6 : 0.45;
                model[0] = scaleX * scale;
                model[5] = scaleY * scale;
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

            const mouthOpen = Math.abs(Math.sin(Date.now() / 200)) * 0.8;
            const frame = getPacmanFrame(1, 0, mouthOpen);

            if (pacmanFrames[frame])
            {
                pacmanFrames[frame].draw(
                    device, pass, scaleX, scaleY,
                    rp.pacman.x + 0.5, rp.pacman.y + 0.5,
                    0, isWinnerPlayer ? 0.7 : 0.55, isWinnerPlayer ? 0.7 : 0.55, 0
                );
            }

            updateNicknameLabel(id, rp);
        }

        const activeIds = new Set(Object.keys(remotePlayers));

        for (const id in nicknameLabels)
        {
            if (!activeIds.has(id))
            {
                removeNicknameLabel(id);
            }
            else if (remotePlayers[id] && remotePlayers[id].level !== undefined && remotePlayers[id].level !== currentLevel)
            {
                removeNicknameLabel(id);
            }
        }

        if (serverFruit && serverFruit.alive && fruitSprites[serverFruit.name])
        {
            fruitSprites[serverFruit.name].draw(device, pass, scaleX, scaleY,
                serverFruit.x + 0.5, serverFruit.y + 0.5,
                0, 0.5, 0.5, 0);
        }

        if (showReady && readySprite.texture)
        {
            const centerX = worldW / 2;
            const centerY = worldH / 2;
            
            readySprite.draw(device, pass, scaleX, scaleY,
                centerX, centerY,
                0, 2.5, 2.5, 0);
        }

        pass.end();
        device.queue.submit([encoder.finish()]);
        kb.endFrame();
        updateUI();
        requestAnimationFrame(loop);
    }
    console.log('PST: Maze ready', maze.width, 'x', maze.height);
    gameReady = true;
    
    if (socket.connected)
    {
        console.log('Sending initial register...');
        socket.emit('register', { nickname: nickname });
    }
    
    loop();
})();