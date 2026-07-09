const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let isGameOver = false;
let isLevelSelect = true;
let isVictory = false;
let stage1BossSpawned = false;
let stage1BossDefeated = false;
let stage2BossSpawned = false;
let stage2BossDefeated = false;
let stage3BossSpawned = false;
let stage3BossDefeated = false;
let menuTransitionCooldown = 0;
let score = 0;
let highScore = localStorage.getItem('highScore') ? parseInt(localStorage.getItem('highScore')) : 125000;
let stageLevel = 1;
let stageSubLevel = 1;
let last1UpScore = 0;
let textNotifications = [];
let bgTransitionAlpha = 0;
let bgTransitionAlpha3 = 0;

// Inputs
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
};

window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.ArrowUp = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.ArrowDown = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.ArrowLeft = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.ArrowRight = true;
    if (e.code === 'Space') keys.Space = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.ArrowUp = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.ArrowDown = false;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.ArrowLeft = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.ArrowRight = false;
    if (e.code === 'Space') keys.Space = false;
});

// Load Assets
const assets = {
    bg: new Image(),
    bg2: new Image(),
    bg3: new Image(),
    hero: new Image(),
    enemy: new Image(),
    laser: new Image(),
    explosion: new Image(),
    enemyBlue: null,
    enemyBoss: null,
    laserRed: null
};

function tintImage(img, color) {
    const buffer = document.createElement('canvas');
    buffer.width = 1024;
    buffer.height = 1024;
    const ctxBuf = buffer.getContext('2d');
    ctxBuf.drawImage(img, 0, 0, buffer.width, buffer.height);
    ctxBuf.globalCompositeOperation = 'source-atop';
    ctxBuf.fillStyle = color;
    ctxBuf.fillRect(0, 0, buffer.width, buffer.height);
    return buffer;
}

assets.enemy.onload = () => {
    assets.enemyBlue = tintImage(assets.enemy, 'rgba(30, 100, 255, 0.45)');
    assets.enemyBoss = tintImage(assets.enemy, 'rgba(255, 0, 0, 0.6)');
};

assets.laser.onload = () => {
    assets.laserRed = tintImage(assets.laser, 'rgba(255, 30, 30, 0.6)');
};

assets.bg.src = 'assets/background.png';
assets.bg2.src = 'assets/background2.png';
assets.bg3.src = 'assets/background3.png';
assets.hero.src = 'assets/hero.png';
assets.enemy.src = 'assets/enemy.png';
assets.laser.src = 'assets/laser.png';
assets.explosion.src = 'assets/explosion.png';

let bgY = 0;

// Player Setup
const player = {
    x: canvas.width / 2 - 50,
    y: canvas.height - 130,
    width: 100,
    height: 100,
    speed: 5,
    cooldown: 0,
    health: 5,
    maxHealth: 5,
    lives: 3,
    invincible: 0,
    weaponLevel: 1,
    isDead: false,
    respawnTimer: 0
};

// Arrays for entities
let lasers = [];
let enemies = [];
let explosions = [];
let powerups = [];

// Functions
function spawnEnemy() {
    // Do not spawn enemies during boss fight or victory
    if (stage1BossSpawned && !stage1BossDefeated) return;
    if (stage2BossSpawned && !stage2BossDefeated) return;
    if (stage3BossSpawned && !stage3BossDefeated) return;
    if (isVictory) return;
    if (enemies.some(e => e.type === 'boss1' || e.type === 'boss2' || e.type === 'boss3')) return;

    // Enemy spawning probability increases slightly with stage
    const spawnChance = 0.02 + (stageLevel * 0.005);
    if (Math.random() < spawnChance) {
        const spawnX = Math.random() * (canvas.width - 120); // Scale bounds to largest enemy size
        const r = Math.random();
        if (r < 0.15) {
            // Type 2: Heavy Blue enemy (Big, slow, 30 HP)
            enemies.push({
                x: spawnX,
                y: -140,
                width: 130,
                height: 130,
                speed: 1 + Math.random() * 0.5,
                type: 2,
                health: 30,
                maxHealth: 30,
                initialX: spawnX,
                timer: 0
            });
        } else if (r < 0.45) {
            // Type 1: Swerving enemy (Standard HP)
            enemies.push({
                x: spawnX,
                y: -100,
                width: 80,
                height: 80,
                speed: 2 + Math.random() * 2 + (stageLevel * 0.5),
                type: 1,
                health: 1,
                maxHealth: 1,
                initialX: spawnX,
                timer: 0
            });
        } else {
            // Type 0: Standard enemy
            enemies.push({
                x: spawnX,
                y: -100,
                width: 80,
                height: 80,
                speed: 2 + Math.random() * 2 + (stageLevel * 0.5),
                type: 0,
                health: 1,
                maxHealth: 1,
                initialX: spawnX,
                timer: 0
            });
        }
    }
}

