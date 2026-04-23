const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { 
    cors: { origin: "*", methods: ["GET", "POST"] } 
});
const path = require('path');
const https = require('https');

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

io.on('connection', (socket) => {
    socket.on('createRoom', () => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomId] = { players: {} };
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
    });

    socket.on('joinRoom', (roomId) => {
        if (rooms[roomId]) {
            socket.join(roomId);
            rooms[roomId].players[socket.id] = { 
                x: Math.random() * 20 - 10, 
                z: Math.random() * 20 - 10, 
                color: Math.random() * 0xffffff,
                health: 100 
            };
            socket.emit('joinedSuccess', roomId);
            io.to(roomId).emit('updatePlayers', rooms[roomId].players);
        }
    });

    socket.on('move', (data) => {
        if (rooms[data.roomId]?.players[socket.id]) {
            rooms[data.roomId].players[socket.id].x = data.pos.x;
            rooms[data.roomId].players[socket.id].z = data.pos.z;
            socket.to(data.roomId).emit('updatePlayers', rooms[data.roomId].players);
        }
    });

    socket.on('shoot', (data) => {
        const { roomId, targetId } = data;
        if (rooms[roomId] && rooms[roomId].players[targetId]) {
            rooms[roomId].players[targetId].health -= 25;
            if (rooms[roomId].players[targetId].health <= 0) {
                rooms[roomId].players[targetId].health = 100;
                rooms[roomId].players[targetId].x = Math.random() * 20 - 10;
                rooms[roomId].players[targetId].z = Math.random() * 20 - 10;
            }
            io.to(roomId).emit('updatePlayers', rooms[roomId].players);
        }
    });

    socket.on('disconnect', () => {
        for (let r in rooms) {
            if (rooms[r].players[socket.id]) {
                delete rooms[r].players[socket.id];
                io.to(r).emit('updatePlayers', rooms[r].players);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor activo en puerto ${PORT}`);
});

// AUTO-PING para Render (Usa tu URL real)
setInterval(() => {
    https.get('https://juego-b85b7.onrender.com', (res) => {}).on('error', (e) => {});
}, 600000);
