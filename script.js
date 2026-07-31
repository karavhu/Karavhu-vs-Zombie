const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const hpEl = document.getElementById('hp');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const enemiesLeftEl = document.getElementById('enemies-left');

const startScreen = document.getElementById('start-screen');
const endScreen = document.getElementById('end-screen');
const endTitle = document.getElementById('end-title');
const endMsg = document.getElementById('end-msg');

// Preloaded Images
const imgPlayer = document.getElementById('img-player');
const imgZombieNormal = document.getElementById('img-zombie-normal');
const imgZombieFlying = document.getElementById('img-zombie-flying');
const imgZombieBig = document.getElementById('img-zombie-big');
const imgBg = document.getElementById('img-bg');

// Input Keys Tracker
const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// Game State: 'MENU', 'PLAYING', 'GAMEOVER', 'WIN'
let gameState = 'MENU';

let currentLevel = 1;
const MAX_LEVELS = 10;
let score = 0;
const GRAVITY = 0.5;

// Player Physics Object
const player = {
    x: 100,
    y: 300,
    width: 40,
    height: 50,
    dx: 0,
    dy: 0,
    speed: 5,
    jumpPower: -12,
    grounded: false,
    hp: 100,
    maxHp: 100,
    facing: 'right',
    weaponType: 'normal',
    powerupTimer: 0
};

// Lists for Entities
let bullets = [];
let enemyBullets = [];
let enemies = [];
let obstacles = [];
let powerups = [];

// Zombie Spawner Tracker
let targetKillsForLevel = 10;
let killsInCurrentLevel = 0;
let totalSpawnedInLevel = 0;
let spawnTimer = 0;
let spawnDelay = 100; // Frames between zombie spawns

// --- MENU & RESTART CONTROLS ---

function startGame() {
    startScreen.classList.add('style-hidden');
    endScreen.classList.add('style-hidden');
    
    score = 0;
    currentLevel = 1;
    resetPlayer();
    gameState = 'PLAYING';
    
    startLevel(currentLevel);
}

function restartGame() {
    startGame();
}

function resetPlayer() {
    player.x = 100;
    player.y = 300;
    player.hp = 100;
    player.dx = 0;
    player.dy = 0;
    player.weaponType = 'normal';
    player.powerupTimer = 0;
}

// --- LEVEL MECHANICS ---

function startLevel(lvl) {
    enemies = [];
    obstacles = [];
    bullets = [];
    enemyBullets = [];
    powerups = [];
    
    killsInCurrentLevel = 0;
    totalSpawnedInLevel = 0;
    spawnTimer = 0;
    
    // Kills required to complete the level
    targetKillsForLevel = 5 + (lvl * 3); 
    
    // Faster zombie spawning on higher levels
    spawnDelay = Math.max(30, 120 - (lvl * 8));

    // Add level obstacles
    const obstacleCount = 2 + Math.floor(lvl / 2);
    for (let i = 0; i < obstacleCount; i++) {
        obstacles.push({
            x: 250 + i * 170 + Math.random() * 40,
            y: 340,
            width: 40,
            height: 50
        });
    }
}

// CONTINUOUS SPAWNER MECHANIC (Runs inside main update loop)
function handleZombieSpawning() {
    // Keep spawning until total zombies created for this level reaches targetKillsForLevel
    if (totalSpawnedInLevel < targetKillsForLevel) {
        spawnTimer++;
        
        // Spawn a zombie when timer hits delay threshold OR if zero zombies exist on screen
        if (spawnTimer >= spawnDelay || enemies.length === 0) {
            spawnZombie();
            totalSpawnedInLevel++;
            spawnTimer = 0;
        }
    }
}

function spawnZombie() {
    const typeRoll = Math.random();
    let type = 'normal';

    if (typeRoll > 0.6 && currentLevel >= 2) type = 'flying';
    if (typeRoll > 0.85 && currentLevel >= 3) type = 'big';

    if (type === 'normal') {
        enemies.push({
            type: 'normal',
            x: canvas.width + 30,
            y: 340,
            width: 40,
            height: 50,
            hp: 20 + currentLevel * 5,
            speed: 1.5 + currentLevel * 0.25
        });
    } else if (type === 'flying') {
        enemies.push({
            type: 'flying',
            x: canvas.width + 30,
            y: 140 + Math.random() * 110,
            width: 35,
            height: 35,
            hp: 15 + currentLevel * 4,
            speed: 2 + currentLevel * 0.2,
            shootTimer: 0
        });
    } else if (type === 'big') {
        enemies.push({
            type: 'big',
            x: canvas.width + 30,
            y: 320,
            width: 60,
            height: 70,
            hp: 60 + currentLevel * 15,
            speed: 0.8 + currentLevel * 0.1,
            throwTimer: 0
        });
    }
}

