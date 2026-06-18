const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = 8080;
const HOST = '0.0.0.0';

const SEARCH_DIRS =
[
    path.join(__dirname, 'dist'),
    path.join(__dirname, 'src'),
    __dirname,
];

function findFile(urlPath)
{
    const cleanPath = urlPath.replace(/^\/+/, '');
    for (const dir of SEARCH_DIRS)
    {
        const fullPath = path.join(dir, cleanPath);
        try
        {
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile())
            {
                return fullPath;
            }
        }
        catch (e)
        {
           console.log(e);
        }
    }
    return null;
}

const server = http.createServer((req, res) =>
{
    console.log(`${req.method} ${req.url}`);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS')
    {
        res.writeHead(204);
        res.end();
        return;
    }
    
    let urlPath = req.url.split('?')[0];
    
    if (urlPath === '/' || urlPath === '')
    {
        urlPath = '/pst_index.html';
    }
    
    const filePath = findFile(urlPath);
    
    if (!filePath)
    {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>404</h1><p>${urlPath}</p>`);
        return;
    }
    
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.ico': 'image/x-icon',
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, data) =>
    {
        if (err)
        {
            res.writeHead(500);
            res.end('Error');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
        res.end(data);
    });
});

const wss = new WebSocketServer({ server });

const players = [];
const ghosts = [
    { x: 5, y: 5, tx: 5, ty: 5, dirX: 1, dirY: 0, progress: 0, speed: 2, path: null, _lastDirX: 1, _lastDirY: 0, pathRetryCounter: 0, type: 'red' },
    { x: 15, y: 3, tx: 15, ty: 3, dirX: -1, dirY: 0, progress: 0, speed: 2, path: null, _lastDirX: -1, _lastDirY: 0, pathRetryCounter: 0, type: 'blue' },
    { x: 10, y: 16, tx: 10, ty: 16, dirX: 0, dirY: 1, progress: 0, speed: 2, path: null, _lastDirX: 0, _lastDirY: 1, pathRetryCounter: 0, type: 'orange' },
    { x: 18, y: 14, tx: 18, ty: 14, dirX: 0, dirY: -1, progress: 0, speed: 2, path: null, _lastDirX: 0, _lastDirY: -1, pathRetryCounter: 0, type: 'pink' },
    { x: 25, y: 10, tx: 25, ty: 10, dirX: -1, dirY: 0, progress: 0, speed: 1.5, path: null, _lastDirX: -1, _lastDirY: 0, pathRetryCounter: 0, type: 'blinky' },     
    { x: 3, y: 18, tx: 3, ty: 18, dirX: 0, dirY: -1, progress: 0, speed: 2.2, path: null, _lastDirX: 0, _lastDirY: -1, name: 'Fantom' },
];

const mazeGrid =
[
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

function isValidTile(x, y)
{
    return x >= 0 && x < mazeGrid[0].length && y >= 0 && y < mazeGrid.length;
}

function bfs(sx, sy, gx, gy)
{
    const h = mazeGrid.length;
    const w = mazeGrid[0].length;

    sx = Math.round(sx); sy = Math.round(sy);
    gx = Math.round(gx); gy = Math.round(gy);

    if (!isValidTile(sx, sy) || !isValidTile(gx, gy))
       return null;
    if (mazeGrid[sy][sx] === 1 || mazeGrid[gy][gx] === 1)
       return null;

    const dist = Array.from({length: h}, () => Array(w).fill(-1));
    const prev = Array.from({length: h}, () => Array(w).fill(null));
    dist[sy][sx] = 0;
    const queue = [{x: sx, y: sy}];
    let found = false;

    while (queue.length > 0 && !found)
    {
        const {x, y} = queue.shift();

        if (x === gx && y === gy)
        {
           found = true;
           break;
        }
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]])
        {
           const nx = x + dx, ny = y + dy;

           if (isValidTile(nx, ny) && mazeGrid[ny][nx] !== 1 && dist[ny][nx] === -1) 
           {
               dist[ny][nx] = dist[y][x] + 1;
               prev[ny][nx] = {x, y};
               queue.push({x: nx, y: ny});
           }
        }
    }
    if (!found)
      return null;

    const path = [];
    let x = gx, y = gy;
    while (x !== sx || y !== sy)
    {
       path.unshift({x, y});
       const p = prev[y][x];
       if (!p)
         break;
       x = p.x;
       y = p.y;
    }
    return path;
}

wss.on('connection', (ws, req) =>
{
    console.log(`Player from ${req.socket.remoteAddress}`);
    
    const player =
    { 
        ws, 
        id: Date.now().toString(36),
        pacman: { x: 3, y: 3 },
        score: 0,
    };
    
    players.push(player);
    console.log(`Connected (Total: ${players.length})`);

    ws.send(JSON.stringify(
    {
        type: 'init',
        id: player.id,
        players: players.map(p => ({ id: p.id, pacman: p.pacman, score: p.score })),
        ghosts: ghosts.map(g => (
        {
            x: g.x, y: g.y,
            dirX: g._lastDirX || g.dirX || 0,
            dirY: g._lastDirY || g.dirY || 0,
            type: g.type || 'normal'
        }))
    }));

    for (const p of players)
    {
        if (p !== player && p.ws.readyState === 1)
        {
            p.ws.send(JSON.stringify({ type: 'newPlayer', id: player.id, pacman: player.pacman }));
        }
    }

    ws.on('message', (data) =>
    {
       try
       {
           const msg = JSON.parse(data);

           if (msg.type === 'move')
           {
              player.pacman = msg.pacman;
              player.score = msg.score || 0;
              for (const p of players)
              {
                  if (p !== player && p.ws.readyState === 1)
                  {
                     p.ws.send(JSON.stringify(
                     {
                         type: 'update', id: player.id,
                         pacman: player.pacman, score: player.score
                     }));
                  }
              }
           }
       }
       catch (e) 
       {
          console.log(e);  
       }
    });

    ws.on('close', () =>
    {
        const idx = players.indexOf(player);
        if (idx >= 0)
          players.splice(idx, 1);
        console.log(`Disconnected (Total: ${players.length})`);
    });
});

setInterval(() =>
{
    if (players.length === 0)
       return;
    for (const g of ghosts)
    {
        let closest = null, closestDist = Infinity;

        for (const p of players)
        {
            const dx = g.x - p.pacman.x, dy = g.y - p.pacman.y;
            const dist = dx * dx + dy * dy;

            if (dist < closestDist)
            {
               closestDist = dist;
               closest = p;
            }
        }
        if (!closest)
          continue;

        if (!g.path || g.path.length === 0 || g.pathRetryCounter >= 4)
        {
            g.path = bfs(Math.round(g.x), Math.round(g.y), Math.round(closest.pacman.x), Math.round(closest.pacman.y));

            g.pathRetryCounter = 0;
            if (!g.path || g.path.length === 0)
            {
               g.pathRetryCounter++;
               continue;
            }
        }

        if (g.progress <= 0 && g.path && g.path.length > 0)
        {
            const next = g.path[0];

            g.dirX = Math.sign(next.x - Math.round(g.tx));
            g.dirY = Math.sign(next.y - Math.round(g.ty));
            g._lastDirX = g.dirX;
            g._lastDirY = g.dirY;
            g.path.shift();
        }

        if (g.dirX !== 0 || g.dirY !== 0)
        {
            g.progress += 0.1 * g.speed;
            if (g.progress >= 1)
            {
               g.progress = 0;
               g.tx += g.dirX;
               g.ty += g.dirY;
            }
        }
        g.x = g.tx + g.dirX * g.progress;
        g.y = g.ty + g.dirY * g.progress;
    }

    const ghostData = ghosts.map(g =>
    ({
        x: g.x, y: g.y,
        dirX: g._lastDirX || g.dirX || 0,
        dirY: g._lastDirY || g.dirY || 0,
        type: g.type || 'normal'
    }));

    for (const p of players)
    {
        if (p.ws.readyState === 1)
           p.ws.send(JSON.stringify({ type: 'ghostsUpdate', ghosts: ghostData }));
    }
}, 50);

server.listen(PORT, HOST, () => 
{
   console.log(`  http://localhost:${PORT}`);
});