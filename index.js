const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static('public'));

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
            rooms[roomId].players[socket.id] = { x: 0, z: 0, color: Math.random() * 0xffffff };
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
http.listen(PORT, () => console.log(`Puerto: ${PORT}`));
