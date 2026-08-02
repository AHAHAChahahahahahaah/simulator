import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SETTINGS } from './settings.js?v=10';

export const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (url, loaded, total) => {
    const pct = Math.round((loaded / total) * 100);
    const bar = document.getElementById('loader-bar');
    const txt = document.getElementById('loader-pct');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = pct + '%';
};

export let terrainMesh;
export const colliders = [];

const LAKE_RADIUS = 14;
const LAKE_SHORE  = 1.5; // ширина склона берега (крутой)
const LAKE_BOTTOM = -3;  // глубина дна озера

export function createScene() {
    const scene = new THREE.Scene();
    const skyColor = 0xd4c4a0;
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.Fog(skyColor, 50, 200);

    // --- СВЕТ ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffe8a0, 1.4);
    sun.position.set(60, 100, 40);
    sun.castShadow = true;
    sun.shadow.camera.left = -150; sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150; sun.shadow.camera.bottom = -150;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    // --- ГЕОМЕТРИЯ ЗЕМЛИ с ямой под озеро ---
    const geometry = new THREE.PlaneGeometry(SETTINGS.world.size, SETTINGS.world.size, SETTINGS.world.segments, SETTINGS.world.segments);
    geometry.rotateX(-Math.PI / 2);

    const vertices = geometry.attributes.position.array;
    const colors = [];

    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];
        const distToCenter = Math.sqrt(x * x + z * z);

        // Дюны: несколько слоёв растянутых волн имитируют барханы
        const dune =
            Math.sin(x * 0.07 + 0.5)  * Math.cos(z * 0.03) * 2.2 +
            Math.sin(x * 0.03 - z * 0.06 + 1.2) * 1.4 +
            Math.cos(x * 0.11 + z * 0.04 - 0.8) * 0.8;

        let h;
        if (distToCenter < LAKE_RADIUS) {
            // Дно озера
            h = LAKE_BOTTOM;
        } else if (distToCenter < LAKE_RADIUS + LAKE_SHORE) {
            // Склон берега (плавный переход от дна к дюнам)
            const t = (distToCenter - LAKE_RADIUS) / LAKE_SHORE;
            h = THREE.MathUtils.lerp(LAKE_BOTTOM, 1.0 + dune * t, t);
        } else {
            // Пустыня с дюнами (только возвышения, не ямы)
            h = 1.0 + Math.max(0, dune);
        }
        vertices[i + 1] = h;

        // Цвет: мокрый тёмный песок у воды, насыщенный жёлтый подальше
        const color = new THREE.Color();
        if (distToCenter < LAKE_RADIUS + LAKE_SHORE) {
            color.setHSL(0.08, 0.55, 0.35 + 0.2 * ((distToCenter - LAKE_RADIUS) / LAKE_SHORE));
        } else {
            color.setHSL(0.1, 0.82 + Math.random() * 0.1, 0.56 + Math.random() * 0.06);
        }
        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const loader = new THREE.TextureLoader();
    const sandTex = loader.load('res/grass.png');
    sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
    sandTex.repeat.set(20, 20);

    const material = new THREE.MeshStandardMaterial({ map: sandTex, vertexColors: true, roughness: 0.95 });
    terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // --- ПОВЕРХНОСТЬ ВОДЫ (на весь мир, земля перекрывает её везде кроме ямы) ---
    const waterGeometry = new THREE.PlaneGeometry(SETTINGS.world.size, SETTINGS.world.size);
    waterGeometry.rotateX(-Math.PI / 2);
    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a6faa,
        transparent: true,
        opacity: 0.78,
        roughness: 0.05,
        metalness: 0.3,
        side: THREE.DoubleSide,
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.position.set(0, SETTINGS.world.waterLevel, 0);
    scene.add(water);

    // --- ПАЛЬМЫ У БЕРЕГА ---
    const gltfLoader = new GLTFLoader(loadingManager);
    const palmPositions = [
        { angle: 0.4,  dist: LAKE_RADIUS + LAKE_SHORE + 1.0 },
        { angle: 2.5,  dist: LAKE_RADIUS + LAKE_SHORE + 1.5 },
        { angle: 4.6,  dist: LAKE_RADIUS + LAKE_SHORE + 0.8 },
    ];
    palmPositions.forEach(({ angle, dist }) => {
        const px = Math.sin(angle) * dist;
        const pz = Math.cos(angle) * dist;
        const ps = 9.0 + Math.random() * 3.0;
        gltfLoader.load('res/tree/palm.glb', (gltf) => {
            const obj = gltf.scene;
            obj.position.set(px, 1.0, pz);
            obj.scale.set(ps, ps, ps);
            obj.rotation.y = Math.random() * Math.PI * 2;
            obj.traverse(n => { if (n.isMesh) n.castShadow = true; });
            scene.add(obj);
            // Точечный свет рядом с пальмой — освещает снаружи, не отбеливает
            const palmLight = new THREE.PointLight(0xffe8a0, 1.8, ps * 4);
            palmLight.position.set(px, 1.0 + ps * 0.6, pz);
            scene.add(palmLight);
            colliders.push({ x: px, z: pz, r: ps * 0.06 });
        });
    });

    // --- КАКТУСЫ (не спауним у озера) ---
    const cactusModels = ['res/cactus/1.glb', 'res/cactus/2.glb', 'res/cactus/3.glb', 'res/cactus/4.glb'];
    for (let i = 0; i < 80; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = (LAKE_RADIUS + LAKE_SHORE + 8) + Math.random() * 50;
        const tx = Math.sin(angle) * dist;
        const tz = Math.cos(angle) * dist;
        const path = cactusModels[Math.floor(Math.random() * cactusModels.length)];
        const s = 2.0 + Math.random() * 1.5;
        gltfLoader.load(path, (gltf) => {
            const obj = gltf.scene;
            obj.position.set(tx, 1.0, tz);
            obj.scale.set(s, s, s);
            obj.rotation.y = Math.random() * Math.PI * 2;
            obj.traverse(n => { if (n.isMesh) n.castShadow = true; });
            scene.add(obj);
            colliders.push({ x: tx, z: tz, r: s * 0.05 });
        });
    }

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
        // Спавн рядом с озером, но не в воде
        model.position.set(0, SETTINGS.player.startY, LAKE_RADIUS + LAKE_SHORE + 6);
        scene.add(model);
        callback(model);
    });
}
