class CalculatorUI {
    constructor(calculator) {
        this.calculator = calculator;
        this.display = document.getElementById('display');
        this.buttons = document.querySelector('.buttons');
        
        this.initializeEventListeners();
        this.updateDisplay();
    }

    initializeEventListeners() {
        // Button click events
        this.buttons.addEventListener('click', (e) => {
            if (!e.target.classList.contains('btn')) return;
            
            e.target.blur(); // Remove focus to prevent keyboard navigation issues
            this.handleButtonClick(e.target);
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });

        // Prevent context menu on buttons
        this.buttons.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    handleButtonClick(button) {
        const action = button.dataset.action;
        const number = button.dataset.number;

        if (number !== undefined) {
            this.handleNumber(number);
        } else if (action) {
            this.handleAction(action);
        }
    }

    handleNumber(number) {
        this.calculator.inputNumber(number);
        this.updateDisplay();
    }

    handleAction(action) {
        switch (action) {
            case 'clear':
                this.calculator.reset();
                this.updateDisplay();
                break;
                
            case 'clear-entry':
                this.calculator.clearEntry();
                this.updateDisplay();
                break;
                
            case 'decimal':
                this.calculator.inputDecimal();
                this.updateDisplay();
                break;
                
            case 'equals':
                if (!this.calculator.equals()) {
                    this.showError('Error');
                } else {
                    this.updateDisplay();
                }
                break;
                
            case 'percentage':
                this.calculator.percentage();
                this.updateDisplay();
                break;
                
            case 'add':
            case 'subtract':
            case 'multiply':
            case 'divide':
                if (!this.calculator.performOperation(action)) {
                    this.showError('Cannot divide by zero');
                } else {
                    this.updateDisplay();
                }
                break;
        }
    }

    handleKeydown(e) {
        // Prevent default behavior for handled keys
        const handledKeys = [
            '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
            '+', '-', '*', '/', '=', 'Enter', 'Escape', 'Backspace',
            '.', '%', 'c', 'C'
        ];

        if (handledKeys.includes(e.key)) {
            e.preventDefault();
        }

        // Handle number keys
        if (/^[0-9]$/.test(e.key)) {
            this.handleNumber(e.key);
            return;
        }

        // Handle operation keys
        switch (e.key) {
            case '+':
                this.handleAction('add');
                break;
            case '-':
                this.handleAction('subtract');
                break;
            case '*':
                this.handleAction('multiply');
                break;
            case '/':
                this.handleAction('divide');
                break;
            case '=':
            case 'Enter':
                this.handleAction('equals');
                break;
            case '.':
                this.handleAction('decimal');
                break;
            case '%':
                this.handleAction('percentage');
                break;
            case 'Escape':
            case 'c':
            case 'C':
                this.handleAction('clear');
                break;
            case 'Backspace':
                this.handleAction('clear-entry');
                break;
        }
    }

    updateDisplay() {
        const displayValue = this.calculator.getDisplay();
        this.display.textContent = displayValue;
        
        // Adjust font size for long numbers
        this.adjustDisplayFontSize(displayValue);
    }

    adjustDisplayFontSize(value) {
        const length = value.length;
        
        if (length > 12) {
            this.display.style.fontSize = '1.8rem';
        } else if (length > 9) {
            this.display.style.fontSize = '2.2rem';
        } else {
            this.display.style.fontSize = '2.5rem';
        }
    }

    showError(message) {
        this.display.textContent = message;
        this.display.style.fontSize = '2rem';
        
        // Clear error after a short delay and reset calculator
        setTimeout(() => {
            this.calculator.reset();
            this.updateDisplay();
        }, 1500);
    }

    // Visual feedback for button presses
    animateButton(selector) {
        const button = document.querySelector(selector);
        if (button) {
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = '';
            }, 100);
        }
    }

    // Add visual feedback for keyboard presses
    highlightButtonForKey(key) {
        let selector = '';
        
        if (/^[0-9]$/.test(key)) {
            selector = `[data-number="${key}"]`;
        } else {
            const keyMap = {
                '+': '[data-action="add"]',
                '-': '[data-action="subtract"]',
                '*': '[data-action="multiply"]',
                '/': '[data-action="divide"]',
                '=': '[data-action="equals"]',
                'Enter': '[data-action="equals"]',
                '.': '[data-action="decimal"]',
                '%': '[data-action="percentage"]',
                'Escape': '[data-action="clear"]',
                'c': '[data-action="clear"]',
                'C': '[data-action="clear"]',
                'Backspace': '[data-action="clear-entry"]'
            };
            selector = keyMap[key];
        }
        
        if (selector) {
            this.animateButton(selector);
        }
    }
}

// Update the keydown handler to include visual feedback
CalculatorUI.prototype.handleKeydown = function(e) {
    const handledKeys = [
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        '+', '-', '*', '/', '=', 'Enter', 'Escape', 'Backspace',
        '.', '%', 'c', 'C'
    ];

    if (handledKeys.includes(e.key)) {
        e.preventDefault();
        this.highlightButtonForKey(e.key);
    }

    // Handle number keys
    if (/^[0-9]$/.test(e.key)) {
        this.handleNumber(e.key);
        return;
    }

    // Handle operation keys
    switch (e.key) {
        case '+':
            this.handleAction('add');
            break;
        case '-':
            this.handleAction('subtract');
            break;
        case '*':
            this.handleAction('multiply');
            break;
        case '/':
            this.handleAction('divide');
            break;
        case '=':
        case 'Enter':
            this.handleAction('equals');
            break;
        case '.':
            this.handleAction('decimal');
            break;
        case '%':
            this.handleAction('percentage');
            break;
        case 'Escape':
        case 'c':
        case 'C':
            this.handleAction('clear');
            break;
        case 'Backspace':
            this.handleAction('clear-entry');
            break;
    }
};

// Export for testing (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CalculatorUI;
}