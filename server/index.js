const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const httpProxy = require('http-proxy');

const app = express();
const server = http.createServer(app);
const proxy = httpProxy.createProxyServer({});

const activePorts = new Map();
let portCounter = 3001;

const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "https://cloudide-chi.vercel.app",
            /\.vercel\.app$/  
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use((req, res, next) => {
    const allowedOrigins = [
        'http://localhost:3000',
        'https://cloudide-chi.vercel.app'
    ];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin) || (origin && origin.endsWith('.vercel.app'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', connections: activePorts.size });
});

app.use('/preview/:socketId', (req, res) => {
    const socketId = req.params.socketId;
    const targetPort = activePorts.get(socketId);
    
    if (!targetPort) {
        return res.status(404).send(`
            <body style="background:#111; color:#555; font-family:monospace; display:flex; justify-content:center; align-items:center; height:100vh;">
                <h2>No server running for this session.</h2>
            </body>
        `);
    }
    
    proxy.web(req, res, { target: `http://localhost:${targetPort}` }, (err) => {
        if (err) {
            res.status(502).send(`
                <body style="background:#111; color:#f55; font-family:monospace; display:flex; justify-content:center; align-items:center; height:100vh;">
                    <h2>Proxy Error: ${err.message}</h2>
                </body>
            `);
        }
    });
});

const extractPackages = (code) => {
    const regex = /(?:require\(|from\s+)['"]([^'./][^'"]*)['"]/g;
    const packages = new Set();
    let match;
    while ((match = regex.exec(code)) !== null) packages.add(match[1]);
    return Array.from(packages);
};

const safeCleanup = (dirPath) => {
    try {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    } catch (err) {
        console.log(`[Warning] Could not clean dir immediately: ${err.message}`);
    }
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    const userPort = portCounter++;
    activePorts.set(socket.id, userPort);
    socket.emit('system-info', { port: userPort });

    let activeProcess = null;

    socket.on('run-code', async (files) => {
        console.log('Running code for:', socket.id); // Debug log
        
        const tempDir = path.join(__dirname, 'temp', socket.id);

        if (activeProcess) {
            try {
                activeProcess.kill();
            } catch (e) {
                console.log('Error killing process:', e.message);
            }
            activeProcess = null;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        safeCleanup(tempDir);

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        try {
            const entryPoint = path.join(tempDir, 'index.js');
            let allPackages = [];

            Object.keys(files).forEach(filename => {
                const content = files[filename].value;
                fs.writeFileSync(path.join(tempDir, filename), content);
                allPackages = [...allPackages, ...extractPackages(content)];
            });

            const builtIns = ['fs', 'path', 'http', 'os', 'crypto', 'util', 'events', 'stream', 'url', 'querystring', 'net', 'dns', 'child_process'];
            const dependencies = [...new Set(allPackages)].filter(pkg => !builtIns.includes(pkg));

            if (dependencies.length > 0) {
                socket.emit('terminal-output', `\x1b[33m[System] Installing: ${dependencies.join(', ')}...\r\n\x1b[0m`);
                try {
                    execSync('npm init -y', { cwd: tempDir, stdio: 'ignore' });
                    execSync(`npm install ${dependencies.join(' ')}`, { cwd: tempDir, stdio: 'ignore' });
                    socket.emit('terminal-output', `\x1b[32m[System] Packages installed successfully.\r\n\x1b[0m`);
                } catch (e) {
                    socket.emit('terminal-output', `\x1b[31m[Error] Failed to install packages: ${e.message}\x1b[0m\r\n`);
                }
            }

            if (!fs.existsSync(entryPoint)) {
                socket.emit('terminal-output', '\x1b[31m[Error] index.js not found.\x1b[0m\r\n');
                return;
            }

            socket.emit('terminal-output', `\x1b[36m[System] Starting server on port ${userPort}...\r\n\x1b[0m`);

            const child = spawn('node', ['index.js'], {
                cwd: tempDir,
                env: { ...process.env, PORT: userPort },
            });

            activeProcess = child;

            child.stdout.on('data', (data) => {
                console.log('stdout:', data.toString()); // Debug log
                socket.emit('terminal-output', data.toString());
            });
            
            child.stderr.on('data', (data) => {
                console.log('stderr:', data.toString()); // Debug log
                socket.emit('terminal-output', `\x1b[31m${data.toString()}\x1b[0m`);
            });
            
            child.on('close', (code) => {
                socket.emit('terminal-output', `\r\n\x1b[2m[Process exited with code ${code}]\x1b[0m\r\n`);
                activeProcess = null;
            });

            child.on('error', (err) => {
                socket.emit('terminal-output', `\x1b[31m[Spawn Error] ${err.message}\x1b[0m\r\n`);
            });

        } catch (error) {
            console.error('Run error:', error); // Debug log
            socket.emit('terminal-output', `\x1b[31m[System Error] ${error.message}\x1b[0m\r\n`);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        activePorts.delete(socket.id);
        if (activeProcess) {
            try { activeProcess.kill(); } catch (e) {}
        }
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));