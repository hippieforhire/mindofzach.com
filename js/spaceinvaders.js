// spaceinvaders.js

function startSpaceInvadersGame() {
    const canvas = document.getElementById('spaceInvadersCanvas');
    canvas.width = 800;
    canvas.height = 400;
    canvas.style.maxWidth = "100%";
    canvas.style.height = "auto";
    canvas.style.touchAction = 'none';

    const ctx = canvas.getContext('2d');

    const player = {
        width: 40,
        height: 20,
        x: canvas.width / 2 - 20,
        y: canvas.height - 50,
        speed: 5,
        dx: 0,
        doubleBullets: false
    };

    const bullets = [];
    const enemies = [];
    const powerUps = [];
    const enemyRows = 3;
    const enemyCols = 7;
    const enemyWidth = 30;
    const enemyHeight = 20;
    const enemyMargin = 20;
    const enemySpeed = 2;
    let score = 0;

    const stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 1.5
        });
    }

    function drawBackground() {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        stars.forEach(star => {
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

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

        if (enemies.length > 0) {
            const leftmostEnemy = enemies[0];
            const rightmostEnemy = enemies[enemies.length - 1];

            if (leftmostEnemy && rightmostEnemy) {
                if (leftmostEnemy.x <= 0 || rightmostEnemy.x + enemyWidth >= canvas.width) {
                    enemies.forEach(enemy => {
                        enemy.dx *= -1;
                        enemy.y += enemyMargin;
                    });
                }
            }
        }
    }

    function createEnemies() {
        for (let row = 0; row < enemyRows; row++) {
            for (let col = 0; col < enemyCols; col++) {
                const enemy = {
                    x: 50 + col * (enemyWidth + enemyMargin),
                    y: 50 + row * (enemyHeight + enemyMargin),
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
        drawBackground();
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
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const xPos = touch.clientX - rect.left;
        const yPos = touch.clientY - rect.top;

        if (yPos < canvas.height / 2) {
            shoot();
            player.dx = 0;
        } else {
            if (xPos < canvas.width / 2) player.dx = -player.speed;
            else player.dx = player.speed;
        }
    }

    function touchEnd() {
        player.dx = 0;
    }

    document.addEventListener('keydown', keyDown);
    document.addEventListener('keyup', keyUp);

    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        touchStart(e);
    }, { passive: false });

    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        touchEnd(e);
    }, { passive: false });

    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
    }, { passive: false });

    createEnemies();
    createPowerUps();
    update();
}

// Hook up the startSpaceInvaders button
document.getElementById('startSpaceInvaders').addEventListener('click', function() {
    startSpaceInvadersGame();
});
