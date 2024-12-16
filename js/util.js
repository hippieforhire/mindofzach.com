// util.js

function rand(max) {
  return Math.random() * max;
}

function angle(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

function fadeInOut(life, ttl) {
  const halfTTL = ttl / 2;
  if (life < halfTTL) {
    return life / halfTTL;
  } else {
    return (ttl - life) / halfTTL;
  }
}