// 8-Directional Shooting System
let canShoot = true;
function shoot() {
    if (!canShoot || gameState !== 'PLAYING') return;

    let bulletDx = 0;
    let bulletDy = 0;
    const bulletSpeed = 10;

    const up = keys['KeyW'] || keys['ArrowUp'];
    const down = keys['KeyS'] || keys['ArrowDown'];
    const left = keys['KeyA'] || keys['ArrowLeft'];
    const right = keys['KeyD'] || keys['ArrowRight'];

    if (right) bulletDx = bulletSpeed;
    else if (left) bulletDx = -bulletSpeed;

    if (up) bulletDy = -bulletSpeed;
    else if (down) bulletDy = bulletSpeed;

    if (bulletDx === 0 && bulletDy === 0) {
        bulletDx = (player.facing === 'left') ? -bulletSpeed : bulletSpeed;
    }

    if (bulletDx !== 0 && bulletDy !== 0) {
        bulletDx *= 0.7071;
        bulletDy *= 0.7071;
    }

    bullets.push({
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        width: 8,
        height: 8,
        dx: bulletDx,
        dy: bulletDy,
        damage: player.weaponType === 'rapid' ? 15 : 10
    });

    canShoot = false;
    setTimeout(() => { canShoot = true; }, player.weaponType === 'rapid' ? 110 : 230);
}

// --- MAIN UPDATE LOOP ---

function update() {
    if (gameState !== 'PLAYING') return;

    // Run Spawner continuously
    handleZombieSpawning();

    // Movement & Direction
    if (keys['KeyA'] || keys['ArrowLeft']) {
        player.dx = -player.speed;
        player.facing = 'left';
    } else if (keys['KeyD'] || keys['ArrowRight']) {
        player.dx = player.speed;
        player.facing = 'right';
    } else {
        player.dx = 0;
    }

    if ((keys['Space'] || keys['KeyK']) && player.grounded) {
        player.dy = player.jumpPower;
        player.grounded = false;
    }

    if (keys['KeyJ']) shoot();

    // Weapon Powerup Countdown
    if (player.powerupTimer > 0) {
        player.powerupTimer--;
        if (player.powerupTimer <= 0) player.weaponType = 'normal';
    }

    // Player Gravity & Bounds
    player.x += player.dx;
    player.dy += GRAVITY;
    player.y += player.dy;

    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    if (player.y + player.height >= 390) {
        player.y = 390 - player.height;
        player.dy = 0;
        player.grounded = true;
    }

    // Obstacle Collisions
    obstacles.forEach(obs => {
        if (player.x < obs.x + obs.width &&
            player.x + player.width > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.height > obs.y) {
            
            if (player.dx > 0 && player.x + player.width - player.dx <= obs.x) player.x = obs.x - player.width;
            if (player.dx < 0 && player.x - player.dx >= obs.x + obs.width) player.x = obs.x + obs.width;
        }
    });

    // Update Player Bullets
    bullets.forEach((b, index) => {
        b.x += b.dx;
        b.y += b.dy;
        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
            bullets.splice(index, 1);
        }
    });

    // Update Enemy Bullets
    enemyBullets.forEach((eb, index) => {
        eb.x += eb.dx;
        eb.y += eb.dy;

        if (eb.x < player.x + player.width &&
            eb.x + eb.width > player.x &&
            eb.y < player.y + player.height &&
            eb.y + eb.height > player.y) {
            
            player.hp -= eb.damage;
            enemyBullets.splice(index, 1);
            if (player.hp <= 0) triggerGameOver();
        } else if (eb.x < 0 || eb.y > canvas.height) {
            enemyBullets.splice(index, 1);
        }
    });

    // Update Zombies
    for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
        let enemy = enemies[eIndex];
        enemy.x -= enemy.speed;

        // Flying zombie shooting
        if (enemy.type === 'flying') {
            enemy.shootTimer++;
            if (enemy.shootTimer % 110 === 0) {
                enemyBullets.push({
                    x: enemy.x, y: enemy.y + enemy.height / 2,
                    width: 10, height: 4, dx: -5, dy: 1, damage: 10, color: '#FFF'
                });
            }
        }

        // Big zombie rock throw
        if (enemy.type === 'big') {
            enemy.throwTimer++;
            if (enemy.throwTimer % 160 === 0) {
                enemyBullets.push({
                    x: enemy.x, y: enemy.y,
                    width: 16, height: 16, dx: -4, dy: -4, damage: 20, color: '#795548'
                });
            }
        }

        // Bullet vs Zombie Collision
        for (let bIndex = bullets.length - 1; bIndex >= 0; bIndex--) {
            let b = bullets[bIndex];
            if (b.x < enemy.x + enemy.width &&
                b.x + b.width > enemy.x &&
                b.y < enemy.y + enemy.height &&
                b.y + b.height > enemy.y) {
                
                enemy.hp -= b.damage;
                bullets.splice(bIndex, 1);

                // Zombie Defeated
                if (enemy.hp <= 0) {
                    if (Math.random() < 0.25) {
                        powerups.push({
                            x: enemy.x, y: enemy.y, width: 20, height: 20,
                            type: Math.random() > 0.5 ? 'heal' : 'rapid'
                        });
                    }

                    enemies.splice(eIndex, 1);
                    score += 100;
                    killsInCurrentLevel++;

                    // CHECK LEVEL FINISH CONDITIONS
                    if (killsInCurrentLevel >= targetKillsForLevel) {
                        if (currentLevel < MAX_LEVELS) {
                            currentLevel++;
                            startLevel(currentLevel);
                        } else {
                            triggerGameWin(); // Clear Game!
                        }
                    }
                    break;
                }
            }
        }

        // Zombie Touch Player Damage
        if (enemy && enemy.x < player.x + player.width &&
            enemy.x + enemy.width > player.x &&
            enemy.y < player.y + player.height &&
            enemy.y + enemy.height > player.y) {
            
            player.hp -= 0.6;
            if (player.hp <= 0) triggerGameOver();
        }
    }

    // Update Powerups
    powerups.forEach((p, index) => {
        p.y += 2;
        if (p.y + p.height >= 390) p.y = 390 - p.height;

        if (player.x < p.x + p.width &&
            player.x + player.width > p.x &&
            player.y < p.y + p.height &&
            player.y + player.height > p.y) {
            
            if (p.type === 'heal') {
                player.hp = Math.min(player.maxHp, player.hp + 35);
            } else if (p.type === 'rapid') {
                player.weaponType = 'rapid';
                player.powerupTimer = 350;
            }
            powerups.splice(index, 1);
        }
    });

    // Update Top HUD
    hpEl.innerText = Math.max(0, Math.floor(player.hp));
    scoreEl.innerText = score;
    levelEl.innerText = currentLevel;
    enemiesLeftEl.innerText = Math.max(0, targetKillsForLevel - killsInCurrentLevel);
}

