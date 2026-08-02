import * as THREE from 'three';
import { SETTINGS } from './settings.js?v=4';
import { createScene, loadPlayer, platformMeshes, loadingManager, spawnPoint, apples } from './scene.js?v=4';
import { initControls, moveData, input, cameraRotation } from './controls.js?v=4';

loadingManager.onLoad = () => {
    const screen = document.getElementById('loader-screen');
    if (screen) {
        screen.style.opacity = '0';
        setTimeout(() => screen.style.display = 'none', 600);
    }
};

let scene, camera, renderer, player;
let velocityY = 0;
let isJumping = false;
let collected = 0;

function updateCounter() {
    const el = document.getElementById('apple-count');
    if (el) el.textContent = collected + ' / ' + apples.length;
}

function respawn() {
    player.position.copy(spawnPoint);
    player.position.y += 8;
    velocityY = 0;
    isJumping = false;
}

function init() {
    scene = createScene();
    camera = new THREE.PerspectiveCamera(SETTINGS.camera.fov, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    initControls();

    loadPlayer(scene, (model) => {
        player = model;
        animate();
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

const raycaster = new THREE.Raycaster();
const downDir   = new THREE.Vector3(0, -1, 0);

function getGroundHeight() {
    raycaster.set(
        new THREE.Vector3(player.position.x, player.position.y + 50, player.position.z),
        downDir
    );
    const hits = raycaster.intersectObjects(platformMeshes);
    for (const hit of hits) {
        if (hit.point.y <= player.position.y + 0.15) return hit.point.y;
    }
    return -Infinity;
}

function checkApples() {
    for (const apple of apples) {
        if (apple.collected) continue;
        const dx = player.position.x - apple.x;
        const dy = player.position.y - apple.y;
        const dz = player.position.z - apple.z;
        if (Math.sqrt(dx*dx + dy*dy + dz*dz) < 1.8) {
            apple.collected = true;
            if (apple.mesh) scene.remove(apple.mesh);
            collected++;
            updateCounter();
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (player) {
        // Вращение, покачивание и пульсация собственного свечения яблок
        const t = performance.now() * 0.001;
        for (const apple of apples) {
            if (!apple.collected && apple.mesh) {
                const bobY = apple.y + Math.sin(t * 2 + apple.x) * 0.15;
                apple.mesh.rotation.y = t * 1.5;
                apple.mesh.position.y = bobY;

                // Пульсация свечения сама по себе (без источников света — ровно 60 FPS!)
                const intensity = 0.6 + Math.sin(t * 4 + apple.x) * 0.4;
                apple.materials.forEach(mat => {
                    mat.emissiveIntensity = intensity;
                });
            }
        }

        // --- ДВИЖЕНИЕ ---
        const angle = cameraRotation.lon;
        const moveX = -moveData.x * Math.cos(angle) + moveData.y * Math.sin(angle);
        const moveZ =  moveData.x * Math.sin(angle) + moveData.y * Math.cos(angle);

        player.position.x += moveX * SETTINGS.player.speed;
        player.position.z += moveZ * SETTINGS.player.speed;

        if (Math.abs(moveData.x) > 0.1 || Math.abs(moveData.y) > 0.1) {
            player.rotation.y = Math.atan2(moveX, moveZ);
        }

        // --- ФИЗИКА ---
        const groundHeight = getGroundHeight();

        if (input.jump && !isJumping) {
            velocityY = SETTINGS.player.jumpForce;
            isJumping = true;
            input.jump = false;
        }
        velocityY += SETTINGS.player.gravity;
        player.position.y += velocityY;

        if (groundHeight !== -Infinity && player.position.y <= groundHeight) {
            player.position.y = groundHeight;
            velocityY = 0;
            isJumping = false;
        }

        // --- СБОР ЯБЛОК ---
        checkApples();

        // --- ПАДЕНИЕ В ПУСТОТУ ---
        if (player.position.y < -8) respawn();

        // --- КАМЕРА ---
        const dist = SETTINGS.camera.distance;
        camera.position.x = player.position.x - Math.sin(cameraRotation.lon) * dist;
        camera.position.z = player.position.z - Math.cos(cameraRotation.lon) * dist;
        camera.position.y = player.position.y + 2.5;
        camera.lookAt(player.position.x, player.position.y + 1.5, player.position.z);
    }

    renderer.render(scene, camera);
}

init();
