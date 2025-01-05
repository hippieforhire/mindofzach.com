// spaceinvaders.js with multiple levels, bosses
// One-hit kill: If the player is hit, it's game over
// All enemies shoot, but only a few at once, with frequency increasing each level
// Bosses shoot fewer bullets at a time, shrinks but not too tiny
// Added "Reset Game" button, color variation per wave, scoreboard with high score
// Preserves your layout, text, margins, and the cool flashing style

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

    // We'll track a high score.  
    let highScore = 0;

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

    // We vary the color scheme each wave a bit, so each level looks slightly different
    let waveColorOffset = 0;

    // Boss won't shrink below this fraction of original size, so you can still see it
    const minBossScale = 0.4;  

    // Each level: enemies shoot with some interval, boss with its own
    function getEnemyShootInterval() {
      if (level === 1) return 120; // see more than one shot early
      if (level === 2) return 100;
      if (level === 3) return 160; // first boss
      let base = 180 - (level * 10);
      return Math.max(base, 80);
    }

    // Boss shoots ~23% less in first encounter, then scales more gently
    function getBossShootInterval() {
      if (level === 3) {
        // first boss special case (~25% less frequent than old)
        return 200;
      }
      let base = 200 - (level * 10);
      return Math.max(base, 70);
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

        waveColorOffset = level * 50;

        enemyShootTimer = 0;
        bossShootTimer = 0;

        // Hide the Reset and Next Level buttons at the start
        resetGameButton.style.display = 'none';
        nextLevelButton.style.display = 'none';

        spawnWave(level);
    }

    // Adjusted wave spawns for smoother difficulty
    function spawnWave(lvl) {
        switch (lvl) {
            case 1:
                spawnEnemies(2, 6);
                break;
            case 2:
                spawnEnemies(3, 7);
                break;
            case 3:
                spawnBoss(60);
                break;
            case 4:
                spawnEnemies(3, 8);
                break;
            case 5:
                spawnBoss(80);
                break;
            case 6:
                spawnEnemies(4, 9);
                break;
            case 7:
                spawnBoss(100);
                break;
            case 8:
                spawnEnemies(5, 10);
                break;
            default:
                spawnEnemies(4 + (lvl % 3), 7 + (lvl % 4));
                break;
        }
    }

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
                    offset: Math.random() * 10000, // wave offset
                    width: enemyWidth,
                    height: enemyHeight,
                    alive: true,
                    boss: false,
                    health: 1,
                    maxHealth: 1
                });
            }
        }
    }

    // Boss: won't shrink below minBossScale
    function spawnBoss(bossHealth) {
        enemies.push({
            x: canvas.width / 2 - 40,
            y: 50,
            initialY: 50,
            offset: Math.random() * 10000,
            width: 80,
            height: 40,
            originalWidth: 80,
            originalHeight: 40,
            alive: true,
            boss: true,
            health: bossHealth,
            maxHealth: bossHealth
        });
    }

    function drawBackground() {
        const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        bgGradient.addColorStop(0, '#0c0c3c');
        bgGradient.addColorStop(1, '#000');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

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

    function drawEnemies() {
        enemies.forEach(e => {
            if (!e.alive) return;

            if (e.boss) {
                // Boss shrink factor but not below minBossScale
                let shrinkFactor = e.health / e.maxHealth; 
                let finalScale = minBossScale + (1 - minBossScale) * shrinkFactor;
                e.width = e.originalWidth * finalScale;
                e.height = e.originalHeight * finalScale;

                // We'll keep top-left anchor
                // If you want to keep it centered, you'd shift (x, y) based on the difference

                // Gradual color shift from pink -> red -> darker
                let colorProgress = 1 - (e.health / e.maxHealth);
                let bossColor1 = interpolateColor("#bb00ff", "#ff0000", colorProgress * 0.8);
                let bossColor2 = interpolateColor("#ff0000", "#7a0000", colorProgress * 0.8);
                let bossGrad = ctx.createLinearGradient(e.x, e.y, e.x + e.width, e.y + e.height);
                bossGrad.addColorStop(0, bossColor1);
                bossGrad.addColorStop(1, bossColor2);

                ctx.fillStyle = bossGrad;
                ctx.fillRect(e.x, e.y, e.width, e.height);
            } else {
                // Normal enemy with random color stops
                const enemyGrad = ctx.createLinearGradient(e.x, e.y, e.x + e.width, e.y + e.height);
                enemyGrad.addColorStop(0, randomColorStop(level));
                enemyGrad.addColorStop(1, randomColorStop(level));
                ctx.fillStyle = enemyGrad;
                ctx.fillRect(e.x, e.y, e.width, e.height);
            }
        });
    }

    // Interpolate color between two hex values
    function interpolateColor(hexA, hexB, t) {
        t = Math.max(0, Math.min(1, t));
        const cA = hexToRGB(hexA);
        const cB = hexToRGB(hexB);
        const r = Math.round(cA.r + (cB.r - cA.r) * t);
        const g = Math.round(cA.g + (cB.g - cA.g) * t);
        const b = Math.round(cA.b + (cB.b - cA.b) * t);
        return `rgb(${r},${g},${b})`;
    }

    function hexToRGB(hex) {
        hex = hex.replace(/^#/, "");
        let bigint = parseInt(hex, 16);
        if (hex.length === 3) {
            // handle short #fff
            bigint = parseInt(hex.split("").map(x => x + x).join(""), 16);
        }
        let r = (bigint >> 16) & 255;
        let g = (bigint >> 8) & 255;
        let b = bigint & 255;
        return {r, g, b};
    }

    // Variation in color scheme each level
    function randomColorStop(lvl) {
        // random pastel color factoring in waveColorOffset
        const offset = waveColorOffset + Math.floor(Math.random() * 50);
        const r = 100 + ((offset + lvl * 10) % 156);
        const g = 100 + Math.floor(Math.random() * 156);
        const b = 100 + Math.floor(Math.random() * 156);
        return `rgb(${r}, ${g}, ${b})`;
    }

    function moveEnemies() {
        let hitEdge = false;
        enemies.forEach(e => {
            if (!e.alive) return;
            e.x += enemyDirection;
            e.y = e.initialY + waveAmplitude * Math.sin((Date.now() + e.offset) / 300);

            if (e.x + e.width > canvas.width || e.x < 0) {
                hitEdge = true;
            }
        });
        if (hitEdge) {
            enemies.forEach(e => {
                if (e.alive) {
                    e.initialY += 10;
                }
            });
            enemyDirection *= -1;
        }
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
                gameOver = true;
                enemyBullets.splice(i, 1);
            }
        }
    }

    // Slightly higher chance so you see more shots early
    function handleEnemyShooting() {
        enemyShootTimer++;
        bossShootTimer++;

        // Normal enemies
        if (enemyShootTimer > getEnemyShootInterval()) {
            enemyShootTimer = 0;
            enemies.forEach(e => {
                if (!e.boss && e.alive) {
                    if (Math.random() < 0.25) {
                        spawnEnemyBullet(e);
                    }
                }
            });
        }

        // Boss
        if (bossShootTimer > getBossShootInterval()) {
            bossShootTimer = 0;
            let bossEnemy = enemies.find(e => e.boss && e.alive);
            if (bossEnemy) {
                // 1 bullet if level < 4, else 2 bullets
                let bulletsToFire = (level < 4) ? 1 : 2;
                for (let i = 0; i < bulletsToFire; i++) {
                    spawnEnemyBullet(bossEnemy);
                }
            }
        }
    }

    function spawnEnemyBullet(shooter) {
        enemyBullets.push({
            x: shooter.x + shooter.width / 2 - 2,
            y: shooter.y + shooter.height,
            width: 4,
            height: 10,
            speed: 3
        });
    }

    function shoot() {
        bullets.push({
            x: player.x + player.width / 2 - 2,
            y: player.y,
            width: 4,
            height: 10,
            speed: 10
        });
    }

    // Collisions
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
                    // Bullet hits enemy/boss
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

        // Enemy collides with player
        enemies.forEach(e => {
            if (e.alive &&
                e.y + e.height >= player.y &&
                e.x < player.x + player.width &&
                e.x + e.width > player.x
            ) {
                gameOver = true;
            }
        });
    }

    // Draw Score + High Score
    function drawScore() {
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.fillText('Score: ' + score, 10, 20);
        ctx.fillText('High Score: ' + highScore, 120, 20);
        ctx.fillText('Level: ' + level, 260, 20);
    }

    function update() {
        if (gameOver) {
            // Check if we set a new high score
            if (score > highScore) {
                highScore = score;
            }
            // Show Game Over text
            ctx.fillStyle = 'white';
            ctx.font = '30px sans-serif';
            ctx.fillText("Game Over!", canvas.width / 2 - 70, canvas.height / 2);
            // Show final score
            ctx.font = '20px sans-serif';
            ctx.fillText("Final Score: " + score, canvas.width / 2 - 60, canvas.height / 2 + 40);
            ctx.fillText("High Score: " + highScore, canvas.width / 2 - 60, canvas.height / 2 + 70);

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
            // Check high score
            if (score > highScore) {
                highScore = score;
            }
            ctx.fillStyle = 'white';
            ctx.font = '30px sans-serif';
            if (level < 8) {
                ctx.fillText("Level Complete!", canvas.width / 2 - 100, canvas.height / 2);
                nextLevelButton.style.display = 'inline-block';
            } else {
                ctx.fillText("You Win the Game!", canvas.width / 2 - 120, canvas.height / 2);
                ctx.font = '20px sans-serif';
                ctx.fillText("Final Score: " + score, canvas.width / 2 - 60, canvas.height / 2 + 40);
                ctx.fillText("High Score: " + highScore, canvas.width / 2 - 60, canvas.height / 2 + 70);
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
