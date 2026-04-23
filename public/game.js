const socket = io();
let currentRoomId = null;
let playerMeshes = {};
const weapons = [
    { name: "Pistola", damage: 25, range: 60, color: 0xffffff },
    { name: "Escopeta", damage: 80, range: 20, color: 0xffaa00 },
    { name: "Sniper", damage: 100, range: 300, color: 0x00ccff }
];
let currentWeaponIdx = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// --- MAPA ---
function setupMap() {
    // Suelo
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshPhongMaterial({color: 0x111111}));
    ground.rotation.x = -Math.PI/2;
    scene.add(ground);
    scene.add(new THREE.GridHelper(100, 50, 0x007bff, 0x222222));

    // Paredes del borde
    const wallMat = new THREE.MeshPhongMaterial({color: 0x333333});
    const createWall = (w, h, d, x, z) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
        wall.position.set(x, h/2, z);
        scene.add(wall);
    };
    
    // Muros exteriores
    createWall(100, 5, 1, 0, 50);  // Norte
    createWall(100, 5, 1, 0, -50); // Sur
    createWall(1, 5, 100, 50, 0);  // Este
    createWall(1, 5, 100, -50, 0); // Oeste

    // Obstáculos internos (Mapa aleatorio pero fijo)
    for(let i=0; i<15; i++) {
        const size = Math.random() * 4 + 2;
        const x = (Math.random() - 0.5) * 60;
        const z = (Math.random() - 0.5) * 60;
        createWall(size, 3, size, x, z);
    }
}

scene.add(new THREE.AmbientLight(0x606060));
const light = new THREE.PointLight(0xffffff, 1, 100);
light.position.set(0, 20, 0);
scene.add(light);

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

// --- MODELO ---
function createPlayerModel(color) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.4), new THREE.MeshPhongMaterial({color}));
    body.position.y = 0.5;
    group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshPhongMaterial({color: 0xffdbac}));
    head.position.y = 1.2;
    group.add(head);
    return group;
}

// --- CONTROLES JOYSTICK ---
let lon = 0, lat = 0, moveData = { x: 0, y: 0 };

function setupJoysticks() {
    const moveJs = nipplejs.create({ zone: document.getElementById('joystick-move'), mode: 'static', position: { left: '80px', bottom: '80px' }, color: 'white' });
    moveJs.on('move', (evt, data) => {
        const speed = 0.2;
        moveData.x = Math.sin(data.angle.radians) * speed;
        moveData.y = -Math.cos(data.angle.radians) * speed;
    });
    moveJs.on('end', () => moveData = { x: 0, y: 0 });

    const lookJs = nipplejs.create({ zone: document.getElementById('joystick-look'), mode: 'static', position: { right: '80px', bottom: '80px' }, color: '#007bff' });
    lookJs.on('move', (evt, data) => {
        lon += data.force * Math.cos(data.angle.radians) * 3;
        lat += data.force * Math.sin(data.angle.radians) * 3;
        lat = Math.max(-85, Math.min(85, lat));
    });
}

window.setWeapon = (idx) => {
    currentWeaponIdx = idx;
    document.querySelectorAll('.weapon-btn').forEach((b, i) => b.classList.toggle('active-weapon', i === idx));
};

window.shoot = () => {
    if(!currentRoomId) return;
    const weapon = weapons[currentWeaponIdx];
    scene.background = new THREE.Color(weapon.color);
    setTimeout(() => scene.background = new THREE.Color(0x050505), 50);
    
    raycaster.setFromCamera(center, camera);
    raycaster.far = weapon.range;
    const targets = Object.values(playerMeshes).filter(m => m.userData.id !== socket.id);
    const hits = raycaster.intersectObjects(targets, true);
    if(hits.length > 0) {
        let obj = hits[0].object;
        while(obj.parent && !obj.userData.id) obj = obj.parent;
        socket.emit('shoot', { roomId: currentRoomId, targetId: obj.userData.id, damage: weapon.damage });
    }
};

socket.on('updatePlayers', (players) => {
    let scoreHTML = "";
    for (let id in players) {
        if (!playerMeshes[id]) {
            playerMeshes[id] = createPlayerModel(players[id].color);
            playerMeshes[id].userData.id = id;
            scene.add(playerMeshes[id]);
        }
        playerMeshes[id].position.lerp(new THREE.Vector3(players[id].x, 0, players[id].z), 0.2);
        scoreHTML += `<div style="color:white; font-size:12px;">ID ${id.substr(0,3)}: ${players[id].kills} Kills</div>`;
    }
    document.getElementById('scores').innerHTML = scoreHTML;
});

function initGame(id) {
    currentRoomId = id;
    document.getElementById('ui-container').style.display = 'none';
    ['hud', 'weapon-dock', 'fire-btn', 'crosshair'].forEach(i => document.getElementById(i).style.display = 'block');
    document.body.appendChild(renderer.domElement);
    setupMap();
    setupJoysticks();
    animate();
}

socket.on('roomCreated', (id) => initGame(id));
socket.on('joinedSuccess', (id) => initGame(id));

window.createRoom = () => socket.emit('createRoom');
window.joinRoom = () => {
    const code = document.getElementById('roomCodeInput').value.toUpperCase();
    if(code) socket.emit('joinRoom', code);
};

function animate() {
    requestAnimationFrame(animate);
    if (moveData.x !== 0 || moveData.y !== 0) {
        camera.translateZ(moveData.y);
        camera.translateX(moveData.x);
        // Limitar movimiento al mapa (simple)
        camera.position.x = Math.max(-48, Math.min(48, camera.position.x));
        camera.position.z = Math.max(-48, Math.min(48, camera.position.z));
        socket.emit('move', { roomId: currentRoomId, pos: { x: camera.position.x, z: camera.position.z } });
    }
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    camera.lookAt(new THREE.Vector3().setFromSphericalCoords(1, phi, theta).add(camera.position));
    renderer.render(scene, camera);
}
