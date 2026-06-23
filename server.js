const http = require("http");
const express = require("express");
const logger = require("morgan");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 8080;

app.use(logger("dev"));
app.use(cookieParser());

app.use('/socket.io', express.static(path.join(__dirname, 'node_modules/socket.io/client-dist')));
app.use(express.static(path.join(__dirname, "dist")));
app.use(express.static(__dirname));

app.get('/', (req, res) =>
{
    if (fs.existsSync(path.join(__dirname, 'dist', 'pst_index.html')))
    {
        res.sendFile(path.join(__dirname, 'dist', 'pst_index.html'));
        return;
    }

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pacman Multiplayer</title>
            <script src="/socket.io/socket.io.js"></script>
        </head>
        <body>
            <h1>Pacman Multiplayer</h1>
            <p>Server is running on port ${PORT}</p>
            <div id="status">Connecting...</div>
            <script>
                const socket = io();
                socket.on('connect', () => {
                    document.getElementById('status').innerHTML = 'Connected! ID: ' + socket.id;
                    document.getElementById('status').style.color = 'green';
                });
                socket.on('connect_error', (error) => {
                    document.getElementById('status').innerHTML = 'Connection error: ' + error.message;
                    document.getElementById('status').style.color = 'red';
                });
            </script>
        </body>
        </html>
    `);
});

const server = http.createServer(app);
const io = new Server(server, {
    cors:
    {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['polling', 'websocket']
});

const PST_COINS_FOR_NEXT_LEVEL = 250;

const LEVEL_MAPS = {
    1: [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
        [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,2,1,2,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,2,1,2,1,1,2,1],
        [1,2,2,2,2,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,2,2,2,2,1],
        [1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1],
        [1,2,2,2,2,2,2,2,2,1,2,1,2,2,2,2,2,2,1,2,1,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,1,1,2,1,2,1,2,1,1,1,1,2,1,2,1,2,1,1,1,1,1,1,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,1,2,2,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,1,1,1,1,2,1,1,1,2,2,1,1,1,2,1,1,1,1,1,1,1,1,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    2: [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,1,1,2,2,1],
        [1,2,1,2,2,1,2,1,2,2,2,2,1,2,1,2,2,2,2,1,2,1,2,2,2,2,1,2,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,2,1,1,1,1,1,1,2,1,1,1,2,1,1,2,1,1,1,1,1,1,2,1,1,2,2,1],
        [1,2,1,2,2,2,2,2,2,1,2,1,2,2,2,2,1,2,1,2,2,2,2,1,2,2,2,2,2,1],
        [1,2,1,1,1,2,1,1,2,1,2,1,2,1,1,2,1,2,1,2,1,1,2,1,2,1,1,1,2,1],
        [1,2,2,2,2,2,1,1,2,2,2,2,2,2,1,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,2,2,1],
        [1,2,2,2,2,1,2,1,2,2,2,2,2,2,2,2,2,2,2,1,2,1,2,2,2,2,2,2,2,1],
        [1,1,1,2,1,1,2,1,2,1,1,1,1,1,1,1,1,1,2,1,2,1,1,2,1,1,1,1,1,1],
        [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,1,1,1,1,1,2,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,2,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,2,1,1,1,1,1,1,2,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    3: [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,1,2,2,1],
        [1,2,2,2,2,2,2,1,2,1,2,2,2,2,2,2,2,2,2,1,2,1,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,2,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,2,1,1,1,1,2,2,1],
        [1,2,2,2,2,1,2,1,2,2,2,1,2,2,2,2,2,1,2,2,2,1,2,1,2,2,2,2,2,1],
        [1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,1,2,1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,1,1,2,1],
        [1,2,1,2,2,2,1,2,1,2,2,2,2,2,2,2,2,2,2,2,1,2,1,2,2,2,2,2,2,1],
        [1,2,1,2,1,2,1,2,2,2,1,1,1,1,1,1,1,1,1,2,2,2,1,2,1,1,1,2,2,1],
        [1,2,1,2,1,2,1,1,1,2,1,2,2,2,2,2,2,2,1,2,1,1,1,2,1,2,2,2,2,1],
        [1,2,1,2,1,2,2,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,2,2,1,2,1,1,2,1],
        [1,2,1,2,1,1,1,2,1,2,1,2,1,2,2,2,1,2,1,2,1,2,1,1,1,2,1,2,2,1],
        [1,2,2,2,2,2,1,2,2,2,2,2,1,2,1,2,1,2,2,2,2,2,1,2,2,2,2,2,2,1],
        [1,2,1,1,1,2,1,1,1,1,1,1,1,2,1,2,1,1,1,1,1,1,1,2,1,1,1,1,2,1],
        [1,2,2,2,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,2,2,2,2,1],
        [1,1,1,2,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,2,1,1,1,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ]
};

const GHOST_TEMPLATES = {
    red: { type: 'red', startX: 5, startY: 5 },
    blue: { type: 'blue', startX: 24, startY: 5 },
    orange: { type: 'orange', startX: 5, startY: 14 },
    pink: { type: 'pink', startX: 24, startY: 14 },
    blinky: { type: 'blinky', startX: 14, startY: 9 },
    phantom: { type: 'phantom', startX: 14, startY: 10 }
};

const LEVEL_GHOST_CONFIGS = {
    1: ['red', 'blue', 'orange'],
    2: ['red', 'blue', 'orange', 'pink'],
    3: ['red', 'blue', 'orange', 'pink', 'blinky', 'phantom']
};

// const LEVEL_CONFIGS = {
//     1: { ghostSpeed: 1.5 },
//     2: { ghostSpeed: 2.0 },
//     3: { ghostSpeed: 2.5 }
// };

const PST_FRUIT_TYPES = [
    { name: 'cherry', points: 100 },
    { name: 'strawberry', points: 200 },
    { name: 'orange', points: 300 },
    { name: 'apple', points: 400 },
    { name: 'melon', points: 500 },
    { name: 'bell', points: 700 },
    { name: 'key', points: 1000 },
    { name: 'boss', points: 2000 }
];

let players = {};
let currentLevel = 1;
let currentMap = JSON.parse(JSON.stringify(LEVEL_MAPS[currentLevel]));

let currentFruit = null;
let fruitSpawnTimer = 10;
let fruitLifeTimer = 15;

let gameWinner = null;

function createGhostsForLevel(level)
{
    const config = LEVEL_GHOST_CONFIGS[level] || LEVEL_GHOST_CONFIGS[1];
    const ghostSpeed = getGhostSpeed(level);
    const newGhosts = [];

    for (let i = 0; i < config.length; i++)
    {
        const template = GHOST_TEMPLATES[config[i]];
        if (template)
        {
            newGhosts.push({
                x: template.startX,
                y: template.startY,
                tx: template.startX,
                ty: template.startY,
                dirX: 1,
                dirY: 0,
                progress: 0,
                speed: ghostSpeed,
                lastDirX: 1,
                lastDirY: 0,
                type: template.type
            });
        }
    }

    return newGhosts;
}

function isTileValid(map, x, y)
{
    return x >= 0 && x < map[0].length && y >= 0 && y < map.length;
}

function isTileWall(map, x, y)
{
    if (!isTileValid(map, x, y))
    {
        return true;
    }
    return map[y][x] === 1;
}

function findNearestFreeTile(map, x, y)
{
    const startX = Math.round(x);
    const startY = Math.round(y);

    for (let radius = 1; radius < 10; radius++)
    {
        for (let dy = -radius; dy <= radius; dy++)
        {
            for (let dx = -radius; dx <= radius; dx++)
            {
                if (Math.abs(dx) !== radius && Math.abs(dy) !== radius)
                {
                    continue;
                }
                
                const newX = startX + dx;
                const newY = startY + dy;
                
                if (isTileValid(map, newX, newY) && !isTileWall(map, newX, newY))
                {
                    return { x: newX, y: newY };
                }
            }
        }
    }
    return { x: 15, y: 10 };
}

function spawnNewFruit(map)
{
    const emptyCells = [];
    for (let y = 1; y < map.length - 1; y++)
    {
        for (let x = 1; x < map[y].length - 1; x++)
        {
            if (map[y][x] === 0)
            {
                emptyCells.push({ x, y });
            }
        }
    }

    if (emptyCells.length === 0)
    {
        return null;
    }

    const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const fruitType = PST_FRUIT_TYPES[Math.floor(Math.random() * PST_FRUIT_TYPES.length)];

    return {
        x: cell.x,
        y: cell.y,
        name: fruitType.name,
        points: fruitType.points,
        alive: true
    };
}

function getAllPlayersData()
{
    const result = [];
    for (let id in players)
    {
        result.push({
            id: id,
            nickname: players[id].nickname || 'Player',
            pacman: players[id].pacman || { x: 3, y: 3 },
            score: players[id].score || 0,
            lives: players[id].lives || 3,
            level: players[id].playerLevel || 1,
            isWinner: players[id].isWinner || false
        });
    }
    return result;
}

function getGhostSpeed(level)
{
    const baseSpeed = 1.5;
    const speedPerLevel = 0.3;
    const maxSpeed = 4.0;
    return Math.min(baseSpeed + (level - 1) * speedPerLevel, maxSpeed);
}

function broadcastToAll(event, data, excludeId)
{
    for (let id in players)
    {
        if (id !== excludeId)
        {
            players[id].socket.emit(event, data);
        }
    }
}

function checkWinCondition(playerId)
{
    const player = players[playerId];

    if (!player)
      return false;

    const maxLevel = Object.keys(LEVEL_MAPS).length;
    if (player.playerLevel === maxLevel && player.collectedCoins >= PST_COINS_FOR_NEXT_LEVEL)
        return true;

    return false;
}

function declareWinner(playerId)
{
    const player = players[playerId];
    if (!player)
      return;

    player.isWinner = true;
    gameWinner = playerId;

    broadcastToAll("gameWinner", 
    {
        id: playerId,
        nickname: player.nickname,
        score: player.score
    });

    player.socket.emit("youWon",
    {
        score: player.score,
        level: player.playerLevel
    });

    console.log('Player ' + player.nickname + ' won the game!');
}

function resetGameForPlayer(playerId)
{
    const player = players[playerId];

    if (!player)
      return;

    player.playerLevel = 1;
    player.playerMap = JSON.parse(JSON.stringify(LEVEL_MAPS[1]));
    player.collectedCoins = 0;
    player.pacman = { x: 3, y: 3 };
    player.ghosts = createGhostsForLevel(1);
    player.isWinner = false;
    player.score = 0;
    player.lives = 3;

    const ghostData = player.ghosts.map(g => ({
        x: g.x,
        y: g.y,
        dirX: g.lastDirX || g.dirX || 0,
        dirY: g.lastDirY || g.dirY || 0,
        type: g.type
    }));

    player.socket.emit("gameReset",
    {
        level: 1,
        mazeGrid: player.playerMap,
        ghosts: ghostData,
        coinsForNextLevel: PST_COINS_FOR_NEXT_LEVEL,
        collectedCoins: 0,
        score: 0,
        lives: 3,
        maxLevel: Object.keys(LEVEL_MAPS).length
    });

    console.log('Player ' + player.nickname + ' reset game to level 1');
}

function updatePlayerGhosts(playerId)
{
    const player = players[playerId];

    if (!player)
      return;

    const level = player.playerLevel;
    const map = player.playerMap;
    const ghostSpeed = getGhostSpeed(level);
    const config = LEVEL_GHOST_CONFIGS[level] || LEVEL_GHOST_CONFIGS[1];

    if (!player.ghosts)
    {
        player.ghosts = createGhostsForLevel(level);
    }

    const activeGhosts = player.ghosts.slice(0, config.length);

    for (let i = 0; i < activeGhosts.length; i++)
    {
        const ghost = activeGhosts[i];

        ghost.speed = ghostSpeed;

        const currentTileX = Math.round(ghost.x);
        const currentTileY = Math.round(ghost.y);

        if (!isTileValid(map, currentTileX, currentTileY) || isTileWall(map, currentTileX, currentTileY))
        {
            const validPos = findNearestFreeTile(map, ghost.x, ghost.y);

            ghost.x = validPos.x;
            ghost.y = validPos.y;
            ghost.tx = validPos.x;
            ghost.ty = validPos.y;
            ghost.progress = 0;
            continue;
        }

        if (ghost.progress <= 0.05)
        {
            ghost.tx = currentTileX;
            ghost.ty = currentTileY;
            ghost.progress = 0;

            const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            const validDirections = [];

            for (let d = 0; d < directions.length; d++)
            {
                const newX = currentTileX + directions[d][0];
                const newY = currentTileY + directions[d][1];

                if (isTileValid(map, newX, newY) && !isTileWall(map, newX, newY))
                    validDirections.push(directions[d]);
            }

            if (validDirections.length === 0)
                continue;

            let possibleDirections = validDirections;

            if (validDirections.length > 1)
            {
                const noBackDirections = [];

                for (let d = 0; d < validDirections.length; d++)
                {
                    const dir = validDirections[d];

                    if (!(dir[0] === -ghost.lastDirX && dir[1] === -ghost.lastDirY))
                        noBackDirections.push(dir);
                }
                if (noBackDirections.length > 0)
                    possibleDirections = noBackDirections;
            }

            possibleDirections.sort((a, b) =>
            {
                const distA = Math.hypot((currentTileX + a[0]) - player.pacman.x,
                                        (currentTileY + a[1]) - player.pacman.y);
                const distB = Math.hypot((currentTileX + b[0]) - player.pacman.x,
                                        (currentTileY + b[1]) - player.pacman.y);
                return distA - distB;
            });

            let chosenDirection;
            if (Math.random() < 0.8)
                chosenDirection = possibleDirections[0];
            else
                chosenDirection = possibleDirections[Math.floor(Math.random() * possibleDirections.length)];

            ghost.dirX = chosenDirection[0];
            ghost.dirY = chosenDirection[1];
            ghost.lastDirX = ghost.dirX;
            ghost.lastDirY = ghost.dirY;
        }

        if (ghost.dirX !== 0 || ghost.dirY !== 0)
        {
            const nextTileX = ghost.tx + ghost.dirX;
            const nextTileY = ghost.ty + ghost.dirY;

            if (isTileValid(map, nextTileX, nextTileY) && !isTileWall(map, nextTileX, nextTileY))
            {
                ghost.progress += 0.06 * ghost.speed;
                
                if (ghost.progress >= 1.0)
                {
                    ghost.progress = 0;
                    ghost.tx = nextTileX;
                    ghost.ty = nextTileY;
                }

                ghost.x = ghost.tx + ghost.dirX * ghost.progress;
                ghost.y = ghost.ty + ghost.dirY * ghost.progress;
            }
            else
            {
                ghost.progress = 0;
                ghost.dirX = 0;
                ghost.dirY = 0;
            }
        }
    }

    const ghostData = activeGhosts.map(g => ({
        x: g.x,
        y: g.y,
        dirX: g.lastDirX || g.dirX || 0,
        dirY: g.lastDirY || g.dirY || 0,
        type: g.type
    }));

    player.socket.emit('ghostsUpdate', { ghosts: ghostData, level: level });
}

setInterval(() =>
{
    if (Object.keys(players).length === 0)
        return;

    for (let id in players)
        updatePlayerGhosts(id);

    fruitSpawnTimer -= 0.05;

    if (!currentFruit || !currentFruit.alive)
    {
        if (fruitSpawnTimer <= 0)
        {
            currentFruit = spawnNewFruit(currentMap);
            fruitSpawnTimer = 10 + Math.random() * 20;
            fruitLifeTimer = 15;
            
            if (currentFruit)
            {
                broadcastToAll("fruitSpawned",
                {
                    x: currentFruit.x,
                    y: currentFruit.y,
                    name: currentFruit.name,
                    points: currentFruit.points
                });
            }
        }
    }
    else
    {
        fruitLifeTimer -= 0.05;
        if (fruitLifeTimer <= 0)
        {
            currentFruit.alive = false;
            broadcastToAll("fruitExpired",
            {
                x: currentFruit.x,
                y: currentFruit.y
            });
            currentFruit = null;
            fruitSpawnTimer = 10 + Math.random() * 20;
        }
    }
}, 50);

io.on("connection", (socket) =>
{
    console.log('Client connected: ' + socket.id);

    socket.on("register", (data) =>
    {
        const nickname = (data && data.nickname && data.nickname.trim()) || 'Player';

        const playerLevel = currentLevel;
        const playerMap = JSON.parse(JSON.stringify(LEVEL_MAPS[playerLevel]));

        players[socket.id] =
        {
            socket: socket,
            nickname: nickname,
            pacman: { x: 3, y: 3 },
            score: 0,
            lives: 3,
            collectedCoins: 0,
            playerLevel: playerLevel,
            playerMap: playerMap,
            ghosts: createGhostsForLevel(playerLevel),
            isWinner: false
        };

        console.log('Player registered: ' + nickname + ' (' + socket.id + ')');

        const ghostData = players[socket.id].ghosts.map(g => ({
            x: g.x,
            y: g.y,
            dirX: g.lastDirX || g.dirX || 0,
            dirY: g.lastDirY || g.dirY || 0,
            type: g.type
        }));

        socket.emit("init",
        {
            id: socket.id,
            players: getAllPlayersData(),
            ghosts: ghostData,
            level: playerLevel,
            mazeGrid: playerMap,
            coinsForNextLevel: PST_COINS_FOR_NEXT_LEVEL,
            collectedCoins: players[socket.id].collectedCoins,
            maxLevel: Object.keys(LEVEL_MAPS).length
        });

        if (currentFruit && currentFruit.alive)
        {
            socket.emit("fruitSpawned", {
                x: currentFruit.x,
                y: currentFruit.y,
                name: currentFruit.name,
                points: currentFruit.points
            });
        }

        socket.broadcast.emit("newPlayer", {
            id: socket.id,
            nickname: nickname,
            pacman: { x: 2, y: 3 },
            score: 0,
            lives: 3,
            level: 1
        });

        socket.emit("messageFromServer", 'Welcome, ' + nickname + '!');
    });

    socket.on("move", (data) =>
    {
        const player = players[socket.id];
        if (!player)
            return;
        
        player.pacman = data.pacman || { x: 3, y: 3 };
        player.score = data.score || 0;
        player.lives = data.lives || 3;
        if (typeof data.level === 'number')
            player.playerLevel = data.level;

        socket.broadcast.emit("update", {
            id: socket.id,
            nickname: player.nickname,
            pacman: player.pacman,
            score: player.score,
            lives: player.lives,
            level: player.playerLevel,
            isWinner: player.isWinner || false
        });
    });

    socket.on("coinCollected", (data) =>
    {
        const x = Math.round(data.x);
        const y = Math.round(data.y);
        const player = players[socket.id];

        if (!player)
            return;

        const playerMap = player.playerMap;
        
        if (isTileValid(playerMap, x, y) && playerMap[y] && playerMap[y][x] === 2)
        {
            playerMap[y][x] = 0;
            player.collectedCoins++;

            socket.emit("coinProgress", {
                collected: player.collectedCoins,
                needed: PST_COINS_FOR_NEXT_LEVEL
            });

            if (player.collectedCoins >= PST_COINS_FOR_NEXT_LEVEL)
            {
                if (checkWinCondition(socket.id))
                {
                    declareWinner(socket.id);
                    return;
                }

                if (player.playerLevel < Object.keys(LEVEL_MAPS).length)
                    player.playerLevel++;
                else
                    player.playerLevel = 1;

                player.playerMap = JSON.parse(JSON.stringify(LEVEL_MAPS[player.playerLevel]));
                player.collectedCoins = 0;
                player.pacman = { x: 3, y: 3 };
                player.ghosts = createGhostsForLevel(player.playerLevel);

                const ghostData = player.ghosts.map(g => ({
                    x: g.x,
                    y: g.y,
                    dirX: g.lastDirX || g.dirX || 0,
                    dirY: g.lastDirY || g.dirY || 0,
                    type: g.type
                }));

                socket.emit("levelUp", {
                    level: player.playerLevel,
                    mazeGrid: player.playerMap,
                    ghosts: ghostData,
                    coinsForNextLevel: PST_COINS_FOR_NEXT_LEVEL,
                    collectedCoins: 0,
                    maxLevel: Object.keys(LEVEL_MAPS).length
                });

                console.log('Player ' + player.nickname + ' advanced to level ' + player.playerLevel);
            }
        }
    });

    socket.on("superCoinCollected", (data) =>
    {
        socket.broadcast.emit("superCoinCollected", {
            x: data.x,
            y: data.y
        });
    });

    socket.on("fruitCollected", (data) =>
    {
        if (currentFruit && currentFruit.alive &&
            Math.abs(currentFruit.x - data.x) < 0.5 &&
            Math.abs(currentFruit.y - data.y) < 0.5)
        {
            currentFruit.alive = false;
            
            const player = players[socket.id];
            
            if (player)
                player.score = (player.score || 0) + currentFruit.points;

            broadcastToAll("fruitCollected", {
                x: currentFruit.x,
                y: currentFruit.y,
                points: currentFruit.points,
                playerId: socket.id
            });

            currentFruit = null;
            fruitSpawnTimer = 10 + Math.random() * 20;
        }
    });

    socket.on("playerDied", (data) =>
    {
        const player = players[socket.id];

        if (!player)
            return;

        player.lives = data.lives || 0;
        socket.broadcast.emit("playerDied", {
            id: socket.id,
            lives: player.lives
        });
    });

    socket.on("gameOver", (data) =>
    {
        socket.broadcast.emit("gameOver", {
            id: socket.id,
            score: data.score || 0
        });
    });

    socket.on("setNickname", (data) =>
    {
        const player = players[socket.id];

        if (!player)
            return;

        const newName = (data && data.nickname && data.nickname.trim()) || 'Player';
        player.nickname = newName;

        broadcastToAll("nicknameUpdate",
        {
            id: socket.id,
            nickname: newName
        }, socket.id);
    });

    socket.on("messageToServer", (msg) =>
    {
        const player = players[socket.id];

        if (!player)
            return;

        console.log(player.nickname + ': ' + msg);
        broadcastToAll("messageFromServer", player.nickname + ': ' + msg);
    });

    socket.on("resetGame", () =>
    {
        const player = players[socket.id];

        if (!player)
          return;

        resetGameForPlayer(socket.id);
        console.log('Player ' + player.nickname + ' reset the game');
    });

    socket.on("disconnect", () =>
    {
        const player = players[socket.id];

        console.log('Client disconnected: ' + socket.id);

        if (player)
        {
            broadcastToAll("playerLeft", { id: socket.id });
            broadcastToAll("messageFromServer", player.nickname + ' left');
        }

        delete players[socket.id];
    });
});

server.listen(PORT, "0.0.0.0", () =>
{
    console.log('Server started on port ' + PORT);
    console.log('http://localhost:' + PORT);
    console.log('http://127.0.0.1:' + PORT);
    console.log(PST_COINS_FOR_NEXT_LEVEL + ' coins needed for next level');
});