// Game constants
const WIDTH = 800;
const HEIGHT = 600;
const FPS = 60;
const GROUND_LEVEL = 500;
const PLAYER_START_X = 100;
const PLAYER_MAX_HEALTH = 200;
const PLAYER_LIVES = 3;
const GRAVITY = 0.8;
const JUMP_STRENGTH = -15;
const PLAYER_SPEED = 5;
const ENEMY_SPEED_MIN = 2;
const ENEMY_SPEED_MAX = 4;
const BASE_ENEMY_SPAWN_RATE = 2000;
const SCORE_THRESHOLD = 5000;
const MAX_ENEMIES = 10;
const PARTICLE_LIMIT = 50;
const INVISIBILITY_DURATION = 5; // seconds
const INVISIBILITY_COOLDOWN = 10; // seconds

// Game state
let canvas, ctx;
let player, enemies = [];
let score = 0;
let gameActive = false;
let lastEnemySpawn = 0;
let backgroundLayers = [];
let particles = [];
let backgroundOffset = 0;
let highscore = 0;
let difficultyLevel = 1;

// Load images
const images = {};
const imageFiles = {
    'bg': 'assets/bg.png',
    'bg_layer_0': 'assets/bg_layer_0.png',
    'bg_layer_1': 'assets/bg_layer_1.png',
    'player': 'assets/player.png',
    'cat_run': 'assets/cat_run.png',
    'cat_jump': 'assets/cat_jump.png',
    'cat_attack': 'assets/cat_attack.png',
    'enemy_basic': 'assets/enemy_basic.png',
    'enemy_strong': 'assets/enemy_strong.png'
};

// Particle colors
const PARTICLE_COLORS = {
    jump: '#ffffff',
    hit: '#ff4444',
    heal: '#44ff44',
    score: '#ffff44',
    invisibility: '#4444ff'
};

// Load all images
function loadImages() {
    return Promise.all(
        Object.entries(imageFiles).map(([key, src]) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    images[key] = img;
                    resolve();
                };
                img.onerror = reject;
                img.src = src;
            });
        })
    );
}

