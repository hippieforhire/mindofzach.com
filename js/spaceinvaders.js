// spaceinvaders.js with multiple levels, power-ups, bosses
// No canvas drag touch control, only buttons & keys
// Shoot button center, left/right on sides
// More variety: first 2 levels normal enemies, 3rd level a boss with more health and power-ups.

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

    let moveLeftActive = false;
    let moveRightActive = false;

    function init(levelNum=1) {
        player = {
            x: 400 - 20,
            y: 400 - 50,
            width: 40,
            height: 20,
            speed: 5,
            dx: 0,
            power: 1
        };

        bullets = [];
        enemies = [];
        powerUps = [];
        keys = {};
        gameOver = false;
        score = 0;
        level = levelNum;
        enemyDirection = 1;

        canvas.width = 800;
        canvas.height = 400;

        if (level === 1) {
            spawnEnemies(2,8,false);
        } else if (level === 2) {
            spawnEnemies(3,8,false);
        } else {
            spawnBoss();
        }
    }

    function spawnEnemies(rows, cols, isBoss) {
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
                    width: enemyWidth,
                    height: enemyHeight,
                    alive: true,
                    boss: false,
                    health: 1
                });
            }
        }
    }

    function spawnBoss() {
        enemies.push({
            x: canvas.width/2 - 40,
            y: 50,
            width: 80,
            height: 40,
            alive: true,
            boss: true,
            health: 50
        });
    }

    function drawBackground() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    function drawPlayer() {
        ctx.fillStyle = 'green';
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
        ctx.fillStyle = 'red';
        bullets.forEach(b => {
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
        ctx.fillStyle = 'white';
        enemies.forEach(e => {
            if (e.alive) ctx.fillRect(e.x, e.y, e.width, e.height);
        });
    }

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

    function drawPowerUps() {
        ctx.fillStyle = 'yellow';
        powerUps.forEach(p => {
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });
    }

    function movePowerUps() {
        for (let i = powerUps.length - 1; i >= 0; i--) {
            powerUps[i].y += powerUps[i].speed;
            if (powerUps[i].y + powerUps[i].size >= player.y &&
                powerUps[i].x < player.x + player.width &&
                powerUps[i].x + powerUps[i].size > player.x) {
                // Collected power-up
                player.power += 1;
                player.speed += 1; // Increase speed
                powerUps.splice(i, 1);
            } else if (powerUps[i].y > canvas.height) {
                powerUps.splice(i, 1);
            }
        }
    }

    function shoot() {
        bullets.push({
            x: player.x + player.width/2 - 2,
            y: player.y,
            width:4,
            height:10,
            speed:7 + player.power
        });
    }

    function dropPowerUp(x, y) {
        powerUps.push({
            x: x,
            y: y,
            size: 10,
            speed: 2
        });
    }

    function checkCollisions() {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            for (let j = 0; j < enemies.length; j++) {
                const e = enemies[j];
                if (e.alive && b.x < e.x + e.width && b.x + b.width > e.x && b.y < e.y + e.height && b.y + b.height > e.y) {
                    e.health -= 1;
                    if (e.health <= 0) {
                        e.alive = false;
                        score += e.boss ? 100 : 10;
                        if (Math.random() < 0.2) {
                            dropPowerUp(e.x + e.width/2, e.y + e.height);
                        }
                    }
                    bullets.splice(i,1);
                    break;
                }
            }
        }

        for (let e of enemies) {
            if (e.alive && e.y + e.height >= player.y) {
                gameOver = true;
            }
        }
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
            ctx.fillText("Game Over!", canvas.width/2 - 70, canvas.height/2);
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

        checkCollisions();
        drawScore();

        if (enemies.every(e => !e.alive)) {
            // Level complete
            ctx.fillStyle = 'white';
            ctx.font = '30px sans-serif';
            if (level < 3) {
                ctx.fillText("Level Complete!", canvas.width/2 - 100, canvas.height/2);
                nextLevelButton.style.display = 'inline-block';
            } else {
                ctx.fillText("You Win the Game!", canvas.width/2 - 120, canvas.height/2);
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
        nextLevelButton.style.display = 'none';
        update();
    }

    nextLevelButton.addEventListener('click', () => {
        level++;
        init(level);
        nextLevelButton.style.display = 'none';
        update();
    });

    document.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        if (e.key === ' ') {
            shoot();
        }
    });
    document.addEventListener('keyup', (e) => {
        delete keys[e.key];
    });

    // On-screen buttons only
    leftButton.addEventListener('mousedown', () => { moveLeftActive = true; });
    leftButton.addEventListener('mouseup', () => { moveLeftActive = false; });
    leftButton.addEventListener('mouseleave', () => { moveLeftActive = false; });
    leftButton.addEventListener('touchstart', () => { moveLeftActive = true; }, {passive:true});
    leftButton.addEventListener('touchend', () => { moveLeftActive = false; }, {passive:true});

    rightButton.addEventListener('mousedown', () => { moveRightActive = true; });
    rightButton.addEventListener('mouseup', () => { moveRightActive = false; });
    rightButton.addEventListener('mouseleave', () => { moveRightActive = false; });
    rightButton.addEventListener('touchstart', () => { moveRightActive = true; }, {passive:true});
    rightButton.addEventListener('touchend', () => { moveRightActive = false; }, {passive:true});

    shootButton.addEventListener('mousedown', () => { shoot(); });
    shootButton.addEventListener('touchstart', () => { shoot(); }, {passive:true});

    startButton.addEventListener('click', startGame);
})();
