// spaceinvaders.js with multiple levels, bosses
// One-hit kill: If the player is hit, it's game over
// All enemies shoot, but only a few at once, with frequency increasing each level
// Bosses shoot fewer bullets at a time
// Added "Reset Game" button
// Enhanced fluid feel (wave animation for enemies, smoother difficulty curve, etc.)
// Preserves your layout, text, and margins

(function() {
    const canvas = document.getElementById('spaceGameCanvas');
    const startButton = document.getElementById('startSpaceGame');
    const nextLevelButton = document.getElementById('nextLevelButton');
    const resetGameButton = document.getElementById('resetGameButton');
    const leftButton = document.getElementById('leftButton');
    const rightButton = document.getElementById('rightButton');
    const shootButton = document.getElementById('shootButton');
    let ctx;

    let gameStarted = false;
    let animationId;

    // One-hit kill logic
    let player, bullets, enemies, keys, gameOver, score, level, enemyDirection;
    
    // Mobile left/right movement flags
    let moveLeftActive = false;
    let moveRightActive = false;

    // Enemy / Boss bullet data
    let enemyBullets = [];

    // Timers / intervals
    let enemyShootTimer = 0;
    let bossShootTimer = 0;

    // Basic wave amplitude for a fluid, slight vertical motion
    const waveAmplitude = 2;  

    // Each level: enemies shoot with some interval, boss has its own
    // The user wants level 1 to be relatively easy, and the game to scale up.
    function getEnemyShootInterval() {
      // Start fairly high at level 1, then ramp down, never below 60
      const base = 200; // frames
      const dec = (level - 1) * 15; 
      return Math.max(base - dec, 60);
    }

    function getBossShootInterval() {
      // Boss shoots more often, but not too many bullets.
      // Start a bit faster, also never below 40
      const base = 150;
      const dec = (level - 1) * 10;
      return Math.max(base - dec, 40);
    }

    function init(levelNum = 1) {
        canvas.width = 800;
        canvas.height = 400;

        player = {
            x: canvas.width / 2 - 20,
            y: canvas.height - 50,
            width: 40,
            height: 20,
            speed: 5,
            dx: 0
        };

        bullets = [];
        enemies = [];
        enemyBullets = [];
        keys = {};
        gameOver = false;
        score = 0;
        level = levelNum;
        enemyDirection = 1;

        enemyShootTimer = 0;
        bossShootTimer = 0;

        // Hide the Reset and Next Level buttons at the start
        resetGameButton.style.display = 'none';
        nextLevelButton.style.display = 'none';

        spawnWave(level);
    }

    // Helper to spawn enemies/boss based on level
    function spawnWave(lvl) {
        switch (lvl) {
            case 1:
                spawnEnemies(2, 6);
                break;
            case 2:
                spawnEnemies(3, 8);
                break;
            case 3:
                spawnBoss(60);
                break;
            case 4:
                spawnEnemies(4, 9);
                break;
            case 5:
                spawnBoss(80);
                break;
            case 6:
                spawnEnemies(5, 10);
                break;
            case 7:
                spawnBoss(120);
                break;
            case 8:
                spawnEnemies(6, 12);
                break;
            default:
                // after 8, keep scaling
                spawnEnemies(4 + (lvl % 3), 8 + (lvl % 5));
                break;
        }
    }

    // Create normal enemies in a grid, each storing initialY for wave motion
    function spawnEnemies(rows, cols) {
        const enemyWidth = 30;
        const enemyHeight = 20;
        const padding = 10;
        const offsetTop = 50;
        const offsetLeft = 50;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                enemies.push({
                    x: offsetLeft + c * (enemyWidth + padding),
                    y: offsetTop + r * (enemyHeight + padding),
                    initialY: offsetTop + r * (enemyHeight + padding),
                    offset: Math.random() * 10000, // random offset for wave
                    width: enemyWidth,
                    height: enemyHeight,
                    alive: true,
                    boss: false,
                    health: 1 // one shot kill for them
                });
            }
        }
    }

    // Create a boss enemy with a given health
    function spawnBoss(bossHealth) {
        enemies.push({
            x: canvas.width / 2 - 40,
            y: 50,
            initialY: 50,
            offset: Math.random() * 10000,
            width: 80,
            height: 40,
            alive: true,
            boss: true,
            health: bossHealth
        });
    }

    function drawBackground() {
        const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        bgGradient.addColorStop(0, '#0c0c3c');
        bgGradient.addColorStop(1, '#000');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw the player with a neon gradient
    function drawPlayer() {
        const grad = ctx.createLinearGradient(player.x, player.y, player.x + player.width, player.y + player.height);
        grad.addColorStop(0, '#00ff91');
        grad.addColorStop(1, '#00ffa2');
        ctx.fillStyle = grad;
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    function movePlayer() {
        player.dx = 0;
        if (keys['ArrowRight'] || moveRightActive) player.dx = player.speed;
        if (keys['ArrowLeft'] || moveLeftActive) player.dx = -player.speed;

        player.x += player.dx;
        if (player.x < 0) player.x = 0;
        if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
    }

    // Player bullet
    function drawBullets() {
        bullets.forEach(b => {
            const bulletGrad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.height);
            bulletGrad.addColorStop(0, 'red');
            bulletGrad.addColorStop(1, 'orange');
            ctx.fillStyle = bulletGrad;
            ctx.fillRect(b.x, b.y, b.width, b.height);
        });
    }

    function moveBullets() {
        for (let i = bullets.length - 1; i >= 0; i--) {
            bullets[i].y -= bullets[i].speed;
            if (bullets[i].y < 0) {
                bullets.splice(i, 1);
            }
        }
    }

    // Draw enemies with random color variation for extra style
    function drawEnemies() {
        enemies.forEach(e => {
            if (!e.alive) return;

            let enemyGrad;
            if (e.boss) {
                enemyGrad = ctx.createLinearGradient(e.x, e.y, e.x + e.width, e.y + e.height);
                enemyGrad.addColorStop(0, '#bb00ff');
                enemyGrad.addColorStop(1, '#7a00ff');
            } else {
                enemyGrad = ctx.createLinearGradient(e.x, e.y, e.x + e.width, e.y + e.height);
                enemyGrad.addColorStop(0, randomColorStop());
                enemyGrad.addColorStop(1, randomColorStop());
            }
            ctx.fillStyle = enemyGrad;
            ctx.fillRect(e.x, e.y, e.width, e.height);
        });
    }

    // Helper to generate random pastel-ish color stops
    function randomColorStop() {
        const r = 100 + Math.floor(Math.random() * 156);
        const g = 100 + Math.floor(Math.random() * 156);
        const b = 100 + Math.floor(Math.random() * 156);
        return `rgb(${r}, ${g}, ${b})`;
    }

    // Move enemies sideways, plus a small wave effect
    function moveEnemies() {
        let hitEdge = false;
        enemies.forEach(e => {
            if (!e.alive) return;

            // Standard horizontal movement
            e.x += enemyDirection;

            // Wave effect for vertical position
            e.y = e.initialY + waveAmplitude * Math.sin((Date.now() + e.offset) / 300);

            if (e.x + e.width > canvas.width || e.x < 0) {
                hitEdge = true;
            }
        });
        if (hitEdge) {
            enemies.forEach(e => {
                if (e.alive) {
                    e.x = e.x; // keep x
                    // Move them down a bit
                    e.initialY += 10;
                }
            });
            enemyDirection *= -1;
        }
    }

    // Enemy bullets
    function drawEnemyBullets() {
        enemyBullets.forEach(b => {
            const bulletGrad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.height);
            bulletGrad.addColorStop(0, 'cyan');
            bulletGrad.addColorStop(1, 'blue');
            ctx.fillStyle = bulletGrad;
            ctx.fillRect(b.x, b.y, b.width, b.height);
        });
    }

    function moveEnemyBullets() {
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            enemyBullets[i].y += enemyBullets[i].speed;
            if (enemyBullets[i].y > canvas.height) {
                enemyBullets.splice(i, 1);
                continue;
            }
            // Check collision with player -> one-hit kill
            if (
                enemyBullets[i].y + enemyBullets[i].height >= player.y &&
                enemyBullets[i].x < player.x + player.width &&
                enemyBullets[i].x + enemyBullets[i].width > player.x
            ) {
                // Player is hit => gameOver
                gameOver = true;
                enemyBullets.splice(i, 1);
            }
        }
    }

    // Let enemies shoot, but only a random subset, boss shoots fewer bullets
    function handleEnemyShooting() {
        enemyShootTimer++;
        bossShootTimer++;

        // Normal enemies shoot
        if (enemyShootTimer > getEnemyShootInterval()) {
            enemyShootTimer = 0;
            // Randomly pick a few enemies to shoot
            enemies.forEach(e => {
                if (!e.boss && e.alive) {
                    // 20% chance each living normal enemy will shoot
                    if (Math.random() < 0.2) {
                        spawnEnemyBullet(e);
                    }
                }
            });
        }

        // Boss shoot
        if (bossShootTimer > getBossShootInterval()) {
            bossShootTimer = 0;
            let bossEnemy = enemies.find(e => e.boss && e.alive);
            if (bossEnemy) {
                // Boss fires fewer bullets: 1 bullet if level < 4, else 2 bullets
                let bulletsToFire = (level < 4) ? 1 : 2;
                for (let i = 0; i < bulletsToFire; i++) {
                    spawnEnemyBullet(bossEnemy);
                }
            }
        }
    }

    // Fire bullet from the given enemy or boss
    function spawnEnemyBullet(shooter) {
        enemyBullets.push({
            x: shooter.x + shooter.width / 2 - 2,
            y: shooter.y + shooter.height,
            width: 4,
            height: 10,
            speed: 3 // a bit slower for more fluid dodge
        });
    }

    // Player shooting
    function shoot() {
        bullets.push({
            x: player.x + player.width / 2 - 2,
            y: player.y,
            width: 4,
            height: 10,
            speed: 10
        });
    }

    // Check collisions between player bullets and enemies
    function checkCollisions() {
        // Bullets vs Enemies
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            for (let j = 0; j < enemies.length; j++) {
                const e = enemies[j];
                if (
                    e.alive && 
                    b.x < e.x + e.width && 
                    b.x + b.width > e.x && 
                    b.y < e.y + e.height && 
                    b.y + b.height > e.y
                ) {
                    // Bullet hits enemy
                    e.health -= 1;
                    if (e.health <= 0) {
                        e.alive = false;
                        score += e.boss ? 100 : 10;
                    }
                    bullets.splice(i, 1);
                    break;
                }
            }
        }

        // If an enemy itself reaches or collides with the player => game over
        enemies.forEach(e => {
            if (e.alive && e.y + e.height >= player.y &&
                e.x < player.x + player.width &&
                e.x + e.width > player.x
            ) {
                gameOver = true;
            }
        });
    }

    function drawScore() {
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.fillText('Score: ' + score, 10, 20);
        ctx.fillText('Level: ' + level, 100, 20);
    }

    function update() {
        if (gameOver) {
            ctx.fillStyle = 'white';
            ctx.font = '30px sans-serif';
            ctx.fillText("Game Over!", canvas.width / 2 - 70, canvas.height / 2);
            // Show reset button
            resetGameButton.style.display = 'inline-block';
            cancelAnimationFrame(animationId);
            return;
        }

        drawBackground();
        movePlayer();
        drawPlayer();

        moveBullets();
        drawBullets();

        moveEnemies();
        drawEnemies();

        handleEnemyShooting();
        moveEnemyBullets();
        drawEnemyBullets();

        checkCollisions();
        drawScore();

        // If all enemies are dead, level is complete
        if (enemies.every(e => !e.alive)) {
            ctx.fillStyle = 'white';
            ctx.font = '30px sans-serif';
            if (level < 8) {
                ctx.fillText("Level Complete!", canvas.width / 2 - 100, canvas.height / 2);
                nextLevelButton.style.display = 'inline-block';
            } else {
                ctx.fillText("You Win the Game!", canvas.width / 2 - 120, canvas.height / 2);
                // Show reset button
                resetGameButton.style.display = 'inline-block';
            }
            cancelAnimationFrame(animationId);
            return;
        }

        animationId = requestAnimationFrame(update);
    }

    function startGame() {
        if (gameStarted) return;
        gameStarted = true;
        ctx = canvas.getContext('2d');
        init(1);
        startButton.style.display = 'none';
        update();
    }

    function resetGame() {
        // Return to initial state
        cancelAnimationFrame(animationId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        gameStarted = false;
        startButton.style.display = 'inline-block';
        nextLevelButton.style.display = 'none';
        resetGameButton.style.display = 'none';
    }

    nextLevelButton.addEventListener('click', () => {
        level++;
        init(level);
        update();
    });

    resetGameButton.addEventListener('click', resetGame);

    // Keyboard events
    document.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        if (e.key === ' ') {
            shoot();
        }
    });
    document.addEventListener('keyup', (e) => {
        delete keys[e.key];
    });

    // On-screen buttons (mobile / mouse)
    leftButton.addEventListener('mousedown', () => { moveLeftActive = true; });
    leftButton.addEventListener('mouseup', () => { moveLeftActive = false; });
    leftButton.addEventListener('mouseleave', () => { moveLeftActive = false; });
    leftButton.addEventListener('touchstart', () => { moveLeftActive = true; }, { passive: true });
    leftButton.addEventListener('touchend', () => { moveLeftActive = false; }, { passive: true });

    rightButton.addEventListener('mousedown', () => { moveRightActive = true; });
    rightButton.addEventListener('mouseup', () => { moveRightActive = false; });
    rightButton.addEventListener('mouseleave', () => { moveRightActive = false; });
    rightButton.addEventListener('touchstart', () => { moveRightActive = true; }, { passive: true });
    rightButton.addEventListener('touchend', () => { moveRightActive = false; }, { passive: true });

    shootButton.addEventListener('mousedown', () => { shoot(); });
    shootButton.addEventListener('touchstart', () => { shoot(); }, { passive: true });

    startButton.addEventListener('click', startGame);
})();