// Trigger Game Over Menu
function triggerGameOver() {
    gameState = 'GAMEOVER';
    endTitle.innerText = "GAME OVER";
    endTitle.style.color = "#ff5252";
    endMsg.innerText = `You died on Level ${currentLevel} with a score of ${score}!`;
    endScreen.classList.remove('style-hidden');
}

// Trigger Game Win Menu
function triggerGameWin() {
    gameState = 'WIN';
    endTitle.innerText = "VICTORY!";
    endTitle.style.color = "#00e676";
    endMsg.innerText = `Awesome! You cleared all 10 Levels! Final Score: ${score}!`;
    endScreen.classList.remove('style-hidden');
}

// --- DRAWING ENGINE ---

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    if (imgBg && imgBg.complete && imgBg.naturalWidth !== 0) {
        ctx.drawImage(imgBg, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 390, canvas.width, 10);
    }

    // Player
    if (imgPlayer && imgPlayer.complete && imgPlayer.naturalWidth !== 0) {
        ctx.drawImage(imgPlayer, player.x, player.y, player.width, player.height);
    } else {
        ctx.fillStyle = player.powerupTimer > 0 ? '#00E676' : '#2196F3';
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    // Obstacles
    ctx.fillStyle = '#795548';
    obstacles.forEach(obs => ctx.fillRect(obs.x, obs.y, obs.width, obs.height));

    // Bullets
    ctx.fillStyle = '#FFEB3B';
    bullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));

    // Enemy Bullets
    enemyBullets.forEach(eb => {
        ctx.fillStyle = eb.color;
        ctx.fillRect(eb.x, eb.y, eb.width, eb.height);
    });

    // Zombies
    enemies.forEach(e => {
        let currentImg = imgZombieNormal;
        let fallbackColor = '#4CAF50';

        if (e.type === 'flying') {
            currentImg = imgZombieFlying;
            fallbackColor = '#FFEB3B';
        } else if (e.type === 'big') {
            currentImg = imgZombieBig;
            fallbackColor = '#9C27B0';
        }

        if (currentImg && currentImg.complete && currentImg.naturalWidth !== 0) {
            ctx.drawImage(currentImg, e.x, e.y, e.width, e.height);
        } else {
            ctx.fillStyle = fallbackColor;
            ctx.fillRect(e.x, e.y, e.width, e.height);
        }
    });

    // Powerups
    powerups.forEach(p => {
        ctx.fillStyle = p.type === 'heal' ? '#E91E63' : '#00BCD4';
        ctx.fillRect(p.x, p.y, p.width, p.height);
    });
}

// Game Loop
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();