function setupDrawingCanvas() {
    const canvas = document.createElement('canvas');
    canvas.id = 'drawingCanvas';
    canvas.width = 500;
    canvas.height = 500;
    canvas.style.border = '1px solid black';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let drawing = false;

    canvas.addEventListener('mousedown', () => drawing = true);
    canvas.addEventListener('mouseup', () => drawing = false);
    canvas.addEventListener('mousemove', draw);

    function draw(event) {
        if (!drawing) return;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'black';
        ctx.lineTo(event.clientX - canvas.offsetLeft, event.clientY - canvas.offsetTop);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(event.clientX - canvas.offsetLeft, event.clientY - canvas.offsetTop);
    }
}

// Add a button to show the drawing canvas
document.body.innerHTML += '<button onclick="setupDrawingCanvas()">Show Drawing Canvas</button>';