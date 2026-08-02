export const SETTINGS = {
    camera: { distance: 2, height: 2, fov: 75, sensitivity: 0.007 },
    player: { speed: 0.1, jumpForce: 0.35, gravity: -0.018, startY: 30, scale: 1.8 },
    world: {
        size: 500,
        segments: 128, // Хорошая детализация для прямой реки
        waterLevel: 0.5,
        treeCount: 100 // Сколько деревьев пытаемся посадить
    },
    lights: { ambientIntensity: 0.4, sunIntensity: 1.3 }
};
