const http = require("http");
const express = require("express");
const logger = require("morgan");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 8080;

app.use(logger("dev"));
app.use(cookieParser());

app.use('/socket.io', express.static(path.join(__dirname, 'node_modules/socket.io/client-dist')));

app.use(express.static(path.join(__dirname, "dist")));
app.use(express.static(path.join(__dirname, "src")));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    const possiblePaths = [
        path.join(__dirname, 'dist', 'pst_index.html'),
        path.join(__dirname, 'src', 'pst_index.html'),
        path.join(__dirname, 'pst_index.html')
    ];
    
    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
            return;
        }
    }
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pacman Multiplayer</title>
            <script src="/socket.io/socket.io.js"></script>
        </head>
        <body>
            <h1>🟡 Pacman Multiplayer</h1>
            <p>Server is running on port ${port}</p>
            <div id="status">Connecting...</div>
            <script>
                const socket = io();
                socket.on('connect', () => {
                    document.getElementById('status').innerHTML = '✅ Connected! ID: ' + socket.id;
                    document.getElementById('status').style.color = 'green';
                });
                socket.on('connect_error', (error) => {
                    document.getElementById('status').innerHTML = '❌ Connection error: ' + error.message;
                    document.getElementById('status').style.color = 'red';
                });
            </script>
        </body>
        </html>
    `);
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['polling', 'websocket']
});

let clients = {};
const ghosts = [
    { x: 5, y: 5, tx: 5, ty: 5, dirX: 1, dirY: 0, progress: 0, speed: 2, _lastDirX: 1, _lastDirY: 0, type: 'red' },
    { x: 15, y: 3, tx: 15, ty: 3, dirX: -1, dirY: 0, progress: 0, speed: 2, _lastDirX: -1, _lastDirY: 0, type: 'blue' },
    { x: 10, y: 16, tx: 10, ty: 16, dirX: 0, dirY: 1, progress: 0, speed: 2, _lastDirX: 0, _lastDirY: 1, type: 'orange' },
    { x: 18, y: 14, tx: 18, ty: 14, dirX: 0, dirY: -1, progress: 0, speed: 2, _lastDirX: 0, _lastDirY: -1, type: 'pink' },
    { x: 25, y: 10, tx: 25, ty: 10, dirX: -1, dirY: 0, progress: 0, speed: 1.5, _lastDirX: -1, _lastDirY: 0, type: 'blinky' },
    { x: 3, y: 18, tx: 3, ty: 18, dirX: 0, dirY: -1, progress: 0, speed: 2.2, _lastDirX: 0, _lastDirY: -1, type: 'phantom' },
];

const mazeGrid = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,2,2,1],
    [1,2,1,0,1,2,1,0,0,0,1,2,1,0,2,0,0,2,1,0,0,0,1,2,1,0,1,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,2,2,1],
    [1,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1],
    [1,0,0,0,1,2,1,0,0,0,0,0,0,1,2,1,0,0,0,1,2,1,0,0,0,1,2,1,0,1],
    [1,1,1,0,1,2,1,1,1,1,1,1,0,1,2,1,0,1,1,1,2,1,1,1,0,1,2,1,0,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,2,2,1],
    [1,2,2,2,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,2,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1],
    [1,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

function isValidTile(x, y) {
    return x >= 0 && x < mazeGrid[0].length && y >= 0 && y < mazeGrid.length;
}

function findNearestValidTile(x, y) {
    const startX = Math.round(x);
    const startY = Math.round(y);
    for (let radius = 1; radius < 5; radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                const nx = startX + dx;
                const ny = startY + dy;
                if (isValidTile(nx, ny) && mazeGrid[ny][nx] !== 1) {
                    return { x: nx, y: ny };
                }
            }
        }
    }
    return { x: 15, y: 10 };
}

function getPlayersData() {
    const result = [];
    for (let id in clients) {
        result.push({
            id: id,
            nickname: clients[id].nickname || 'Player',
            pacman: clients[id].pacman || { x: 3, y: 3 },
            score: clients[id].score || 0,
            lives: clients[id].lives || 3
        });
    }
    return result;
}

function getGhostsData() {
    return ghosts.map(g => ({
        x: g.x, y: g.y,
        dirX: g._lastDirX || g.dirX || 0,
        dirY: g._lastDirY || g.dirY || 0,
        type: g.type
    }));
}

function broadcastToAll(event, data, excludeId = null) {
    for (let id in clients) {
        if (id !== excludeId) {
            clients[id].socket.emit(event, data);
        }
    }
}

setInterval(() => {
    if (Object.keys(clients).length === 0) return;

    for (const g of ghosts) {
        let closest = null, closestDist = Infinity;

        for (let id in clients) {
            const p = clients[id];
            const dx = g.x - p.pacman.x, dy = g.y - p.pacman.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
                closestDist = dist;
                closest = p;
            }
        }

        if (!closest) continue;

        const currentTileX = Math.round(g.x);
        const currentTileY = Math.round(g.y);
        
        if (!isValidTile(currentTileX, currentTileY) || mazeGrid[currentTileY][currentTileX] === 1) {
            const validPos = findNearestValidTile(g.x, g.y);
            g.x = validPos.x;
            g.y = validPos.y;
            g.tx = validPos.x;
            g.ty = validPos.y;
            g.progress = 0;
            continue;
        }

        if (g.progress <= 0.05) {
            g.tx = currentTileX;
            g.ty = currentTileY;
            g.progress = 0;
            
            const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            const validDirs = directions.filter(([dx, dy]) => {
                const nx = currentTileX + dx;
                const ny = currentTileY + dy;
                return isValidTile(nx, ny) && mazeGrid[ny][nx] !== 1;
            });

            if (validDirs.length === 0) continue;

            let possibleDirs = validDirs;
            if (validDirs.length > 1) {
                const noBackDirs = validDirs.filter(([dx, dy]) => {
                    return !(dx === -g._lastDirX && dy === -g._lastDirY);
                });
                if (noBackDirs.length > 0) possibleDirs = noBackDirs;
            }

            possibleDirs.sort((a, b) => {
                const distA = Math.hypot((currentTileX + a[0]) - closest.pacman.x, 
                                        (currentTileY + a[1]) - closest.pacman.y);
                const distB = Math.hypot((currentTileX + b[0]) - closest.pacman.x, 
                                        (currentTileY + b[1]) - closest.pacman.y);
                return distA - distB;
            });
            
            let chosenDir = Math.random() < 0.8 ? possibleDirs[0] : 
                possibleDirs[Math.floor(Math.random() * possibleDirs.length)];

            g.dirX = chosenDir[0];
            g.dirY = chosenDir[1];
            g._lastDirX = g.dirX;
            g._lastDirY = g.dirY;
        }

        if (g.dirX !== 0 || g.dirY !== 0) {
            const nextTileX = g.tx + g.dirX;
            const nextTileY = g.ty + g.dirY;
            
            if (isValidTile(nextTileX, nextTileY) && mazeGrid[nextTileY][nextTileX] !== 1) {
                g.progress += 0.06 * g.speed;
                if (g.progress >= 1.0) {
                    g.progress = 0;
                    g.tx = nextTileX;
                    g.ty = nextTileY;
                }
                g.x = g.tx + g.dirX * g.progress;
                g.y = g.ty + g.dirY * g.progress;
            } else {
                g.progress = 0;
            }
        }
    }

    const ghostData = getGhostsData();

    for (let id in clients) {
        clients[id].socket.emit('ghostsUpdate', { ghosts: ghostData });
    }
}, 50);

io.on("connection", (socket) =>
{
    console.log(`Client connected with id: ${socket.id}`);

    socket.on("register", (data) => {
        const name = data?.nickname?.trim() || 'Player';
        
        clients[socket.id] = { 
            socket, 
            nickname: name,
            pacman: { x: 3, y: 3 },
            score: 0,
            lives: 3
        };

        console.log(`Player registered: ${name} (${socket.id})`);

        socket.emit("init", {
            id: socket.id,
            players: getPlayersData(),
            ghosts: getGhostsData()
        });

        socket.broadcast.emit("newPlayer", {
            id: socket.id,
            nickname: name,
            pacman: { x: 3, y: 3 },
            score: 0,
            lives: 3
        });

        socket.emit("messageFromServer", `Welcome, ${name}!`);
    });

    socket.on("move", (data) => {
        const client = clients[socket.id];
        if (!client) return;

        client.pacman = data.pacman || { x: 3, y: 3 };
        client.score = data.score || 0;
        client.lives = data.lives || 3;

        socket.broadcast.emit("update", {
            id: socket.id,
            nickname: client.nickname,
            pacman: client.pacman,
            score: client.score,
            lives: client.lives
        });
    });

    socket.on("coinCollected", (data) => {
        socket.broadcast.emit("coinCollected", {
            x: data.x,
            y: data.y
        });
    });

    socket.on("playerDied", (data) => {
        const client = clients[socket.id];
        if (!client) return;

        client.lives = data.lives || 0;
        socket.broadcast.emit("playerDied", {
            id: socket.id,
            lives: client.lives
        });
    });

    socket.on("gameOver", (data) => {
        socket.broadcast.emit("gameOver", {
            id: socket.id,
            score: data.score || 0
        });
    });

    socket.on("setNickname", (data) => {
        const client = clients[socket.id];
        if (!client) return;

        const newName = data?.nickname?.trim() || 'Player';
        client.nickname = newName;

        broadcastToAll("nicknameUpdate", {
            id: socket.id,
            nickname: newName
        }, socket.id);
    });

    socket.on("messageToServer", (msg) => {
        const client = clients[socket.id];
        if (!client) return;

        console.log(`${client.nickname}: ${msg}`);
        broadcastToAll("messageFromServer", `${client.nickname}: ${msg}`);
    });

    socket.on("disconnect", () => {
        const client = clients[socket.id];
        console.log(`Client disconnected with id: ${socket.id}`);

        if (client) {
            broadcastToAll("playerLeft", { id: socket.id });
            broadcastToAll("messageFromServer", `${client.nickname} left`);
        }
        
        delete clients[socket.id];
    });
});

server.listen(port, "0.0.0.0", () =>
{
    console.log(`  http://localhost:${port}`);
    console.log(`  http://127.0.0.1:${port}`);
});