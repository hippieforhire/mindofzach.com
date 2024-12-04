document.getElementById('startSpaceInvaders').addEventListener('click', function() {
    const canvas = document.getElementById('spaceInvadersCanvas');
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');

    const player = {
        width: 40,
        height: 20,
        x: canvas.width / 2 - 20,
        y: canvas.height - 30,
        speed: 5,
        dx: 0,
        doubleBullets: false
    };

    const bullets = [];
    const enemies = [];
    const powerUps = [];
    const enemyRows = 5;
    const enemyCols = 10;
    const enemyWidth = 30;
    const enemyHeight = 20;
    const enemyMargin = 10;
    const enemySpeed = 1;
    let score = 0;

    function drawPlayer() {
        ctx.fillStyle = 'green';
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    function movePlayer() {
        player.x += player.dx;
        if (player.x < 0) player.x = 0;
        if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
    }

    function drawBullets() {
        ctx.fillStyle = 'red';
        bullets.forEach(bullet => {
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });
    }

    function moveBullets() {
        bullets.forEach((bullet, index) => {
            bullet.y -= bullet.speed;
            if (bullet.y < 0) bullets.splice(index, 1);
        });
    }

    function drawEnemies() {
        ctx.fillStyle = 'blue';
        enemies.forEach(enemy => {
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        });
    }

    function moveEnemies() {
        enemies.forEach(enemy => {
            enemy.x += enemy.dx;
        });

        const leftmostEnemy = enemies[0];
        const rightmostEnemy = enemies[enemies.length - 1];

        if (leftmostEnemy.x <= 0 || rightmostEnemy.x + enemyWidth >= canvas.width) {
            enemies.forEach(enemy => {
                enemy.dx *= -1;
                enemy.y += enemyMargin;
            });
        }
    }

    function createEnemies() {
        for (let row = 0; row < enemyRows; row++) {
            for (let col = 0; col < enemyCols; col++) {
                const enemy = {
                    x: col * (enemyWidth + enemyMargin),
                    y: row * (enemyHeight + enemyMargin),
                    width: enemyWidth,
                    height: enemyHeight,
                    dx: enemySpeed
                };
                enemies.push(enemy);
            }
        }
    }

    function checkCollisions() {
        bullets.forEach((bullet, bulletIndex) => {
            enemies.forEach((enemy, enemyIndex) => {
                if (bullet.x < enemy.x + enemy.width &&
                    bullet.x + bullet.width > enemy.x &&
                    bullet.y < enemy.y + enemy.height &&
                    bullet.y + bullet.height > enemy.y) {
                    bullets.splice(bulletIndex, 1);
                    enemies.splice(enemyIndex, 1);
                    score += 10;
                }
            });
        });
    }

    function drawScore() {
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText(`Score: ${score}`, 10, 20);
    }

    function createPowerUps() {
        const powerUp = {
            x: Math.random() * (canvas.width - 20),
            y: Math.random() * (canvas.height - 200),
            width: 20,
            height: 20,
            type: 'double-bullets'
        };
        powerUps.push(powerUp);
    }

    function drawPowerUps() {
        ctx.fillStyle = 'yellow';
        powerUps.forEach(powerUp => {
            ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
        });
    }

    function checkPowerUpCollisions() {
        powerUps.forEach((powerUp, index) => {
            if (player.x < powerUp.x + powerUp.width &&
                player.x + player.width > powerUp.x &&
                player.y < powerUp.y + powerUp.height &&
                player.y + player.height > powerUp.y) {
                if (powerUp.type === 'double-bullets') {
                    player.doubleBullets = true;
                }
                powerUps.splice(index, 1);
            }
        });
    }

    function update() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawPlayer();
        movePlayer();
        drawBullets();
        moveBullets();
        drawEnemies();
        moveEnemies();
        checkCollisions();
        drawPowerUps();
        checkPowerUpCollisions();
        drawScore();
        requestAnimationFrame(update);
    }

    function shoot() {
        const bullet1 = {
            x: player.x + player.width / 2 - 2,
            y: player.y,
            width: 4,
            height: 10,
            speed: 7
        };
        bullets.push(bullet1);

        if (player.doubleBullets) {
            const bullet2 = {
                x: player.x + player.width / 2 - 2,
                y: player.y - 10,
                width: 4,
                height: 10,
                speed: 7
            };
            bullets.push(bullet2);
        }
    }

    function keyDown(e) {
        if (e.key === 'ArrowRight') player.dx = player.speed;
        if (e.key === 'ArrowLeft') player.dx = -player.speed;
        if (e.key === ' ') shoot();
    }

    function keyUp(e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') player.dx = 0;
    }

    function touchStart(e) {
        const touch = e.touches[0];
        if (touch.clientX < canvas.width / 2) player.dx = -player.speed;
        else player.dx = player.speed;
    }

    function touchEnd() {
        player.dx = 0;
    }

    document.addEventListener('keydown', keyDown);
    document.addEventListener('keyup', keyUp);
    canvas.addEventListener('touchstart', touchStart);
    canvas.addEventListener('touchend', touchEnd);

    createEnemies();
    createPowerUps();
    update();
});
