export const moveData = { x: 0, y: 0 };
export const cameraRotation = { lon: 0, lat: 0.2 }; // lon - влево/вправо, lat - вверх/вниз
export const input = { jump: false };

let isRotating = false;
let previousTouchX = 0;
let previousTouchY = 0;

export function initControls() {
    // Джойстик (NippleJS)
    const joystick = nipplejs.create({
        zone: document.getElementById('joystick-zone'),
        mode: 'static',
        position: { left: '60px', bottom: '60px' }
    });

    joystick.on('move', (evt, data) => {
        if (data.vector) {
            moveData.x = data.vector.x;
            moveData.y = data.vector.y;
        }
    }).on('end', () => {
        moveData.x = 0;
        moveData.y = 0;
    });

    // Обработка свайпов для вращения камеры
    window.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        // Начинаем вращение, если коснулись НЕ области джойстика и НЕ кнопки прыжка
        if (touch.clientX > 150) { 
            isRotating = true;
            previousTouchX = touch.clientX;
            previousTouchY = touch.clientY;
        }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (!isRotating) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - previousTouchX;
        const deltaY = touch.clientY - previousTouchY;

        // Чувствительность вращения
        const sensitivity = 0.007;
        
        cameraRotation.lon -= deltaX * sensitivity;
        cameraRotation.lat += deltaY * sensitivity;

        // Ограничиваем вертикальный обзор, чтобы не смотреть строго вверх или под землю
        cameraRotation.lat = Math.max(0.1, Math.min(Math.PI / 2.5, cameraRotation.lat));

        previousTouchX = touch.clientX;
        previousTouchY = touch.clientY;
    }, { passive: false });

    window.addEventListener('touchend', () => {
        isRotating = false;
    });


// Кнопка «Меню»
const menuBtn = document.createElement('button');
menuBtn.textContent = '← Меню';
Object.assign(menuBtn.style, {
    position: 'absolute', top: '20px', left: '20px',
    background: 'rgba(0,0,0,0.45)', border: '2px solid rgba(255,255,255,0.6)',
    borderRadius: '12px', color: 'white', fontFamily: 'sans-serif',
    fontSize: '14px', fontWeight: '600', padding: '8px 16px',
    cursor: 'pointer', zIndex: '999', backdropFilter: 'blur(4px)'
});
menuBtn.addEventListener('click', () => { window.location.href = '../index.html'; });
menuBtn.addEventListener('touchend', (e) => { e.preventDefault(); window.location.href = '../index.html'; });
document.body.appendChild(menuBtn);

const jumpBtn = document.getElementById('jump-button');
jumpBtn.style.transition = 'all 0.1s ease';

const press = () => {
    jumpBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
    jumpBtn.style.transform = 'scale(0.9)';
};

const release = () => {
    jumpBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
    jumpBtn.style.transform = 'scale(1.0)';
};

// ОБРАБОТКА НАЖАТИЯ (ДЛЯ ПРЫЖКА)
jumpBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    press();
    
    // ГЛАВНОЕ: Меняем флаг в объекте input, который проверяет твой game.js
    input.jump = true; 
});

jumpBtn.addEventListener('touchend', release);

// Для тестов с мышкой
jumpBtn.addEventListener('mousedown', () => {
    press();
    input.jump = true;
});
window.addEventListener('mouseup', release);

}