// Player class
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 80;
        this.velocityX = 0;
        this.velocityY = 0;
        this.health = PLAYER_MAX_HEALTH;
        this.lives = PLAYER_LIVES;
        this.jumping = false;
        this.attacking = false;
        this.hidden = false;
        this.facingRight = true;
        this.currentState = 'idle';
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 0.1;
        this.runFrames = [0, 1, 2, 1];
        this.hitFlashTimer = 0;
        this.hitFlashDuration = 0.2;
        this.particles = [];
        this.invisibilityTimer = 0;
        this.invisibilityCooldown = 0;
        this.comboCount = 0;
        this.lastAttackTime = 0;
        this.comboTimeout = 1000;
        this.attackRect = { x: 0, y: 0, width: 0, height: 0 };
        this.attackCooldown = 0;
    }

    update(keys) {
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= 1/60;
        }

        // Update invisibility
        if (this.hidden) {
            this.invisibilityTimer -= 1/60;
            if (this.invisibilityTimer <= 0) {
                this.hidden = false;
                this.invisibilityCooldown = INVISIBILITY_COOLDOWN;
                // Invisibility end effect
                for (let i = 0; i < 10; i++) {
                    this.addParticle(
                        this.x + Math.random() * this.width,
                        this.y + Math.random() * this.height,
                        PARTICLE_COLORS.invisibility
                    );
                }
            }
        } else if (this.invisibilityCooldown > 0) {
            this.invisibilityCooldown -= 1/60;
        }

        // Update combo
        if (Date.now() - this.lastAttackTime > this.comboTimeout) {
            this.comboCount = 0;
        }

        // Movement
        this.velocityX = 0;
        if (keys.ArrowLeft) {
            this.velocityX = -PLAYER_SPEED;
            this.facingRight = false;
        }
        if (keys.ArrowRight) {
            this.velocityX = PLAYER_SPEED;
            this.facingRight = true;
        }

        // Apply gravity
        this.velocityY += GRAVITY;

        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Keep player on screen
        this.x = Math.max(0, Math.min(WIDTH - this.width, this.x));

        // Ground collision
        if (this.y + this.height >= GROUND_LEVEL) {
            if (this.velocityY > 0) {
                // Landing effect
                for (let i = 0; i < 5; i++) {
                    this.addParticle(
                        this.x + Math.random() * this.width,
                        this.y + this.height,
                        PARTICLE_COLORS.jump
                    );
                }
            }
            this.y = GROUND_LEVEL - this.height;
            this.velocityY = 0;
            this.jumping = false;
        }

        // Update animation
        this.animationTimer += 1/60;
        if (this.animationTimer >= this.animationSpeed) {
            this.animationTimer = 0;
            if (this.velocityX !== 0 && this.onGround()) {
                this.animationFrame = (this.animationFrame + 1) % this.runFrames.length;
            }
        }

        // Update hit flash
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= 1/60;
        }

        // Update particles
        this.particles = this.particles.filter(p => p.update());

        // Update state
        if (this.attacking) {
            this.currentState = 'attack';
        } else if (!this.onGround()) {
            this.currentState = 'jump';
        } else if (this.velocityX !== 0) {
            this.currentState = 'run';
        } else {
            this.currentState = 'idle';
        }
    }

    toggleInvisibility() {
        if (!this.hidden && this.invisibilityCooldown <= 0) {
            this.hidden = true;
            this.invisibilityTimer = INVISIBILITY_DURATION;
            // Invisibility start effect
            for (let i = 0; i < 10; i++) {
                this.addParticle(
                    this.x + Math.random() * this.width,
                    this.y + Math.random() * this.height,
                    PARTICLE_COLORS.invisibility
                );
            }
            return true;
        }
        return false;
    }

    attack() {
        console.log('Attack called'); // Debug log
        if (!this.attacking && this.attackCooldown <= 0) {
            console.log('Starting attack'); // Debug log
            this.attacking = true;
            this.lastAttackTime = Date.now();
            this.comboCount = (this.comboCount + 1) % 3;
            this.attackCooldown = 0.3;
            
            // Set attack rectangle
            const attackWidth = this.width * 1.5;
            this.attackRect = {
                x: this.facingRight ? this.x + this.width : this.x - attackWidth,
                y: this.y,
                width: attackWidth,
                height: this.height
            };
            
            // Attack effect
            for (let i = 0; i < 5; i++) {
                this.addParticle(
                    this.x + (this.facingRight ? this.width : 0),
                    this.y + Math.random() * this.height,
                    PARTICLE_COLORS.hit
                );
            }

            setTimeout(() => {
                this.attacking = false;
                this.attackRect = { x: 0, y: 0, width: 0, height: 0 };
            }, 300);
            return true;
        }
        return false;
    }

    takeDamage(amount) {
        if (!this.hidden) {
            this.health -= amount;
            this.hitFlashTimer = this.hitFlashDuration;
            
            // Create hit particles
            for (let i = 0; i < 5; i++) {
                this.addParticle(
                    this.x + Math.random() * this.width,
                    this.y + Math.random() * this.height,
                    PARTICLE_COLORS.hit
                );
            }

            if (this.health <= 0) {
                this.lives--;
                this.health = PLAYER_MAX_HEALTH;
                if (this.lives <= 0) {
                    return true; // Game over
                }
            }
        }
        return false;
    }

    getAttackDamage() {
        return 10 + (this.comboCount * 5); // Base damage + combo bonus
    }

    onGround() {
        return this.y + this.height >= GROUND_LEVEL;
    }

    jump() {
        if (this.onGround() && !this.jumping) {
            this.velocityY = JUMP_STRENGTH;
            this.jumping = true;
            return true;
        }
        return false;
    }

    addParticle(x, y, color) {
        if (this.particles.length < PARTICLE_LIMIT) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    draw() {
        let image;
        switch (this.currentState) {
            case 'attack':
                image = images.cat_attack;
                break;
            case 'jump':
                image = images.cat_jump;
                break;
            case 'run':
                image = images.cat_run;
                // Calculate source rectangle for running animation
                const frameWidth = image.width / 3; // Assuming 3 frames in the sprite sheet
                const sourceX = this.runFrames[this.animationFrame] * frameWidth;
                const sourceY = 0;
                const sourceWidth = frameWidth;
                const sourceHeight = image.height;

                if (!this.facingRight) {
                    ctx.save();
                    ctx.translate(this.x + this.width, this.y);
                    ctx.scale(-1, 1);
                    ctx.drawImage(
                        image,
                        sourceX, sourceY, sourceWidth, sourceHeight,
                        0, 0, this.width, this.height
                    );
                    ctx.restore();
                } else {
                    ctx.drawImage(
                        image,
                        sourceX, sourceY, sourceWidth, sourceHeight,
                        this.x, this.y, this.width, this.height
                    );
                }
                return; // Skip the rest of the drawing code
            default:
                image = images.player;
        }

        if (!this.facingRight) {
            ctx.save();
            ctx.translate(this.x + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(image, 0, 0, this.width, this.height);
            ctx.restore();
        } else {
            ctx.drawImage(image, this.x, this.y, this.width, this.height);
        }

        // Draw health bar
        const healthWidth = 150;
        const healthHeight = 15;
        const healthX = WIDTH - healthWidth - 20;
        const healthY = 20;

        ctx.fillStyle = '#666';
        ctx.fillRect(healthX, healthY, healthWidth, healthHeight);
        ctx.fillStyle = '#c83232';
        ctx.fillRect(healthX, healthY, healthWidth * (this.health / PLAYER_MAX_HEALTH), healthHeight);

        // Draw lives
        const heartSize = 20;
        const heartSpacing = 25;
        const heartX = 20;
        const heartY = 140;

        for (let i = 0; i < this.lives; i++) {
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.moveTo(heartX + i * heartSpacing, heartY + heartSize/2);
            ctx.bezierCurveTo(
                heartX + i * heartSpacing, heartY,
                heartX + i * heartSpacing + heartSize/2, heartY,
                heartX + i * heartSpacing + heartSize/2, heartY + heartSize/2
            );
            ctx.bezierCurveTo(
                heartX + i * heartSpacing + heartSize/2, heartY + heartSize,
                heartX + i * heartSpacing, heartY + heartSize,
                heartX + i * heartSpacing, heartY + heartSize/2
            );
            ctx.fill();
        }
    }
}

// Enemy class
class Enemy {
    constructor(type = 'basic') {
        this.type = type;
        this.width = 50;
        this.height = 60;
        this.x = WIDTH;
        this.y = GROUND_LEVEL - this.height;
        this.speed = Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN) + ENEMY_SPEED_MIN;
        this.health = type === 'strong' ? 50 : 30;
        this.maxHealth = this.health;
        this.hitFlashTimer = 0;
        this.hitFlashDuration = 0.2;
        this.particles = [];
    }

    takeDamage(amount) {
        this.health -= amount;
        this.hitFlashTimer = this.hitFlashDuration;
        // Hit effect
        for (let i = 0; i < 3; i++) {
            this.particles.push(new Particle(
                this.x + Math.random() * this.width,
                this.y + Math.random() * this.height,
                PARTICLE_COLORS.hit
            ));
        }
        return this.health <= 0;
    }

    update() {
        this.x -= this.speed;
        return this.x + this.width < 0;
    }

    draw() {
        // Draw particles
        this.particles.forEach(p => p.draw());

        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(
            this.x + this.width/2,
            this.y + this.height + 5,
            this.width/2,
            this.height/4,
            0, 0, Math.PI * 2
        );
        ctx.fill();

        // Draw enemy with hit flash
        if (this.hitFlashTimer > 0) {
            ctx.globalAlpha = 0.5;
        }
        ctx.drawImage(
            images[`enemy_${this.type}`],
            this.x, this.y, this.width, this.height
        );
        ctx.globalAlpha = 1;

        // Draw health bar
        const healthWidth = 40;
        const healthHeight = 5;
        const healthX = this.x;
        const healthY = this.y - 10;

        ctx.fillStyle = '#666';
        ctx.fillRect(healthX, healthY, healthWidth, healthHeight);
        ctx.fillStyle = this.type === 'strong' ? '#ff4444' : '#c83232';
        ctx.fillRect(healthX, healthY, healthWidth * (this.health / this.maxHealth), healthHeight);
    }
}

