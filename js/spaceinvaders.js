// spaceinvaders.js with multiple levels, power-ups, bosses
// No canvas drag touch control, only buttons & keys
// Shoot button center, left/right on sides
// More variety: first 2 levels normal enemies, 3rd level a boss with more health and power-ups.
// Now includes additional levels, better power-ups, player can actually die, improved graphics.
// Bosses can now shoot at the player to increase difficulty.

(function() {
    const canvas = document.getElementById('spaceGameCanvas');
    const startButton = document.getElementById('startSpaceGame');
    const nextLevelButton = document.getElementById('nextLevelButton');
    const leftButton = document.getElementById('leftButton');
    const rightButton = document.getElementById('rightButton');
    const shootButton = document.getElementById('shootButton');
    let ctx;

    let gameStarted = false;
    let animationId;
    let player, bullets, enemies, powerUps, keys, gameOver, score, level, enemyDirection;

    // Track whether left/right buttons are being pressed (mobile).
    let moveLeftActive = false;
    let moveRightActive = false;

    // Store any bullets fired by enemies/boss.
    let enemyBullets = [];
    let bossShootTimer = 0; // Tracks time since last boss shot

    function init(levelNum = 1) {
        canvas.width = 800;
        canvas.height = 400;

        // Player with health and a bit more style/power
        player = {
            x: canvas.width / 2 - 20,
            y: canvas.height - 50,
            width: 40,
            height: 20,
            speed: 5,
            dx: 0,
            power: 1,
            health: 3 // Player starts with 3 health
        };

        bullets = [];
        enemies = [];
        powerUps = [];
        enemyBullets = [];
        keys = {};
        gameOver = false;
        score = 0;
        level = levelNum;
        enemyDirection = 1;
        bossShootTimer = 0;

        // Spawn enemies/boss depending on level
        switch (level) {
            case 1:
                // small wave
                spawnEnemies(2, 8);
                break;
            case 2:
                // medium wave
                spawnEnemies(3, 8);
                break;
            case 3:
                // boss with 50 HP
                spawnBoss(50);
                break;
            case 4:
                // bigger wave
                spawnEnemies(4, 10);
                break;
            case 5:
                // boss with 100 HP
                spawnBoss(100);
                break;
            case 6:
                // even larger wave
                spawnEnemies(5, 10);
                break;
            case 7:
                // bigger boss
                spawnBoss(150);
                break;
            case 8:
                // a big final wave
                spawnEnemies(6, 12);
                break;
            default:
                // after level 8, just keep repeating or create your own pattern
                spawnEnemies(4, 10);
                break;
        }
    }

    // Create normal enemies in a grid
    function spawnEnemies(rows, cols) {
        const enemyWidth = 30;
        const enemyHeight = 20;
        const padding = 10;
        const offsetTop = 50;
        const offsetLeft = 50;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Slight random variation in health for more difficulty
                const randomExtraHealth = Math.random() < 0.3 ? 2 : 1;
                enemies.push({
                    x: offsetLeft + c * (enemyWidth + padding),
                    y: offsetTop + r * (enemyHeight + padding),
                    width: enemyWidth,
                    height: enemyHeight,
                    alive: true,
                    boss: false,
                    health: randomExtraHealth
                });
            }
        }
    }

    // Create a boss enemy with a given health
    function spawnBoss(bossHealth) {
        enemies.push({
            x: canvas.width / 2 - 40,
            y: 50,
            width: 80,
            height: 40,
            alive: true,
            boss: true,
            health: bossHealth
        });
    }

    // Add a bit of background
    function drawBackground() {
        // Draw a subtle starry background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw the player with a gradient for a more stylish look
    function drawPlayer() {
        const grad = ctx.createLinearGradient(player.x, player.y, player.x + player.width, player.y + player.height);
        grad.addColorStop(0, 'limegreen');
        grad.addColorStop(1, 'green');
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

    // Draw bullets
    function drawBullets() {
        bullets.forEach(b => {
            // slight gradient for bullets
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

    // Draw enemies with a different gradient for variety
    function drawEnemies() {
        enemies.forEach(e => {
            if (e.alive) {
                let enemyGrad;
                if (e.boss) {
                    enemyGrad = ctx.createLinearGradient(e.x, e.y, e.x + e.width, e.y + e.height);
                    enemyGrad.addColorStop(0, '#ff69b4'); // Boss: hot pink
                    enemyGrad.addColorStop(1, '#ff1493');
                } else {
                    enemyGrad = ctx.createLinearGradient(e.x, e.y, e.x + e.width, e.y + e.height);
                    enemyGrad.addColorStop(0, 'white');
                    enemyGrad.addColorStop(1, 'gray');
                }
                ctx.fillStyle = enemyGrad;
                ctx.fillRect(e.x, e.y, e.width, e.height);
            }
        });
    }

    // Move enemies sideways and downward
    function moveEnemies() {
        let hitEdge = false;
        enemies.forEach(e => {
            if (e.alive) {
                e.x += enemyDirection;
                if (e.x + e.width > canvas.width || e.x < 0) {
                    hitEdge = true;
                }
            }
        });
        if (hitEdge) {
            enemies.forEach(e => {
                if (e.alive) e.y += 10; 
            });
            enemyDirection *= -1;
        }
    }

    // Power-ups with a nicer look
    function drawPowerUps() {
        powerUps.forEach(p => {
            // Radial gradient for power-up
            const puGrad = ctx.createRadialGradient(
                p.x + p.size / 2,
                p.y + p.size / 2,
                p.size / 8,
                p.x + p.size / 2,
                p.y + p.size / 2,
                p.size / 2
            );
            puGrad.addColorStop(0, 'yellow');
            puGrad.addColorStop(1, 'orange');

            ctx.fillStyle = puGrad;
            ctx.beginPath();
            ctx.arc(p.x + p.size / 2, p.y + p.size / 2, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function movePowerUps() {
        for (let i = powerUps.length - 1; i >= 0; i--) {
            powerUps[i].y += powerUps[i].speed;
            // If player collects power-up
            if (
                powerUps[i].y + powerUps[i].size >= player.y &&
                powerUps[i].x < player.x + player.width &&
                powerUps[i].x + powerUps[i].size > player.x &&
                powerUps[i].y <= player.y + player.height
            ) {
                // Collected power-up
                player.power += 1;
                player.speed += 1; // Increase speed
                powerUps.splice(i, 1);
            } else if (powerUps[i].y > canvas.height) {
                powerUps.splice(i, 1);
            }
        }
    }

    // Allow bosses (or possibly enemies) to shoot
    function spawnEnemyBullet(shooter) {
        // Shooter is an enemy or boss object
        enemyBullets.push({
            x: shooter.x + shooter.width / 2 - 2,
            y: shooter.y + shooter.height,
            width: 4,
            height: 10,
            speed: 4, // speed of downward bullet
        });
    }

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
            // Remove if off screen
            if (enemyBullets[i].y > canvas.height) {
                enemyBullets.splice(i, 1);
                continue;
            }
            // Check collision with player
            if (
                enemyBullets[i].y + enemyBullets[i].height >= player.y &&
                enemyBullets[i].x < player.x + player.width &&
                enemyBullets[i].x + enemyBullets[i].width > player.x
            ) {
                // Player takes damage
                player.health--;
                enemyBullets.splice(i, 1);
                if (player.health <= 0) {
                    gameOver = true;
                }
            }
        }
    }

    // Shoot bullet from player's current position
    function shoot() {
        bullets.push({
            x: player.x + player.width / 2 - 2,
            y: player.y,
            width: 4,
            height: 10,
            speed: 7 + player.power
        });
    }

    // Drop a power-up from a destroyed enemy
    function dropPowerUp(x, y) {
        powerUps.push({
            x: x - 5,
            y: y,
            size: 15,
            speed: 2
        });
    }

    // Check bullet collision with enemies
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
                        // Chance to drop power-up
                        if (Math.random() < 0.2) {
                            dropPowerUp(e.x + e.width / 2, e.y + e.height);
                        }
                    }
                    bullets.splice(i, 1);
                    break;
                }
            }
        }

        // Enemies reaching or colliding with player
        enemies.forEach(e => {
            if (e.alive) {
                // If enemy's bottom is at or below player's top
                if (e.y + e.height >= player.y &&
                    e.x < player.x + player.width &&
                    e.x + e.width > player.x
                ) {
                    // Player takes damage
                    player.health--;
                    e.alive = false;
                    // End game if out of health
                    if (player.health <= 0) {
                        gameOver = true;
                    }
                }
            }
        });
    }

    // Display the score, level, and health
    function drawScore() {
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.fillText('Score: ' + score, 10, 20);
        ctx.fillText('Level: ' + level, 100, 20);
        ctx.fillText('Health: ' + player.health, 180, 20);
    }

    // Game loop
    function update() {
        if (gameOver) {
            ctx.fillStyle = 'white';
            ctx.font = '30px sans-serif';
            ctx.fillText("Game Over!", canvas.width / 2 - 70, canvas.height / 2);
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

        movePowerUps();
        drawPowerUps();

        // Boss shooting logic (only if there's a boss alive)
        let bossExists = enemies.some(e => e.boss && e.alive);
        if (bossExists) {
            bossShootTimer++;
            // For example: boss fires every ~60 frames
            if (bossShootTimer > 60) {
                // Fire bullet(s) from the boss
                let bossEnemy = enemies.find(e => e.boss && e.alive);
                if (bossEnemy) {
                    spawnEnemyBullet(bossEnemy);
                }
                bossShootTimer = 0;
            }
        }

        // Enemy bullets
        moveEnemyBullets();
        drawEnemyBullets();

        checkCollisions();
        drawScore();

        // If all enemies are dead, level is complete
        if (enemies.every(e => !e.alive)) {
            ctx.fillStyle = 'white';
            ctx.font = '30px sans-serif';
            // If we're below level 8, show next level button
            if (level < 8) {
                ctx.fillText("Level Complete!", canvas.width / 2 - 100, canvas.height / 2);
                nextLevelButton.style.display = 'inline-block';
            } else {
                ctx.fillText("You Win the Game!", canvas.width / 2 - 120, canvas.height / 2);
            }
            cancelAnimationFrame(animationId);
            return;
        }

        animationId = requestAnimationFrame(update);
    }

    // Start a new game at level 1
    function startGame() {
        if (gameStarted) return;
        gameStarted = true;
        ctx = canvas.getContext('2d');
        init(1);
        startButton.style.display = 'none';
        nextLevelButton.style.display = 'none';
        update();
    }

    // Move on to the next level
    nextLevelButton.addEventListener('click', () => {
        level++;
        init(level);
        nextLevelButton.style.display = 'none';
        update();
    });

    // Keyboard events
    document.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        // Shoot with Space
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