function damagePlayer() {
    if (player.invincible > 0 || player.isDead) return;

    player.health--;
    player.weaponLevel = Math.max(1, player.weaponLevel - 1); // Downgrade weapon on hit

    if (player.health <= 0) {
        player.lives--;
        player.weaponLevel = 1; // Reset weapon level on death
        player.isDead = true;
        player.respawnTimer = 120; // 2 seconds (120 frames at 60fps)

        // Spawn player death explosion
        explosions.push({
            x: player.x + player.width / 2,
            y: player.y + player.height / 2,
            timer: 30,
            maxTimer: 30,
            size: 160,
            type: 'player'
        });

        if (player.lives <= 0) {
            isGameOver = true;
            menuTransitionCooldown = 60; // 1 second cooldown
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('highScore', highScore);
            }
        }
    } else {
        player.invincible = 30; // 0.5 second invincibility (30 frames)
    }
}

function updateUI() {
    document.getElementById('ui-score').innerText = String(score).padStart(7, '0');
    document.getElementById('ui-highscore').innerText = String(highScore).padStart(7, '0');
    document.getElementById('ui-stage').innerText = `${stageLevel}-${stageSubLevel}`;
    document.getElementById('ui-lives').innerText = '❤️'.repeat(Math.max(0, player.lives));

    const healthBlocks = document.querySelectorAll('#ui-health .health-block');
    healthBlocks.forEach((block, i) => {
        if (i < player.health) {
            block.classList.add('active');
        } else {
            block.classList.remove('active');
        }
    });
}