// Particle class
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 2 + 2;
        this.life = 1.0;
        this.velocityX = (Math.random() - 0.5) * 4;
        this.velocityY = (Math.random() - 0.5) * 4;
    }

    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.life -= 0.02;
        return this.life > 0;
    }

    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// Game initialization
async function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // Load images
    await loadImages();

    // Initialize game
    resetGame();

    // Add restart button event listener
    document.getElementById('restartButton').addEventListener('click', () => {
        if (!gameActive) {
            resetGame();
        }
    });

    // Start game loop
    requestAnimationFrame(gameLoop);
}

// Reset game state
function resetGame() {
    player = new Player(PLAYER_START_X, GROUND_LEVEL - 80);
    enemies = [];
    score = 0;
    gameActive = true;
    lastEnemySpawn = 0;
    particles = [];
    backgroundOffset = 0;
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('score').textContent = 'Score: 0';
    document.getElementById('health').textContent = 'Health: 200';
}

// Calculate current enemy spawn rate based on score
function getCurrentSpawnRate() {
    const level = Math.floor(score / SCORE_THRESHOLD) + 1;
    return Math.max(500, BASE_ENEMY_SPAWN_RATE - (level * 200));
}

// Calculate current max enemies based on score
function getCurrentMaxEnemies() {
    const level = Math.floor(score / SCORE_THRESHOLD) + 1;
    return Math.min(MAX_ENEMIES, 3 + level);
}

