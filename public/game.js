const socket = io();
let currentRoomId = null, playerMeshes = {}, currentWeaponIdx = 0;
const weapons = [
    { damage: 25, range: 60, color: 0xffffff },
    { damage: 80, range: 20, color: 0xffaa00 },
    { damage: 100, range: 300, color: 0x00ccff }
];

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

function setupMap() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshPhongMaterial({color: 0x111111}));
    ground.rotation.x = -Math.PI/2;
    scene.add(ground);
    scene.add(new THREE.GridHelper(100, 50, 0x00d4ff, 0x222222));
    
    // Muros aleatorios
    const wallMat = new THREE.MeshPhongMaterial({color: 0x333333});
    for(let i=0; i<15; i++) {
        const size = Math.random() * 4 + 2;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(size, 3, size), wallMat);
        wall.position.set((Math.random()-0.5)*70, 1.5, (Math.random()-0.5)*70);
        scene.add(wall);
    }
}

scene.add(new THREE.AmbientLight(0x606060));
const sun = new THREE.PointLight(0xffffff, 1, 100);
sun.position.set(0, 20, 0);
scene.add(sun);

const raycaster = new THREE.Raycaster(), center = new THREE.Vector2(0, 0);
let lon = 0, lat = 0, moveData = { x: 0, y: 0 };

function setupJoysticks() {
    const mJs = nipplejs.create({ zone: document.getElementById('joystick-move'), mode: 'static', position: { left: '75px', bottom: '75px' }, color: 'white' });
    mJs.on('move', (e, d) => {
        const s = 0.2;
        moveData.x = Math.sin(d.angle.radians) * s;
        moveData.y = -Math.cos(d.angle.radians) * s;
    });
    mJs.on('end', () => moveData = { x: 0, y: 0 });

    const lJs = nipplejs.create({ zone: document.getElementById('joystick-look'), mode: 'static', position: { right: '75px', bottom: '75px' }, color: '#00d4ff' });
    lJs.on('move', (e, d) => {
        lon += d.force * Math.cos(d.angle.radians) * 3;
        lat += d.force * Math.sin(d.angle.radians) * 3;
        lat = Math.max(-85, Math.min(85, lat));
    });
}

window.setWeapon = (i) => {
    currentWeaponIdx = i;
    document.querySelectorAll('.weapon-btn').forEach((b, idx) => b.classList.toggle('active-weapon', idx === i));
};

window.shoot = () => {
    if(!currentRoomId) return;
    const w = weapons[currentWeaponIdx];
    scene.background = new THREE.Color(w.color);
    setTimeout(() => scene.background = new THREE.Color(0x000000), 50);
    raycaster.setFromCamera(center, camera);
    raycaster.far = w.range;
    const targets = Object.values(playerMeshes).filter(m => m.userData.id !== socket.id);
    const hits = raycaster.intersectObjects(targets, true);
    if(hits.length > 0) {
        let o = hits[0].object;
        while(o.parent && !o.userData.id) o = o.parent;
        socket.emit('shoot', { roomId: currentRoomId, targetId: o.userData.id, damage: w.damage });
    }
};

function createPlayer(color) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.4), new THREE.MeshPhongMaterial({color}));
    b.position.y = 0.5; g.add(b);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshPhongMaterial({color: 0xffdbac}));
    h.position.y = 1.2; g.add(h);
    return g;
}

socket.on('updatePlayers', (ps) => {
    let sHTML = "";
    for (let id in ps) {
        if (!playerMeshes[id]) {
            playerMeshes[id] = createPlayer(ps[id].color);
            playerMeshes[id].userData.id = id;
            scene.add(playerMeshes[id]);
        }
        playerMeshes[id].position.lerp(new THREE.Vector3(ps[id].x, 0, ps[id].z), 0.2);
        sHTML += `ID:${id.substr(0,3)} | K:${ps[id].kills}<br>`;
    }
    document.getElementById('scores').innerHTML = sHTML;
});

function initGame(id) {
    currentRoomId = id;
    const ui = document.getElementById('ui-container');
    ui.style.display = 'none'; ui.style.pointerEvents = 'none';
    ['hud', 'weapon-dock', 'fire-btn', 'crosshair', 'joystick-move', 'joystick-look'].forEach(i => document.getElementById(i).style.display = 'flex');
    document.body.appendChild(renderer.domElement);
    setupMap(); setupJoysticks(); animate();
}

socket.on('roomCreated', (id) => initGame(id));
socket.on('joinedSuccess', (id) => initGame(id));
window.createRoom = () => socket.emit('createRoom');
window.joinRoom = () => socket.emit('joinRoom', document.getElementById('roomCodeInput').value.toUpperCase());

function animate() {
    requestAnimationFrame(animate);
    if (moveData.x !== 0 || moveData.y !== 0) {
        camera.translateZ(moveData.y); camera.translateX(moveData.x);
        socket.emit('move', { roomId: currentRoomId, pos: { x: camera.position.x, z: camera.position.z } });
    }
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    camera.lookAt(new THREE.Vector3().setFromSphericalCoords(1, phi, theta).add(camera.position));
    renderer.render(scene, camera);
}
