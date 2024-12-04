function showCalculator() {
    const calculatorDiv = document.createElement('div');
    calculatorDiv.id = 'calculator';
    calculatorDiv.innerHTML = `
        <input type="text" id="calcInput" readonly>
        <div>
            <button onclick="appendCalcValue('1')">1</button>
            <button onclick="appendCalcValue('2')">2</button>
            <button onclick="appendCalcValue('3')">3</button>
            <button onclick="appendCalcValue('+')">+</button>
        </div>
        <div>
            <button onclick="appendCalcValue('4')">4</button>
            <button onclick="appendCalcValue('5')">5</button>
            <button onclick="appendCalcValue('6')">6</button>
            <button onclick="appendCalcValue('-')">-</button>
        </div>
        <div>
            <button onclick="appendCalcValue('7')">7</button>
            <button onclick="appendCalcValue('8')">8</button>
            <button onclick="appendCalcValue('9')">9</button>
            <button onclick="appendCalcValue('*')">*</button>
        </div>
        <div>
            <button onclick="appendCalcValue('0')">0</button>
            <button onclick="appendCalcValue('.')">.</button>
            <button onclick="calculateResult()">=</button>
            <button onclick="appendCalcValue('/')">/</button>
        </div>
        <button onclick="clearCalc()">C</button>
    `;
    document.body.appendChild(calculatorDiv);
}

function appendCalcValue(value) {
    const calcInput = document.getElementById('calcInput');
    calcInput.value += value;
}

function calculateResult() {
    const calcInput = document.getElementById('calcInput');
    try {
        calcInput.value = eval(calcInput.value);
    } catch {
        calcInput.value = 'Error';
    }
}

function clearCalc() {
    const calcInput = document.getElementById('calcInput');
    calcInput.value = '';
}

// Add a button to show the calculator
document.body.innerHTML += '<button onclick="showCalculator()">Show Calculator</button>';