// Calculate enemy speed based on score
function getEnemySpeed() {
    const level = Math.floor(score / SCORE_THRESHOLD) + 1;
    const speedBonus = level * 0.5;
    return {
        min: ENEMY_SPEED_MIN + speedBonus,
        max: ENEMY_SPEED_MAX + speedBonus
    };
}

// Game loop
function gameLoop(timestamp) {
    if (!gameActive) {
        requestAnimationFrame(gameLoop);
        return;
    }

    // Clear canvas
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Update background offset
    backgroundOffset += 2;
    if (backgroundOffset >= WIDTH) {
        backgroundOffset = 0;
    }

    // Draw background
    drawBackground();

    // Update and draw player
    player.update({
        ArrowLeft: keys['ArrowLeft'],
        ArrowRight: keys['ArrowRight']
    });
    player.draw();

    // Draw debug info
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText(`Attack Cooldown: ${player.attackCooldown.toFixed(2)}`, 20, 170);
    ctx.fillText(`Attacking: ${player.attacking}`, 20, 190);
    ctx.fillText(`Combo: ${player.comboCount}`, 20, 210);

    // Draw difficulty info under health bar
    const healthBarX = WIDTH - 170;
    const healthBarY = 20;
    ctx.font = '12px Arial';
    ctx.fillStyle = '#888888';
    ctx.fillText(`Level: ${Math.floor(score / SCORE_THRESHOLD) + 1}`, healthBarX, healthBarY + 25);
    ctx.fillText(`Enemies: ${enemies.length}/${getCurrentMaxEnemies()}`, healthBarX, healthBarY + 40);
    ctx.fillText(`Spawn: ${getCurrentSpawnRate()}ms`, healthBarX, healthBarY + 55);

    // Spawn enemies
    if (timestamp - lastEnemySpawn > getCurrentSpawnRate() && enemies.length < getCurrentMaxEnemies()) {
        const enemyType = Math.random() < 0.3 ? 'strong' : 'basic';
        const enemy = new Enemy(enemyType);
        const speeds = getEnemySpeed();
        enemy.speed = Math.random() * (speeds.max - speeds.min) + speeds.min;
        enemies.push(enemy);
        lastEnemySpawn = timestamp;
    }

    // Update and draw enemies
    enemies = enemies.filter(enemy => {
        enemy.draw();
        return !enemy.update();
    });

    // Draw combo counter
    if (player.comboCount > 0) {
        ctx.fillStyle = '#ffff44';
        ctx.font = '20px Arial';
        ctx.fillText(`Combo: ${player.comboCount}x`, 20, 80);
    }

    // Draw invisibility cooldown
    if (player.invisibilityCooldown > 0) {
        ctx.fillStyle = '#4444ff';
        ctx.font = '20px Arial';
        ctx.fillText(`Invisibility: ${Math.ceil(player.invisibilityCooldown)}s`, 20, 110);
    }

    // Update score
    score++;
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('health').textContent = `Health: ${player.health}`;

    // Check collisions
    checkCollisions();

    // Continue game loop
    requestAnimationFrame(gameLoop);
}

