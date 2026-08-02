import * as THREE from 'three';
import { SETTINGS } from './settings.js?v=10';
import { createScene, loadPlayer, terrainMesh, loadingManager } from './scene.js?v=10';
import { initControls, moveData, input, cameraRotation } from './controls.js?v=10';
import { colliders } from './scene.js?v=10';

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

function animate() {
    requestAnimationFrame(animate);

    // Туман под водой (как в лесу)
    if (camera.position.y < SETTINGS.world.waterLevel) {
        scene.fog.color.setHex(0x003366);
        scene.fog.near = 0;
        scene.fog.far = 20;
    } else {
        scene.fog.color.setHex(0xd4c4a0);
        scene.fog.near = 50;
        scene.fog.far = 200;
    }

    if (player && terrainMesh) {
        // --- 1. ДВИЖЕНИЕ ---
        const angle = cameraRotation.lon;
        const moveX = -moveData.x * Math.cos(angle) + moveData.y * Math.sin(angle);
        const moveZ =  moveData.x * Math.sin(angle) + moveData.y * Math.cos(angle);

        player.position.x += moveX * SETTINGS.player.speed;
        player.position.z += moveZ * SETTINGS.player.speed;

        // Коллизии с объектами
        colliders.forEach(obj => {
            const dx = player.position.x - obj.x;
            const dz = player.position.z - obj.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            const minDist = obj.r + 0.6;
            if (distance < minDist) {
                const a = Math.atan2(dx, dz);
                player.position.x = obj.x + Math.sin(a) * minDist;
                player.position.z = obj.z + Math.cos(a) * minDist;
            }
        });

        // Невидимая стена (граница мира)
        const pDist = Math.sqrt(player.position.x ** 2 + player.position.z ** 2);
        if (pDist > 80) {
            const a = Math.atan2(player.position.x, player.position.z);
            player.position.x = Math.sin(a) * 80;
            player.position.z = Math.cos(a) * 80;
        }

        if (Math.abs(moveData.x) > 0.1 || Math.abs(moveData.y) > 0.1) {
            player.rotation.y = Math.atan2(moveX, moveZ);
        }

        // --- 2. ФИЗИКА ---
        const raycaster = new THREE.Raycaster(
            new THREE.Vector3(player.position.x, 50, player.position.z),
            new THREE.Vector3(0, -1, 0)
        );
        const intersects = raycaster.intersectObject(terrainMesh);
        const groundHeight = (intersects.length > 0) ? intersects[0].point.y : 1.0;

        if (input.jump && !isJumping) {
            velocityY = SETTINGS.player.jumpForce;
            isJumping = true;
            input.jump = false;
        }
        velocityY += SETTINGS.player.gravity;
        player.position.y += velocityY;

        if (player.position.y <= groundHeight) {
            player.position.y = groundHeight;
            velocityY = 0;
            isJumping = false;
        }

        // --- 3. КАМЕРА ---
        const dist = SETTINGS.camera.distance;
        camera.position.x = player.position.x - Math.sin(cameraRotation.lon) * dist;
        camera.position.z = player.position.z - Math.cos(cameraRotation.lon) * dist;
        camera.position.y = player.position.y + 2.0;
        camera.lookAt(player.position.x, player.position.y + 1.5, player.position.z);
    }

    renderer.render(scene, camera);
}

init();
