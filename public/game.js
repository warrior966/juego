const socket = io();
let currentRoomId = null;
let playerMeshes = {};
const weapons = [
    { name: "Pistola", damage: 25, range: 50, color: 0xffffff },
    { name: "Escopeta", damage: 60, range: 15, color: 0xffaa00 },
    { name: "Sniper", damage: 100, range: 200, color: 0x00ccff }
];
let currentWeaponIdx = 0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

scene.add(new THREE.AmbientLight(0x606060));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(10, 20, 10);
scene.add(sun);
scene.add(new THREE.GridHelper(200, 50, 0x444444, 0x222222));

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

// --- MODELO REALISTA ---
function createPlayerModel(color) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.3), new THREE.MeshPhongMaterial({color}));
    body.position.y = 0.45;
    group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshPhongMaterial({color: 0xffdbac}));
    head.position.y = 1.1;
    group.add(head);
    return group;
}

// --- VARIABLES DE MOVIMIENTO ---
let lon = 0, lat = 0;
let moveData = { x: 0, y: 0 };

// --- CONFIGURACIÓN JOYSTICKS ---
function setupJoysticks() {
    const moveJoystick = nipplejs.create({
        zone: document.getElementById('joystick-move'),
        mode: 'static',
        position: { left: '75px', bottom: '75px' },
        color: 'white'
    });

    moveJoystick.on('move', (evt, data) => {
        const speed = 0.15;
        const dist = data.distance / 50;
        moveData.x = Math.sin(data.angle.radians) * speed * dist;
        moveData.y = -Math.cos(data.angle.radians) * speed * dist;
    });

    moveJoystick.on('end', () => { moveData = { x: 0, y: 0 }; });

    const lookJoystick = nipplejs.create({
        zone: document.getElementById('joystick-look'),
        mode: 'static',
        position: { right: '75px', bottom: '75px' },
        color: 'cyan'
    });

    lookJoystick.on('move', (evt, data) => {
        lon += data.force * Math.cos(data.angle.radians) * 2;
        lat += data.force * Math.sin(data.angle.radians) * 2;
        lat = Math.max(-85, Math.min(85, lat));
    });
}

// --- SISTEMA DE DISPARO ---
window.setWeapon = (idx) => {
    currentWeaponIdx = idx;
    document.querySelectorAll('.weapon-btn').forEach((b, i) => b.classList.toggle('active-weapon', i === idx));
};

window.shoot = () => {
    if(!currentRoomId) return;
    const weapon = weapons[currentWeaponIdx];
    scene.background = new THREE.Color(weapon.color);
    setTimeout(() => scene.background = new THREE.Color(0x000000), 40);

    raycaster.setFromCamera(center, camera);
    raycaster.far = weapon.range;
    
    const targets = [];
    for(let id in playerMeshes) if(id !== socket.id) targets.push(playerMeshes[id]);
    
    const hits = raycaster.intersectObjects(targets, true);
    if(hits.length > 0) {
        let hitObj = hits[0].object;
        while(hitObj.parent && !hitObj.userData.id) hitObj = hitObj.parent;
        socket.emit('shoot', { roomId: currentRoomId, targetId: hitObj.userData.id, damage: weapon.damage });
    }
};

// --- ACTUALIZACIÓN DE RED ---
socket.on('updatePlayers', (players) => {
    let scoreHTML = "";
    for (let id in players) {
        if (!playerMeshes[id]) {
            playerMeshes[id] = createPlayerModel(players[id].color);
            playerMeshes[id].userData.id = id;
            scene.add(playerMeshes[id]);
        }
        playerMeshes[id].position.lerp(new THREE.Vector3(players[id].x, 0, players[id].z), 0.2);
        scoreHTML += `${id.substr(0,4)}: ${players[id].kills}K<br>`;
    }
    document.getElementById('scores').innerHTML = scoreHTML;
});

function initGame(id) {
    currentRoomId = id;
    document.getElementById('ui-container').style.display = 'none';
    ['hud', 'weapon-dock', 'fire-btn', 'crosshair'].forEach(i => document.getElementById(i).style.display = 'block');
    document.body.appendChild(renderer.domElement);
    setupJoysticks();
    animate();
}

socket.on('roomCreated', (id) => initGame(id));
socket.on('joinedSuccess', (id) => initGame(id));

// Soporte teclado PC
window.onkeydown = (e) => {
    const s = 0.5;
    if(e.key === 'w') camera.translateZ(-s);
    if(e.key === 's') camera.translateZ(s);
    if(e.key === 'a') camera.translateX(-s);
    if(e.key === 'd') camera.translateX(s);
    socket.emit('move', { roomId: currentRoomId, pos: { x: camera.position.x, z: camera.position.z } });
};

function animate() {
    requestAnimationFrame(animate);
    
    // Aplicar movimiento de joystick
    if (moveData.x !== 0 || moveData.y !== 0) {
        camera.translateZ(moveData.y);
        camera.translateX(moveData.x);
        socket.emit('move', { roomId: currentRoomId, pos: { x: camera.position.x, z: camera.position.z } });
    }

    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    camera.lookAt(new THREE.Vector3().setFromSphericalCoords(1, phi, theta).add(camera.position));
    renderer.render(scene, camera);
}
