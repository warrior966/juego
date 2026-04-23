const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
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
                health: 100,
                kills: 0,
                deaths: 0
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
        const { roomId, targetId, damage } = data;
        const room = rooms[roomId];
        if (room && room.players[targetId]) {
            room.players[targetId].health -= damage;
            
            if (room.players[targetId].health <= 0) {
                room.players[targetId].health = 100;
                room.players[targetId].deaths += 1;
                room.players[targetId].x = Math.random() * 20 - 10;
                room.players[targetId].z = Math.random() * 20 - 10;
                
                if (room.players[socket.id]) {
                    room.players[socket.id].kills += 1;
                }
            }
            io.to(roomId).emit('updatePlayers', room.players);
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
http.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));

setInterval(() => {
    https.get('https://juego-b85b7.onrender.com', (res) => {}).on('error', (e) => {});
}, 600000);
