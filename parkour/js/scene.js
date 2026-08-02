import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SETTINGS } from './settings.js?v=4';

export const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (url, loaded, total) => {
    const pct = Math.round((loaded / total) * 100);
    const bar = document.getElementById('loader-bar');
    const txt = document.getElementById('loader-pct');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = pct + '%';
};

export const platformMeshes = [];
export const apples = [];

const CYL_RADIUS = 1.5;
const CYL_HEIGHT = 4.0;
const HEIGHT_STEP = 2.5;

const PLATFORM_DEFS = [
    { x:  0, z:  0 },
    { x:  4, z:  1 },
    { x:  7, z: -1 },
    { x: 10, z:  2 },
    { x: 13, z:  0 },
    { x: 10, z:  3 },
    { x:  7, z:  5 },
    { x: 10, z:  7 },
    { x: 13, z:  5 },
    { x: 16, z:  7 },
    { x: 14, z: 10 },
    { x: 11, z:  9 },
    { x:  8, z: 11 },
    { x: 11, z: 13 },
    { x: 14, z: 11 },
    { x: 17, z: 13 },
    { x: 14, z: 16 },
    { x: 11, z: 15 },
    { x:  8, z: 17 },
    { x:  5, z: 15 },
];

export const spawnPoint = new THREE.Vector3(
    PLATFORM_DEFS[0].x,
    CYL_HEIGHT + 0.5,
    PLATFORM_DEFS[0].z
);

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 60, 300);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    // Добавляем одно красное подсвечивание снизу/сбоку для общей атмосферы свечения
    const redAtmosphere = new THREE.HemisphereLight(0x87CEEB, 0xff2222, 0.3);
    scene.add(redAtmosphere);

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(30, 80, 40);
    sun.castShadow = true;
    sun.shadow.camera.left = -100; sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100; sun.shadow.camera.bottom = -100;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const texLoader = new THREE.TextureLoader();
    const grassTex = texLoader.load('res/grass.png');
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(1, 2);

    const gltfLoader = new GLTFLoader(loadingManager);

    PLATFORM_DEFS.forEach((def, i) => {
        const topY    = CYL_HEIGHT + i * HEIGHT_STEP;
        const centerY = topY - CYL_HEIGHT / 2;

        // Цилиндр
        const geom = new THREE.CylinderGeometry(CYL_RADIUS, CYL_RADIUS, CYL_HEIGHT, 32);
        const mat  = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.8 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(def.x, centerY, def.z);
        mesh.castShadow    = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        platformMeshes.push(mesh);

        // Метки СТАРТ / ФИНИШ
        if (i === 0 || i === PLATFORM_DEFS.length - 1) {
            const canvas = document.createElement('canvas');
            canvas.width = 128; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = i === 0 ? '#44cc44' : '#ffcc00';
            ctx.font = 'bold 40px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(i === 0 ? 'СТАРТ' : 'ФИНИШ', 64, 46);
            const labelMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(2.5, 1.2),
                new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, side: THREE.DoubleSide })
            );
            labelMesh.position.set(def.x, topY + 1.5, def.z);
            labelMesh.rotation.x = -0.3;
            scene.add(labelMesh);
        }

        // Яблоко на вершине цилиндра
        const appleY = topY + 0.5;
        gltfLoader.load('res/apple.glb', (gltf) => {
            const apple = gltf.scene;
            apple.scale.set(1.5, 1.5, 1.5);
            apple.position.set(def.x, appleY, def.z);
            
            const materials = [];
            apple.traverse(n => { 
                if (n.isMesh) {
                    n.castShadow = true;
                    // Делаем материалу яблока честное собственное свечение через Emissive
                    if (n.material) {
                        // Клонируем материал, чтобы каждое яблоко могло пульсировать независимо
                        n.material = n.material.clone();
                        n.material.emissive = new THREE.Color(0xff1111);
                        n.material.emissiveIntensity = 0.8;
                        materials.push(n.material);
                    }
                } 
            });
            scene.add(apple);

            apples.push({ 
                mesh: apple, 
                materials: materials,
                x: def.x, 
                y: appleY, 
                z: def.z, 
                collected: false 
            });
        });
    });

    return scene;
}

export function loadPlayer(scene, callback) {
    const loader = new GLTFLoader(loadingManager);
    loader.load('res/player.glb', (gltf) => {
        const model = gltf.scene;
        model.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (node.material) {
                    node.material.emissive.setHex(0x000000);
                    node.material.emissiveIntensity = 0;
                    node.material.shadowSide = THREE.BackSide;
                }
            }
        });
        const s = SETTINGS.player.scale;
        model.scale.set(s, s, s);
        model.position.copy(spawnPoint);
        model.position.y += 10;
        scene.add(model);
        callback(model);
    });
}
