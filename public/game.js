const socket = io();
let roomId = null;
let playerMeshes = {};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

scene.add(new THREE.AmbientLight(0x404040));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(10, 10, 10);
scene.add(sun);
scene.add(new THREE.GridHelper(100, 20, 0x007bff, 0x222222));

function createRoom() { socket.emit('createRoom'); }
function joinRoom() { socket.emit('joinRoom', document.getElementById('roomInput').value.toUpperCase()); }

socket.on('roomCreated', (id) => start(id));
socket.on('joinedSuccess', (id) => start(id));

function start(id) {
    roomId = id;
    document.getElementById('ui').style.display = 'none';
    document.body.appendChild(renderer.domElement);
    camera.position.set(0, 5, 10);
    animate();
}

socket.on('updatePlayers', (players) => {
    for (let id in players) {
        if (!playerMeshes[id]) {
            playerMeshes[id] = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshPhongMaterial({color: players[id].color}));
            scene.add(playerMeshes[id]);
        }
        playerMeshes[id].position.set(players[id].x, 0.5, players[id].z);
    }
});

// Nota: En iPad necesitarás controles táctiles. Por ahora, esto responde a teclado.
window.onkeydown = (e) => {
    if (!roomId) return;
    if (e.key === 'w') camera.position.z -= 0.5;
    if (e.key === 's') camera.position.z += 0.5;
    socket.emit('move', { roomId, pos: { x: camera.position.x, z: camera.position.z } });
};

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
