// Setup for Jest tests

// Mock HTML structure for tests
const mockHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zen Calculator</title>
</head>
<body>
    <div class="calculator">
        <div class="display">
            <div class="display-text" id="display">0</div>
        </div>
        
        <div class="buttons">
            <button class="btn btn-clear" data-action="clear">C</button>
            <button class="btn btn-clear" data-action="clear-entry">CE</button>
            <button class="btn btn-operation" data-action="percentage">%</button>
            <button class="btn btn-operation" data-action="divide">÷</button>
            
            <button class="btn btn-number" data-number="7">7</button>
            <button class="btn btn-number" data-number="8">8</button>
            <button class="btn btn-number" data-number="9">9</button>
            <button class="btn btn-operation" data-action="multiply">×</button>
            
            <button class="btn btn-number" data-number="4">4</button>
            <button class="btn btn-number" data-number="5">5</button>
            <button class="btn btn-number" data-number="6">6</button>
            <button class="btn btn-operation" data-action="subtract">−</button>
            
            <button class="btn btn-number" data-number="1">1</button>
            <button class="btn btn-number" data-number="2">2</button>
            <button class="btn btn-number" data-number="3">3</button>
            <button class="btn btn-operation" data-action="add">+</button>
            
            <button class="btn btn-number btn-zero" data-number="0">0</button>
            <button class="btn btn-number" data-action="decimal">.</button>
            <button class="btn btn-equals" data-action="equals">=</button>
        </div>
    </div>
</body>
</html>
`;

// Setup DOM for each test
beforeEach(() => {
    document.documentElement.innerHTML = mockHTML;
});

// Cleanup after each test
afterEach(() => {
    document.documentElement.innerHTML = '';
});

// Mock console methods to avoid cluttering test output
global.console.log = jest.fn();
global.console.error = jest.fn();