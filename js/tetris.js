(function() {
  const canvas = document.getElementById('tetrisCanvas');
  const context = canvas.getContext('2d');
  const scoreElement = document.getElementById('tetrisScore');
  const startButton = document.getElementById('startTetrisButton');

  const leftBtn = document.getElementById('tetrisLeft');
  const rightBtn = document.getElementById('tetrisRight');
  const rotateBtn = document.getElementById('tetrisRotate');
  const downBtn = document.getElementById('tetrisDown');

  const scale = 20;
  context.scale(scale, scale);

  let arena = createMatrix(12, 20);
  let dropCounter = 0;
  let dropInterval = 1000;
  let lastTime = 0;
  let score = 0;
  let level = 1;
  let linesCleared = 0;
  const levelThreshold = 10; 
  let animationId = null;

  let player = {
    pos:{x:0,y:0},
    matrix:null,
    isPowerUp:false,
  };

  const pieces='TJLOSZI';
  const colors=[
    null,
    '#FF0D72',
    '#0DC2FF',
    '#0DFF72',
    '#F538FF',
    '#FF8E0D',
    '#FFE138',
    '#3877FF',
  ];
  const powerUpColor='#FFD700';

  function createMatrix(w,h) {
    const matrix=[];
    for(let i=0;i<h;i++){
      matrix.push(new Array(w).fill(0));
    }
    return matrix;
  }

  function createPiece(type,isPower=false){
    let piece;
    if(type==='T'){
      piece=[
        [0,1,0],
        [1,1,1],
        [0,0,0],
      ];
    }else if(type==='O'){
      piece=[
        [1,1],
        [1,1],
      ];
    }else if(type==='L'){
      piece=[
        [0,2,0],
        [0,2,0],
        [0,2,2],
      ];
    }else if(type==='J'){
      piece=[
        [0,3,0],
        [0,3,0],
        [3,3,0],
      ];
    }else if(type==='S'){
      piece=[
        [0,4,4],
        [4,4,0],
        [0,0,0],
      ];
    }else if(type==='Z'){
      piece=[
        [5,5,0],
        [0,5,5],
        [0,0,0],
      ];
    }else if(type==='I'){
      piece=[
        [0,6,0,0],
        [0,6,0,0],
        [0,6,0,0],
        [0,6,0,0],
      ];
    }
    if(isPower){
      for(let y=0;y<piece.length;y++){
        for(let x=0;x<piece[y].length;x++){
          if(piece[y][x]!==0) piece[y][x]=7;
        }
      }
    }
    return piece;
  }

  function collide(arena,player){
    const m=player.matrix;
    const o=player.pos;
    for(let y=0;y<m.length;y++){
      for(let x=0;x<m[y].length;x++){
        if(m[y][x]!==0 &&
           (arena[y+o.y] && arena[y+o.y][x+o.x])!==0){
          return true;
        }
      }
    }
    return false;
  }

  function merge(arena,player){
    player.matrix.forEach((row,y)=>{
      row.forEach((value,x)=>{
        if(value!==0){
          arena[y+player.pos.y][x+player.pos.x]=value;
        }
      });
    });
  }

  function arenaSweep(){
    let rowCount=1;
    let cleared=0;
    outer:for(let y=arena.length-1;y>0;y--){
      for(let x=0;x<arena[y].length;x++){
        if(arena[y][x]===0){
          continue outer;
        }
      }
      const row=arena.splice(y,1)[0].fill(0);
      arena.unshift(row);
      y++;
      score+=rowCount*10;
      rowCount*=2;
      cleared++;
    }
    if(cleared>0){
      linesCleared+=cleared;
      if(player.isPowerUp){
        score+=cleared*20;
      }
      if(linesCleared>=level*levelThreshold){
        level++;
        dropInterval=Math.max(200, dropInterval-100);
      }
    }
  }

  function playerReset(){
    const pieceType=pieces[(pieces.length*Math.random())|0];
    const isPower=Math.random()<0.1;
    player.matrix=createPiece(pieceType,isPower);
    player.isPowerUp=isPower;
    player.pos.y=0;
    player.pos.x=(arena[0].length/2|0)-(player.matrix[0].length/2|0);

    if(collide(arena,player)){
      arena.forEach(row=>row.fill(0));
      score=0;
      linesCleared=0;
      level=1;
      dropInterval=1000;
      updateScore();
    }
  }

  function playerRotate(dir){
    const pos=player.pos.x;
    let offset=1;
    rotate(player.matrix,dir);
    while(collide(arena,player)){
      player.pos.x+=offset;
      offset=-(offset+(offset>0?1:-1));
      if(offset>player.matrix[0].length){
        rotate(player.matrix,-dir);
        player.pos.x=pos;
        return;
      }
    }
  }

  function rotate(matrix,dir){
    for(let y=0;y<matrix.length;y++){
      for(let x=0;x<y;x++){
        [matrix[x][y],matrix[y][x]]=[matrix[y][x],matrix[x][y]];
      }
    }
    if(dir>0){
      matrix.forEach(row=>row.reverse());
    }else{
      matrix.reverse();
    }
  }

  function playerMove(dir){
    player.pos.x+=dir;
    if(collide(arena,player)){
      player.pos.x-=dir;
    }
  }

  function playerDrop(){
    player.pos.y++;
    if(collide(arena,player)){
      player.pos.y--;
      merge(arena,player);
      arenaSweep();
      updateScore();
      playerReset();
    }
    dropCounter=0;
  }

  function drawMatrix(matrix,offset){
    matrix.forEach((row,y)=>{
      row.forEach((value,x)=>{
        if(value!==0){
          context.fillStyle=(value===7?powerUpColor:colors[value]);
          context.fillRect(x+offset.x,y+offset.y,1,1);
        }
      });
    });
  }

  function draw(){
    context.fillStyle='#000';
    context.fillRect(0,0,canvas.width/scale,canvas.height/scale);
    drawMatrix(arena,{x:0,y:0});
    drawMatrix(player.matrix,player.pos);
  }

  function update(time=0){
    const deltaTime=time-lastTime;
    lastTime=time;
    dropCounter+=deltaTime;
    if(dropCounter>dropInterval){
      playerDrop();
    }
    draw();
    animationId=requestAnimationFrame(update);
  }

  function updateScore(){
    scoreElement.textContent='Score: '+score;
  }

  document.addEventListener('keydown',e=>{
    if(document.getElementById("tetrisModal").classList.contains("hidden")) return;
    if(e.key==='ArrowLeft'){
      playerMove(-1);
    }else if(e.key==='ArrowRight'){
      playerMove(1);
    }else if(e.key==='ArrowDown'){
      playerDrop();
    }else if(e.key==='ArrowUp'){
      playerRotate(1);
    }
  });

  // Touch controls
  leftBtn.addEventListener('click',()=>playerMove(-1));
  rightBtn.addEventListener('click',()=>playerMove(1));
  rotateBtn.addEventListener('click',()=>playerRotate(1));
  downBtn.addEventListener('click',()=>playerDrop());

  startButton.addEventListener('click',()=>{
    arena=createMatrix(12,20);
    score=0;
    linesCleared=0;
    level=1;
    dropInterval=1000;
    updateScore();
    playerReset();
    cancelAnimationFrame(animationId);
    lastTime=0;
    dropCounter=0;
    update();
  });
})();