function update() {
    if (isGameOver || isVictory) {
        if (menuTransitionCooldown > 0) {
            menuTransitionCooldown--;
        }
        // Restart logic (Only allowed after transition cooldown is complete)
        if (keys.Space && menuTransitionCooldown <= 0) {
            isGameOver = false;
            isVictory = false;
            stage1BossSpawned = false;
            stage1BossDefeated = false;
            stage2BossSpawned = false;
            stage2BossDefeated = false;
            stage3BossSpawned = false;
            stage3BossDefeated = false;
            isLevelSelect = true;
            document.getElementById('level-select-screen').style.display = 'flex';
        }
        updateUI();
        return;
    }

    if (isLevelSelect) {
        // Scroll background behind overlay for dynamic feel (grow indefinitely)
        bgY += 1;
        if (bgY > canvas.height * 100) bgY = bgY % (canvas.height * 2);

        if (typeof bgY2 === 'undefined') window.bgY2 = 0;
        bgY2 += 0.5;
        if (bgY2 > canvas.height * 100) bgY2 = bgY2 % (canvas.height * 2);

        updateUI();
        return;
    }

    // Decrement invincibility
    if (player.invincible > 0) {
        player.invincible--;
    }

    // Handle respawn timer
    if (player.isDead) {
        player.respawnTimer--;
        if (player.respawnTimer <= 0 && !isGameOver) {
            player.isDead = false;
            player.health = player.maxHealth;
            player.invincible = 60; // 1 second invincibility
            player.x = canvas.width / 2 - 50;
            player.y = canvas.height - 130;
        }
    }

    // Background scroll (grow indefinitely to keep mirror parity constant)
    bgY += 1;
    if (bgY > canvas.height * 100) bgY = bgY % (canvas.height * 2);

    // Parallax background
    if (typeof bgY2 === 'undefined') window.bgY2 = 0;
    bgY2 += 0.5;
    if (bgY2 > canvas.height * 100) bgY2 = bgY2 % (canvas.height * 2);

    // Spawn Stage 1 Boss if score >= 15000 and not spawned yet
    if (score >= 15000 && !stage1BossSpawned && !stage1BossDefeated) {
        stage1BossSpawned = true;
        console.log("Stage 1 Boss Spawned! Score:", score);
        enemies.push({
            x: canvas.width / 2 - 100,
            y: 130, // Avoid top HUD banner overlap
            width: 200,
            height: 200,
            speed: 3, // Stage 1 Boss speed = 3
            direction: 1,
            type: 'boss1',
            health: 100,
            maxHealth: 100
        });
    }

    // Spawn Stage 2 Boss if Stage 1 Boss is defeated and score >= 30000 (which is 15k scored in Stage 2)
    if (score >= 30000 && stage1BossDefeated && !stage2BossSpawned && !stage2BossDefeated && !isVictory) {
        stage2BossSpawned = true;
        console.log("Stage 2 Boss Spawned! Score:", score);
        enemies.push({
            x: canvas.width / 2 - 100,
            y: 130, // Avoid top HUD banner overlap
            width: 200,
            height: 200,
            speed: 5, // Stage 2 Boss speed = 5
            direction: 1,
            type: 'boss2',
            health: 150,
            maxHealth: 150
        });
    }

    // Spawn Stage 3 Boss if Stage 2 Boss is defeated and score >= 45000 (which is 15k scored in Stage 3)
    if (score >= 45000 && stage2BossDefeated && !stage3BossSpawned && !stage3BossDefeated && !isVictory) {
        stage3BossSpawned = true;
        console.log("Stage 3 Boss Spawned! Score:", score);
        enemies.push({
            x: canvas.width / 2 - 100,
            y: 130, // Avoid top HUD banner overlap
            width: 200,
            height: 200,
            speed: 6, // Stage 3 Boss speed = 6
            direction: 1,
            type: 'boss3',
            health: 200,
            maxHealth: 200
        });
    }

    // Only allow player movement and shooting if alive
    if (!player.isDead) {
        // Player movement
        if (keys.ArrowUp && player.y > 0) player.y -= player.speed;
        if (keys.ArrowDown && player.y < canvas.height - player.height) player.y += player.speed;
        if (keys.ArrowLeft && player.x > 0) player.x -= player.speed;
        if (keys.ArrowRight && player.x < canvas.width - player.width) player.x += player.speed;
    }

    // Player shooting (Only allow if alive)
    if (!player.isDead && keys.Space && player.cooldown <= 0) {
        const level = player.weaponLevel || 1;
        const laserWidth = 20;
        const laserHeight = 60;
        const laserSpeed = 10;
        const yPos = player.y - 30;

        if (level === 1) {
            lasers.push({
                x: player.x + player.width / 2 - laserWidth / 2,
                y: yPos,
                width: laserWidth,
                height: laserHeight,
                speed: laserSpeed
            });
        } else if (level === 2) {
            lasers.push({
                x: player.x + 20 - laserWidth / 2,
                y: yPos,
                width: laserWidth,
                height: laserHeight,
                speed: laserSpeed
            });
            lasers.push({
                x: player.x + player.width - 20 - laserWidth / 2,
                y: yPos,
                width: laserWidth,
                height: laserHeight,
                speed: laserSpeed
            });
        } else if (level === 3) {
            lasers.push({
                x: player.x + 15 - laserWidth / 2,
                y: yPos,
                width: laserWidth,
                height: laserHeight,
                speed: laserSpeed
            });
            lasers.push({
                x: player.x + player.width / 2 - laserWidth / 2,
                y: yPos,
                width: laserWidth,
                height: laserHeight,
                speed: laserSpeed
            });
            lasers.push({
                x: player.x + player.width - 15 - laserWidth / 2,
                y: yPos,
                width: laserWidth,
                height: laserHeight,
                speed: laserSpeed
            });
        } else if (level === 4) {
            const step = player.width / 5;
            for (let i = 1; i <= 4; i++) {
                lasers.push({
                    x: player.x + step * i - laserWidth / 2,
                    y: yPos,
                    width: laserWidth,
                    height: laserHeight,
                    speed: laserSpeed
                });
            }
        } else if (level >= 5) {
            const step = player.width / 6;
            for (let i = 1; i <= 5; i++) {
                lasers.push({
                    x: player.x + step * i - laserWidth / 2,
                    y: yPos,
                    width: laserWidth,
                    height: laserHeight,
                    speed: laserSpeed
                });
            }
        }
        player.cooldown = 15; // Frames between shots
    }
    if (player.cooldown > 0) player.cooldown--;

    // Update lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
        let laser = lasers[i];
        if (laser.isEnemy) {
            laser.y += laser.speed;
            if (laser.y > canvas.height) {
                lasers.splice(i, 1);
                continue;
            }

            // Check collision with player (using centered shrunken hitboxes for accuracy)
            const playerHitbox = {
                x: player.x + player.width * 0.2,
                y: player.y + player.height * 0.2,
                w: player.width * 0.6,
                h: player.height * 0.6
            };
            const laserHitbox = {
                x: laser.x + laser.width * 0.2,
                y: laser.y + laser.height * 0.1,
                w: laser.width * 0.6,
                h: laser.height * 0.8
            };

            if (
                !player.isDead &&
                laserHitbox.x < playerHitbox.x + playerHitbox.w &&
                laserHitbox.x + laserHitbox.w > playerHitbox.x &&
                laserHitbox.y < playerHitbox.y + playerHitbox.h &&
                laserHitbox.y + laserHitbox.h > playerHitbox.y
            ) {
                lasers.splice(i, 1);
                damagePlayer();
            }
        } else {
            laser.y -= laser.speed;
            if (laser.y < -50) {
                lasers.splice(i, 1);
            }
        }
    }

    // Update enemies
    enemies.forEach((enemy, i) => {
        const isAnyBoss = enemy.type === 'boss1' || enemy.type === 'boss2' || enemy.type === 'boss3';
        if (isAnyBoss) {
            // Boss moves only horizontally at the top
            enemy.x += enemy.speed * enemy.direction;
            if (enemy.x <= 10 || enemy.x >= canvas.width - enemy.width - 10) {
                enemy.direction *= -1;
            }

            // Boss firing logic
            if (typeof enemy.cooldown === 'undefined') enemy.cooldown = 0;
            enemy.cooldown--;
            if (enemy.cooldown <= 0) {
                const laserWidth = 20;
                const laserHeight = 60;
                const laserSpeed = 8;

                lasers.push({
                    x: enemy.x + 30 - laserWidth / 2,
                    y: enemy.y + enemy.height - 20,
                    width: laserWidth,
                    height: laserHeight,
                    speed: laserSpeed,
                    isEnemy: true
                });
                lasers.push({
                    x: enemy.x + enemy.width - 30 - laserWidth / 2,
                    y: enemy.y + enemy.height - 20,
                    width: laserWidth,
                    height: laserHeight,
                    speed: laserSpeed,
                    isEnemy: true
                });

                enemy.cooldown = 60; // Fires every 1 second
            }
        } else {
            enemy.y += enemy.speed;
        }

        if (enemy.type === 1) {
            enemy.timer += 0.05;
            enemy.x = enemy.initialX + Math.sin(enemy.timer) * 100;
        }

        // Collision with player (using centered shrunken hitboxes for accuracy)
        const playerHitbox = {
            x: player.x + player.width * 0.2,
            y: player.y + player.height * 0.2,
            w: player.width * 0.6,
            h: player.height * 0.6
        };
        const enemyHitbox = {
            x: enemy.x + enemy.width * 0.15,
            y: enemy.y + enemy.height * 0.15,
            w: enemy.width * 0.7,
            h: enemy.height * 0.7
        };

        if (
            playerHitbox.x < enemyHitbox.x + enemyHitbox.w &&
            playerHitbox.x + playerHitbox.w > enemyHitbox.x &&
            playerHitbox.y < enemyHitbox.y + enemyHitbox.h &&
            playerHitbox.y + playerHitbox.h > enemyHitbox.y
        ) {
            damagePlayer();
            if (!isAnyBoss) {
                enemies.splice(i, 1);
            }
        }

        // Off screen (bosses never go off screen)
        else if (!isAnyBoss && enemy.y > canvas.height) {
            enemies.splice(i, 1);
        }
    });

    // Check laser hits
    for (let l = lasers.length - 1; l >= 0; l--) {
        let laser = lasers[l];
        if (laser.isEnemy) continue; // Skip enemy lasers hitting enemies
        for (let e = enemies.length - 1; e >= 0; e--) {
            const enemy = enemies[e];
            const laserHitbox = {
                x: laser.x + laser.width * 0.2,
                y: laser.y + laser.height * 0.1,
                w: laser.width * 0.6,
                h: laser.height * 0.8
            };
            const enemyHitbox = {
                x: enemy.x + enemy.width * 0.15,
                y: enemy.y + enemy.height * 0.15,
                w: enemy.width * 0.7,
                h: enemy.height * 0.7
            };

            if (
                laserHitbox.x < enemyHitbox.x + enemyHitbox.w &&
                laserHitbox.x + laserHitbox.w > enemyHitbox.x &&
                laserHitbox.y < enemyHitbox.y + enemyHitbox.h &&
                laserHitbox.y + laserHitbox.h > enemyHitbox.y
            ) {
                // Destroy laser
                lasers.splice(l, 1);

                // Subtract HP
                enemy.health--;
                if (enemy.health <= 0) {
                    const isHeavy = enemy.type === 2;
                    const isBoss1 = enemy.type === 'boss1';
                    const isBoss2 = enemy.type === 'boss2';
                    const isBoss3 = enemy.type === 'boss3';
                    const isAnyBoss = isBoss1 || isBoss2 || isBoss3;

                    // Fully destroyed (Spawn animated explosion at center of ship)
                    explosions.push({
                        x: enemy.x + enemy.width / 2,
                        y: enemy.y + enemy.height / 2,
                        timer: isAnyBoss ? 75 : (isHeavy ? 35 : 25),
                        maxTimer: isAnyBoss ? 75 : (isHeavy ? 35 : 25),
                        size: isAnyBoss ? 350 : (isHeavy ? 200 : 120),
                        type: isAnyBoss ? 'boss' : (isHeavy ? 'heavy' : 'standard')
                    });

                    if (isBoss1) {
                        stage1BossDefeated = true;
                        textNotifications.push({
                            x: canvas.width / 2,
                            y: canvas.height / 2 - 50,
                            text: "STAGE 2 UNLOCKED!",
                            timer: 120,
                            maxTimer: 120,
                            color: "#00ffff"
                        });
                        console.log("Stage 1 Boss Defeated! Progression unlocked.");
                    } else if (isBoss2) {
                        stage2BossDefeated = true;
                        textNotifications.push({
                            x: canvas.width / 2,
                            y: canvas.height / 2 - 50,
                            text: "STAGE 3 UNLOCKED!",
                            timer: 120,
                            maxTimer: 120,
                            color: "#00ff88"
                        });
                        console.log("Stage 2 Boss Defeated! Stage 3 unlocked.");
                    } else if (isBoss3) {
                        isVictory = true;
                        stage3BossDefeated = true;
                        menuTransitionCooldown = 90; // 1.5 second cooldown to show victory text
                        console.log("Boss 3 Defeated! Victory triggered.");
                    } else {
                        const dropChance = isHeavy ? 0.45 : 0.15;
                        if (Math.random() < dropChance) {
                            powerups.push({
                                x: enemy.x + enemy.width / 2 - 10,
                                y: enemy.y + enemy.height / 2 - 10,
                                width: 20,
                                height: 20,
                                speed: 2
                            });
                        }
                    }
                    enemies.splice(e, 1);
                    score += isAnyBoss ? 5000 : (isHeavy ? 1000 : 100);

                    if (score > highScore) {
                        highScore = score;
                    }
                } else {
                    // Small impact spark for non-lethal hit
                    explosions.push({
                        x: laser.x,
                        y: laser.y,
                        timer: 10,
                        maxTimer: 10,
                        size: 40,
                        type: 'spark'
                    });
                }
                break; // Break loop since laser is spent
            }
        }
    }

    // Update explosions
    explosions.forEach((exp, i) => {
        exp.timer--;
        if (exp.timer <= 0) explosions.splice(i, 1);
    });

    // Update powerups
    powerups.forEach((pu, i) => {
        pu.y += pu.speed;

        if (
            player.x < pu.x + pu.width &&
            player.x + player.width > pu.x &&
            player.y < pu.y + pu.height &&
            player.y + player.height > pu.y
        ) {
            score += 500;
            player.weaponLevel = Math.min(5, player.weaponLevel + 1); // Upgrade weapon level (max 5)
            player.cooldown = 0;
            powerups.splice(i, 1);
        } else if (pu.y > canvas.height) {
            powerups.splice(i, 1);
        }
    });

    // Stage progression
    if (!stage1BossDefeated) {
        stageLevel = 1;
        stageSubLevel = Math.min(3, Math.floor(score / 5000) + 1);
        bgTransitionAlpha = 0;
        bgTransitionAlpha3 = 0;
    } else if (!stage2BossDefeated) {
        stageLevel = 2;
        stageSubLevel = Math.min(3, Math.floor((score - 15000) / 5000) + 1);
        bgTransitionAlpha = Math.min(1, bgTransitionAlpha + 0.005);
        bgTransitionAlpha3 = 0;
    } else {
        stageLevel = 3;
        stageSubLevel = Math.floor((score - 30000) / 5000) + 1;
        bgTransitionAlpha = 1;
        bgTransitionAlpha3 = Math.min(1, bgTransitionAlpha3 + 0.005);
    }

    // Check for 1UP every 10,000 points
    if (score - last1UpScore >= 10000) {
        last1UpScore = Math.floor(score / 10000) * 10000;
        player.lives = Math.min(5, player.lives + 1); // Limit to max 5 lives
        textNotifications.push({
            x: canvas.width / 2,
            y: canvas.height / 2 - 50,
            text: "+1 LIFE!",
            timer: 90,
            maxTimer: 90,
            color: "#00ff66"
        });
    }

    // Update text notifications
    for (let i = textNotifications.length - 1; i >= 0; i--) {
        let note = textNotifications[i];
        note.timer--;
        note.y -= 0.8; // Float upwards
        if (note.timer <= 0) {
            textNotifications.splice(i, 1);
        }
    }

    spawnEnemy();
    updateUI();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw scrolling background
    let currentBg1 = assets.bg;
    let currentBg2 = assets.bg2;
    let currentBg3 = assets.bg3;

    // Draw height with +1 pixel overlap to close gap
    const drawHeight = canvas.height + 1;

    // Main layer coordinate calculations
    const yOffset_main = Math.floor(bgY % canvas.height);
    const tileIndex_main = Math.floor(bgY / canvas.height);
    const y1_main = yOffset_main;
    const y2_main = yOffset_main - canvas.height;
    const mirror1_main = (tileIndex_main % 2 !== 0);
    const mirror2_main = ((tileIndex_main + 1) % 2 !== 0);

    // Parallax layer coordinate calculations
    const bgY2_val = (typeof bgY2 !== 'undefined' ? bgY2 : 0);
    const yOffset_para = Math.floor(bgY2_val % canvas.height);
    const tileIndex_para = Math.floor(bgY2_val / canvas.height);
    const y1_para = yOffset_para;
    const y2_para = yOffset_para - canvas.height;
    const mirror1_para = (tileIndex_para % 2 !== 0);
    const mirror2_para = ((tileIndex_para + 1) % 2 !== 0);

    // Helper to draw a background tile with correct alpha, translation, mirroring, and size
    function drawTile(img, y, alpha, mirror) {
        ctx.save();
        ctx.globalAlpha = alpha;
        if (mirror) {
            ctx.translate(0, y + drawHeight / 2);
            ctx.scale(1, -1);
            ctx.drawImage(img, 0, -drawHeight / 2, canvas.width, drawHeight);
        } else {
            ctx.drawImage(img, 0, y, canvas.width, drawHeight);
        }
        ctx.restore();
    }

    if (currentBg1.complete && bgTransitionAlpha < 1) {
        // Parallax layer (Stage 1)
        drawTile(currentBg1, y1_para, 0.4 * (1 - bgTransitionAlpha), mirror1_para);
        drawTile(currentBg1, y2_para, 0.4 * (1 - bgTransitionAlpha), mirror2_para);

        // Main layer (Stage 1)
        drawTile(currentBg1, y1_main, 1.0 * (1 - bgTransitionAlpha), mirror1_main);
        drawTile(currentBg1, y2_main, 1.0 * (1 - bgTransitionAlpha), mirror2_main);
    }

    const stage2Alpha = bgTransitionAlpha * (1 - bgTransitionAlpha3);
    if (stage2Alpha > 0 && currentBg2.complete) {
        // Parallax layer (Stage 2)
        drawTile(currentBg2, y1_para, 0.4 * stage2Alpha, mirror1_para);
        drawTile(currentBg2, y2_para, 0.4 * stage2Alpha, mirror2_para);

        // Main layer (Stage 2)
        drawTile(currentBg2, y1_main, 1.0 * stage2Alpha, mirror1_main);
        drawTile(currentBg2, y2_main, 1.0 * stage2Alpha, mirror2_main);
    }

    if (bgTransitionAlpha3 > 0 && currentBg3.complete) {
        // Parallax layer (Stage 3)
        drawTile(currentBg3, y1_para, 0.4 * bgTransitionAlpha3, mirror1_para);
        drawTile(currentBg3, y2_para, 0.4 * bgTransitionAlpha3, mirror2_para);

        // Main layer (Stage 3)
        drawTile(currentBg3, y1_main, 1.0 * bgTransitionAlpha3, mirror1_main);
        drawTile(currentBg3, y2_main, 1.0 * bgTransitionAlpha3, mirror2_main);
    }

    if (!currentBg1.complete && !currentBg2.complete && !currentBg3.complete) {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw player shadow (if transitioning or in Stage 2/3)
    const shadowAlpha = Math.max(bgTransitionAlpha, bgTransitionAlpha3);
    if (!player.isDead && shadowAlpha > 0 && assets.hero.complete) {
        ctx.save();
        ctx.globalAlpha = 0.25 * shadowAlpha;
        ctx.filter = 'brightness(0) blur(2px)';
        ctx.drawImage(assets.hero, player.x + 15, player.y + 25, player.width, player.height);
        ctx.restore();
    }

    // Draw player (flash solid white if invincible, only draw if alive)
    if (!player.isDead) {
        if (assets.hero.complete) {
            if (player.invincible > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
                // Render ship as a solid white silhouette
                if (!window.playerBufferCanvas) {
                    window.playerBufferCanvas = document.createElement('canvas');
                    window.playerBufferCanvas.width = 100;
                    window.playerBufferCanvas.height = 100;
                    window.playerBufferCtx = window.playerBufferCanvas.getContext('2d');
                }
                const pCtx = window.playerBufferCtx;
                pCtx.clearRect(0, 0, 100, 100);
                pCtx.drawImage(assets.hero, 0, 0, 100, 100);
                pCtx.globalCompositeOperation = 'source-in';
                pCtx.fillStyle = '#ffffff';
                pCtx.fillRect(0, 0, 100, 100);
                pCtx.globalCompositeOperation = 'source-over';

                ctx.drawImage(window.playerBufferCanvas, player.x, player.y, player.width, player.height);
            } else {
                ctx.drawImage(assets.hero, player.x, player.y, player.width, player.height);
            }
        } else {
            ctx.fillStyle = 'white';
            ctx.fillRect(player.x, player.y, player.width, player.height);
        }
    }

    // Draw lasers
    lasers.forEach(laser => {
        if (laser.isEnemy) {
            if (assets.laserRed) {
                ctx.drawImage(assets.laserRed, laser.x, laser.y, laser.width, laser.height);
            } else if (assets.laser.complete) {
                ctx.drawImage(assets.laser, laser.x, laser.y, laser.width, laser.height);
            } else {
                ctx.fillStyle = 'red';
                ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
            }
        } else {
            if (assets.laser.complete) {
                ctx.drawImage(assets.laser, laser.x, laser.y, laser.width, laser.height);
            } else {
                ctx.fillStyle = 'cyan';
                ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
            }
        }
    });

    // Draw enemy shadows first (if transitioning or in Stage 2/3)
    const shadowAlpha_enemy = Math.max(bgTransitionAlpha, bgTransitionAlpha3);
    if (shadowAlpha_enemy > 0) {
        enemies.forEach(enemy => {
            if (assets.enemy.complete) {
                ctx.save();
                ctx.globalAlpha = 0.25 * shadowAlpha_enemy;
                ctx.filter = 'brightness(0) blur(2px)';
                const isAnyBoss = enemy.type === 'boss1' || enemy.type === 'boss2' || enemy.type === 'boss3';
                const shadowOffsetX = 18 + (enemy.type === 2 ? 8 : (isAnyBoss ? 25 : 0)); // Drop-offset representing flight altitude
                const shadowOffsetY = 24 + (enemy.type === 2 ? 12 : (isAnyBoss ? 35 : 0));

                if (isAnyBoss && assets.enemyBoss) {
                    ctx.drawImage(assets.enemyBoss, enemy.x + shadowOffsetX, enemy.y + shadowOffsetY, enemy.width, enemy.height);
                } else if (enemy.type === 2 && assets.enemyBlue) {
                    ctx.drawImage(assets.enemyBlue, enemy.x + shadowOffsetX, enemy.y + shadowOffsetY, enemy.width, enemy.height);
                } else {
                    ctx.drawImage(assets.enemy, enemy.x + shadowOffsetX, enemy.y + shadowOffsetY, enemy.width, enemy.height);
                }
                ctx.restore();
            }
        });
    }

    // Draw enemies
    enemies.forEach(enemy => {
        const isAnyBoss = enemy.type === 'boss1' || enemy.type === 'boss2' || enemy.type === 'boss3';
        if (isAnyBoss) {
            // Draw red heavy boss enemy
            if (assets.enemyBoss) {
                ctx.drawImage(assets.enemyBoss, enemy.x, enemy.y, enemy.width, enemy.height);
            } else if (assets.enemy.complete) {
                ctx.drawImage(assets.enemy, enemy.x, enemy.y, enemy.width, enemy.height);
            } else {
                ctx.fillStyle = 'red';
                ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            }
        } else if (enemy.type === 2) {
            // Draw blue heavy enemy
            if (assets.enemyBlue) {
                ctx.drawImage(assets.enemyBlue, enemy.x, enemy.y, enemy.width, enemy.height);
            } else if (assets.enemy.complete) {
                ctx.drawImage(assets.enemy, enemy.x, enemy.y, enemy.width, enemy.height);
            } else {
                ctx.fillStyle = 'darkblue';
                ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            }

            // Draw mini health bar above the heavy enemy
            const maxHp = enemy.maxHealth || 5;
            const barW = enemy.width * 0.7;
            const barH = 6;
            const barX = enemy.x + (enemy.width - barW) / 2;
            const barY = enemy.y - 12;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = '#ff3333';
            ctx.fillRect(barX, barY, barW * (enemy.health / maxHp), barH);
        } else {
            // Draw standard or swerving enemy
            if (assets.enemy.complete) {
                ctx.drawImage(assets.enemy, enemy.x, enemy.y, enemy.width, enemy.height);
            } else {
                ctx.fillStyle = 'red';
                ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            }
        }
    });

    // Draw explosions (Animated expanding and fading particles/rings)
    explosions.forEach(exp => {
        const maxTimer = exp.maxTimer || 20;
        const progress = (maxTimer - exp.timer) / maxTimer;

        // Scale rises smoothly using sine easing
        const scale = Math.sin(progress * Math.PI / 2);
        const currentSize = exp.size * scale;
        const alpha = 1 - progress;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(exp.x, exp.y);

        // Rotate sprite to give a spinning debris/blast feel
        const rotation = (exp.x + exp.y + exp.timer) * 0.05;
        ctx.rotate(rotation);

        if (assets.explosion.complete) {
            ctx.drawImage(
                assets.explosion,
                -currentSize / 2,
                -currentSize / 2,
                currentSize,
                currentSize
            );
        } else {
            ctx.fillStyle = 'orange';
            ctx.beginPath();
            ctx.arc(0, 0, currentSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Draw an expanding energy ring for full kills
        if (exp.type !== 'spark') {
            ctx.save();
            ctx.strokeStyle = `rgba(255, ${Math.floor(100 + 155 * (1 - progress))}, 50, ${alpha * 0.8})`;
            ctx.lineWidth = 3 * (1 - progress);
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, currentSize * 0.65, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    });

    // Draw powerups
    powerups.forEach(pu => {
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.arc(pu.x + pu.width / 2, pu.y + pu.height / 2, pu.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = '10px monospace';
        ctx.fillText('P', pu.x + pu.width / 2, pu.y + pu.height / 2 + 3);
    });

    // Draw text notifications
    textNotifications.forEach(note => {
        ctx.save();
        ctx.globalAlpha = note.timer / note.maxTimer;
        ctx.fillStyle = note.color;
        ctx.font = '24px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(note.text, note.x, note.y);
        ctx.restore();
    });

    // Draw boss health bar if active
    let activeBoss = enemies.find(e => e.type === 'boss1' || e.type === 'boss2' || e.type === 'boss3');
    if (activeBoss) {
        const barW = canvas.width * 0.6;
        const barH = 12;
        const barX = (canvas.width - barW) / 2;
        const barY = 100; // Lowered from 20 to 100 to clear top HUD banner

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(barX, barY, barW, barH);

        ctx.fillStyle = '#ff0000';
        ctx.fillRect(barX, barY, barW * (activeBoss.health / activeBoss.maxHealth), barH);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barW, barH);

        ctx.fillStyle = '#ffffff';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';

        let bossTitle = 'STAGE 1 BOSS';
        if (activeBoss.type === 'boss2') bossTitle = 'STAGE 2 BOSS';
        if (activeBoss.type === 'boss3') bossTitle = 'STAGE 3 BOSS';
        ctx.fillText(bossTitle, canvas.width / 2, barY - 6);
    }

    // Game Over Text
    if (isGameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'red';
        ctx.font = '40px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);

        ctx.fillStyle = 'white';
        ctx.font = '15px "Press Start 2P", monospace';
        ctx.fillText('PRESS SPACE TO RESTART', canvas.width / 2, canvas.height / 2 + 40);
    }

    // Victory Text
    if (isVictory) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffd700'; // Gold
        ctx.font = '40px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('VICTORY!', canvas.width / 2, canvas.height / 2 - 20);

        ctx.fillStyle = 'white';
        ctx.font = '15px "Press Start 2P", monospace';
        ctx.fillText('PRESS SPACE FOR MENU', canvas.width / 2, canvas.height / 2 + 40);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start game
gameLoop();

// Level Selection Handlers
document.getElementById('select-stage-1').addEventListener('click', () => {
    selectStage(1);
});
document.getElementById('select-stage-2').addEventListener('click', () => {
    selectStage(2);
});
document.getElementById('select-stage-3').addEventListener('click', () => {
    selectStage(3);
});

function selectStage(stageNum) {
    isLevelSelect = false;
    document.getElementById('level-select-screen').style.display = 'none';

    score = stageNum === 1 ? 0 : (stageNum === 2 ? 15000 : 30000);
    last1UpScore = stageNum === 1 ? 0 : (stageNum === 2 ? 10000 : 30000);
    bgTransitionAlpha = stageNum === 1 ? 0 : 1;
    bgTransitionAlpha3 = stageNum === 3 ? 1 : 0;

    player.lives = 3;
    player.health = player.maxHealth;
    player.weaponLevel = stageNum === 1 ? 1 : (stageNum === 2 ? 3 : 4); // Upgrade level based on stage select
    player.invincible = 0;
    player.isDead = false;
    player.respawnTimer = 0;
    player.x = canvas.width / 2 - 50;
    player.y = canvas.height - 130;

    lasers = [];
    enemies = [];
    explosions = [];
    powerups = [];
    isGameOver = false;
    isVictory = false;
    stage1BossSpawned = stageNum >= 2;
    stage1BossDefeated = stageNum >= 2;
    stage2BossSpawned = stageNum === 3;
    stage2BossDefeated = stageNum === 3;
    stage3BossSpawned = false;
    stage3BossDefeated = false;
}
