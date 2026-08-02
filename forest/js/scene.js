import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SETTINGS } from './settings.js?v=5';

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

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 50, 250);

   // --- СВЕТ ---
const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(60, 100, 40);
sun.castShadow = true;
sun.shadow.camera.left = -150; sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150; sun.shadow.camera.bottom = -150;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

    // --- ГЕОМЕТРИЯ ЗЕМЛИ ---
    const geometry = new THREE.PlaneGeometry(SETTINGS.world.size, SETTINGS.world.size, SETTINGS.world.segments, SETTINGS.world.segments);
    geometry.rotateX(-Math.PI / 2);

    const vertices = geometry.attributes.position.array;
    const colors = [];

    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];
        let h = (Math.abs(Math.sin(x * 0.05) * Math.cos(z * 0.05)) * 3) + 1.2;
        
        const distToRiver = Math.abs(z); 
        if (distToRiver < 10) {
            h = (distToRiver < 4) ? -4 : THREE.MathUtils.lerp(-4, 1.2, (distToRiver - 4) / 6);
        }

        const distFromCenter = Math.sqrt(x*x + z*z);
        if (distFromCenter > 70) {
            const mountainSlope = Math.pow((distFromCenter - 70) * 0.25, 2); 
            h = Math.max(h, Math.min(mountainSlope, 30)); 
        }
        vertices[i + 1] = h;

        const color = new THREE.Color();
        if (h < 0) { color.setHSL(0.08, 0.5, 0.25); } 
        else if (h < 4.5) { color.setHSL(0.3, 0.4, 0.4); } 
        else { color.setRGB(0.5, 0.5, 0.5); }
        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const loader = new THREE.TextureLoader();
    const grassTex = loader.load('res/grass.png');
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(20, 20); 

    const material = new THREE.MeshStandardMaterial({ map: grassTex, vertexColors: true, roughness: 0.8 });
    terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // --- ВОДА ---
    const waterGeometry = new THREE.PlaneGeometry(SETTINGS.world.size, SETTINGS.world.size);
    const waterMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x0044ff, 
        transparent: true, 
        opacity: 0.5,
        side: THREE.DoubleSide
    });

    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotateX(-Math.PI / 2);
    water.position.y = SETTINGS.world.waterLevel;
    scene.add(water);

    // --- ОБЪЕКТЫ ---
    const gltfLoader = new GLTFLoader(loadingManager);
    const treeModels = ['res/tree/birch/1.glb', 'res/tree/common/1.glb', 'res/tree/birch/2.glb', 'res/tree/birch/3.glb', 'res/tree/birch/4.glb', 'res/tree/birch/5.glb','res/tree/common/2.glb', 'res/tree/common/4.glb', 'res/tree/common/5.glb', 'res/tree/common/3.glb'];
    const bushModels = ['res/tree/bush/1.glb', 'res/tree/bush/2.glb', 'res/tree/bush/3.glb', 'res/tree/bush/4.glb'];

    const spawn = (models, count, scaleBase, scaleRandom, hasCollision) => {
        for (let i = 0; i < count; i++) {
            const tx = (Math.random() - 0.5) * 150;
            const tz = (Math.random() - 0.5) * 150;
            const ray = new THREE.Raycaster(new THREE.Vector3(tx, 100, tz), new THREE.Vector3(0, -1, 0));
            const hit = ray.intersectObject(terrainMesh);

            if (hit.length > 0) {
                const height = hit[0].point.y;
                if (height > 0.8 && height < 4.5) {
                    const path = models[Math.floor(Math.random() * models.length)];
                    gltfLoader.load(path, (gltf) => {
                        const obj = gltf.scene;
                        obj.position.set(tx, height, tz);
                        const s = hasCollision ? (scaleBase + Math.random() * scaleRandom) : scaleBase;
                        obj.scale.set(s, s, s);
                        obj.rotation.y = Math.random() * Math.PI;
                        obj.traverse(n => { if(n.isMesh) n.castShadow = true; });
                        scene.add(obj);

                        if (hasCollision) {
                            colliders.push({ x: tx, z: tz, r: s * 0.04 });
                        }
                    });
                }
            }
        }
    };

    spawn(treeModels, 80, 6, 2, true); 
    spawn(bushModels, 70, 1.2, 0, false); 

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
        model.position.y = SETTINGS.player.startY;
        scene.add(model);
        callback(model);
    });
}