// Draw background with parallax effect
function drawBackground() {
    // Draw main background
    ctx.drawImage(images.bg, -backgroundOffset, 0, WIDTH, HEIGHT);
    ctx.drawImage(images.bg, WIDTH - backgroundOffset, 0, WIDTH, HEIGHT);

    // Draw parallax layers with different speeds
    if (images.bg_layer_0) {
        const layer0Offset = backgroundOffset * 0.5;
        ctx.drawImage(images.bg_layer_0, -layer0Offset, 0, WIDTH, HEIGHT);
        ctx.drawImage(images.bg_layer_0, WIDTH - layer0Offset, 0, WIDTH, HEIGHT);
    }
    if (images.bg_layer_1) {
        const layer1Offset = backgroundOffset * 0.2;
        ctx.drawImage(images.bg_layer_1, -layer1Offset, 0, WIDTH, HEIGHT);
        ctx.drawImage(images.bg_layer_1, WIDTH - layer1Offset, 0, WIDTH, HEIGHT);
    }

    // Draw ground
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(0, GROUND_LEVEL, WIDTH, HEIGHT - GROUND_LEVEL);
}

// Check collisions
function checkCollisions() {
    for (let enemy of enemies) {
        // Check attack collision
        if (player.attacking && 
            player.attackRect.x < enemy.x + enemy.width &&
            player.attackRect.x + player.attackRect.width > enemy.x &&
            player.attackRect.y < enemy.y + enemy.height &&
            player.attackRect.y + player.attackRect.height > enemy.y) {
            
            // Debug visualization
            ctx.strokeStyle = 'red';
            ctx.strokeRect(
                player.attackRect.x,
                player.attackRect.y,
                player.attackRect.width,
                player.attackRect.height
            );
            
            if (enemy.takeDamage(player.getAttackDamage())) {
                enemies = enemies.filter(e => e !== enemy);
                score += enemy.type === 'strong' ? 200 : 100;
                // Score effect
                for (let i = 0; i < 5; i++) {
                    particles.push(new Particle(
                        enemy.x + enemy.width/2,
                        enemy.y,
                        PARTICLE_COLORS.score
                    ));
                }
            }
        }
        // Check player collision
        else if (!player.hidden &&
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {
            if (player.takeDamage(enemy.type === 'strong' ? 30 : 20)) {
                gameOver();
            }
        }
    }
}

// Game over
function gameOver() {
    gameActive = false;
    const gameOverDiv = document.getElementById('gameOver');
    gameOverDiv.style.display = 'block';
    document.getElementById('finalScore').textContent = score;
}

// Keyboard input
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === ' ' && gameActive) {
        player.jump();
    }
    if (e.key === 'f' && gameActive) {
        player.attack();
    }
    if (e.key === 'q' && gameActive) {
        player.toggleInvisibility();
    }
    if (e.key === 'r' && !gameActive) {
        resetGame();
    }
});
window.addEventListener('keyup', e => {
    keys[e.key] = false;
});

// Start game
init(); 