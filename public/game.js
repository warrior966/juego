// Conectar con el servidor de Render automáticamente
const socket = io(); 

// Variables globales para el juego
let currentRoomId = null;
let players = {};
let playerMeshes = {};

// 1. FUNCIONES PARA EL MENÚ (Las que llama el HTML)
// Estas funciones deben estar en el "window" para que el HTML las vea bien
window.createRoom = function() {
    console.log("Intentando crear sala...");
    socket.emit('createRoom');
};

window.joinRoom = function() {
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (code) {
        console.log("Intentando unirse a sala:", code);
        socket.emit('joinRoom', code);
    } else {
        alert("Por favor, introduce un código.");
    }
};

// 2. ESCUCHA DE EVENTOS DEL SERVIDOR
socket.on('roomCreated', (id) => {
    console.log("Sala creada con éxito:", id);
    initGame(id);
});

socket.on('joinedSuccess', (id) => {
    console.log("Unido a la sala:", id);
    initGame(id);
});

socket.on('errorMsg', (msg) => {
    alert(msg);
});

// 3. INICIALIZACIÓN DEL MUNDO 3D
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// Luces
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(new THREE.AmbientLight(0x404040));
scene.add(light);

// Suelo (Grid)
const grid = new THREE.GridHelper(100, 20, 0x007bff, 0x222222);
scene.add(grid);

function initGame(id) {
    currentRoomId = id;
    
    // Ocultar la interfaz
    document.getElementById('ui-container').style.display = 'none';
    document.getElementById('game-info').style.display = 'block';
    document.getElementById('currentRoomCode').innerText = id;
    
    // Añadir el lienzo del juego al HTML
    document.body.appendChild(renderer.domElement);
    
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    
    animate();
}

// 4. ACTUALIZAR JUGADORES
socket.on('updatePlayers', (serverPlayers) => {
    players = serverPlayers;
    
    for (let id in players) {
        if (!playerMeshes[id]) {
            // Crear el cubo para el nuevo jugador
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshStandardMaterial({ color: players[id].color });
            playerMeshes[id] = new THREE.Mesh(geometry, material);
            scene.add(playerMeshes[id]);
        }
        // Mover el cubo a su posición
        playerMeshes[id].position.set(players[id].x, 0.5, players[id].z);
    }

    // Eliminar cubos de jugadores que se fueron
    for (let id in playerMeshes) {
        if (!players[id]) {
            scene.remove(playerMeshes[id]);
            delete playerMeshes[id];
        }
    }
});

// 5. BUCLE DE ANIMACIÓN
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Ajustar ventana si se gira el iPad
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
