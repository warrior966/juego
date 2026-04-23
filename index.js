const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*", // Permite conexiones desde cualquier lugar (importante para pruebas)
    methods: ["GET", "POST"]
  }
});

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static('public'));

// Base de datos temporal de salas y jugadores
let rooms = {};

io.on('connection', (socket) => {
    console.log('Nuevo dispositivo conectado:', socket.id);

    // Evento: Crear una sala nueva
    socket.on('createRoom', () => {
        // Genera un código de 5 letras/números (ej: AB123)
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomId] = { players: {} };
        
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        console.log(`Sala creada: ${roomId}`);
    });

    // Evento: Unirse a una sala existente
    socket.on('joinRoom', (roomId) => {
        if (rooms[roomId]) {
            socket.join(roomId);
            
            // Creamos los datos iniciales del jugador
            rooms[roomId].players[socket.id] = {
                x: Math.random() * 20 - 10,
                z: Math.random() * 20 - 10,
                color: Math.random() * 0xffffff,
                id: socket.id
            };

            socket.emit('joinedSuccess', roomId);
            
            // Notificar a todos en la sala que hay un nuevo jugador
            io.to(roomId).emit('updatePlayers', rooms[roomId].players);
            console.log(`Usuario ${socket.id} se unió a la sala ${roomId}`);
        } else {
            socket.emit('errorMsg', 'La sala no existe. Verifica el código.');
        }
    });

    // Evento: Sincronizar movimiento
    socket.on('move', (data) => {
        const { roomId, pos } = data;
        if (rooms[roomId] && rooms[roomId].players[socket.id]) {
            rooms[roomId].players[socket.id].x = pos.x;
            rooms[roomId].players[socket.id].z = pos.z;
            
            // Enviamos la actualización a todos los DEMÁS en la sala
            socket.to(roomId).emit('updatePlayers', rooms[roomId].players);
        }
    });

    // Evento: Desconexión
    socket.on('disconnect', () => {
        for (let rId in rooms) {
            if (rooms[rId].players[socket.id]) {
                delete rooms[rId].players[socket.id];
                // Avisar a los que quedan que alguien se fue
                io.to(rId).emit('updatePlayers', rooms[rId].players);
                
                // Si la sala se queda vacía, la borramos para ahorrar memoria
                if (Object.keys(rooms[rId].players).length === 0) {
                    delete rooms[rId];
                }
            }
        }
        console.log('Usuario desconectado:', socket.id);
    });
});

// Configuración del puerto para Render
// Render asigna un puerto dinámico, por eso usamos process.env.PORT
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`=== SERVIDOR ONLINE ===`);
    console.log(`Escuchando en el puerto: ${PORT}`);
});
