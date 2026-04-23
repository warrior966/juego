const socket = io();
let currentRoomId = null;
let playerMeshes = {};
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// --- ILUMINACIÓN Y ESCENARIO ---
scene.add(new THREE.AmbientLight(0x404040));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);
const grid = new THREE.GridHelper(100, 40, 0x007bff, 0x222222);
scene.add(grid);

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

// --- CONTROLES DE ROTACIÓN (RATÓN + TÁCTIL) ---
let isTouching = false;
let previousPointer = { x: 0, y: 0 };
let lon = 0, lat = 0;

// Eventos para iPad (Touch)
window.addEventListener('touchstart', (e) => {
    if (e.target.id === 'fire-btn') return;
    isTouching = true;
    previousPointer.x = e.touches[0].pageX;
    previousPointer.y = e.touches[0].pageY;
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (!isTouching) return;
    lon += (e.touches[0].pageX - previousPointer.x) * 0.2;
    lat -= (e.touches[0].pageY - previousPointer.y) * 0.2;
    lat = Math.max(-85, Math.min(85, lat));
    previousPointer.x = e.touches[0].pageX;
    previousPointer.y = e.touches[0].pageY;
}, { passive: false });

// Eventos para Ordenador (Mouse)
window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && document.getElementById('ui-container').style.display === 'none') {
        // Si no es el botón de disparo UI, disparamos
        if(e.target.id !== 'fire-btn') window.shoot();
    }
});

window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === document.body || isTouching) {
        lon += e.movementX * 0.1 || 0;
        lat -= e.movementY * 0.1 || 0;
        lat = Math.max(-85, Math.min(85, lat));
    }
});

window.addEventListener('touchend', () => isTouching = false);

function updateCameraRotation() {
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    const target = new THREE.Vector3().setFromSphericalCoords(1, phi, theta).add(camera.position);
    camera.lookAt(target);
}

// --- LÓGICA DE COMBATE Y SALAS ---
window.createRoom = () => socket.emit('createRoom');
window.joinRoom = () => socket.emit('joinRoom', document.getElementById('roomCodeInput').value.toUpperCase());

window.shoot = () => {
    if(!currentRoomId) return;
    // Efecto visual de disparo
    scene.background = new THREE.Color(0x550000);
    setTimeout(() => scene.background = new THREE.Color(0x000000), 50);

    raycaster.setFromCamera(center, camera);
    const meshes = Object.values(playerMeshes).filter(m => m !== playerMeshes[socket.id]);
    const intersects = raycaster.intersectObjects(meshes);
    
    if (intersects.length > 0) {
        const hitId = Object.keys(playerMeshes).find(id => playerMeshes[id] === intersects[0].object);
        socket.emit('shoot', { roomId: currentRoomId, targetId: hitId });
    }
};

function initGame(id) {
    currentRoomId = id;
    document.getElementById('ui-container').style.display = 'none';
    document.getElementById('crosshair').style.display = 'block';
    document.getElementById('fire-btn').style.display = 'flex';
    document.getElementById('game-info').style.display = 'block';
    document.getElementById('currentRoomCode').innerText = id;
    document.body.appendChild(renderer.domElement);
    
    // En ordenador, podemos bloquear el puntero para mejor control
    if (!('ontouchstart' in window)) {
        renderer.domElement.addEventListener('click', () => {
            renderer.domElement.requestPointerLock();
        });
    }

    camera.position.set(0, 2, 8);
    animate();
}

socket.on('roomCreated', (id) => initGame(id));
socket.on('joinedSuccess', (id) => initGame(id));

socket.on('updatePlayers', (players) => {
    for (let id in players) {
        if (!playerMeshes[id]) {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshPhongMaterial({color: players[id].color});
            playerMeshes[id] = new THREE.Mesh(geometry, material);
            scene.add(playerMeshes[id]);
        }
        playerMeshes[id].position.lerp(new THREE.Vector3(players[id].x, 0.5, players[id].z), 0.2);
        const s = players[id].health / 100;
        playerMeshes[id].scale.set(s, s, s); // El cubo se encoge si tiene poca vida
    }
    for (let id in playerMeshes) {
        if (!players[id]) { scene.remove(playerMeshes[id]); delete playerMeshes[id]; }
    }
});

// --- MOVIMIENTO TECLADO (PC) ---
window.onkeydown = (e) => {
    if(!currentRoomId) return;
    const speed = 0.5;
    const key = e.key.toLowerCase();
    if(key === 'w' || key === 'arrowup') camera.translateZ(-speed);
    if(key === 's' || key === 'arrowdown') camera.translateZ(speed);
    if(key === 'a' || key === 'arrowleft') camera.translateX(-speed);
    if(key === 'd' || key === 'arrowright') camera.translateX(speed);
    
    socket.emit('move', { roomId: currentRoomId, pos: { x: camera.position.x, z: camera.position.z } });
};

function animate() {
    requestAnimationFrame(animate);
    updateCameraRotation();
    renderer.render(scene, camera);
}

// Ajuste de pantalla
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
