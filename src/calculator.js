class Calculator {
    constructor() {
        this.reset();
    }

    reset() {
        this.currentValue = '0';
        this.previousValue = '';
        this.operation = null;
        this.waitingForOperand = false;
    }

    clearEntry() {
        this.currentValue = '0';
        this.waitingForOperand = false;
    }

    inputNumber(num) {
        if (this.waitingForOperand) {
            this.currentValue = String(num);
            this.waitingForOperand = false;
        } else {
            this.currentValue = this.currentValue === '0' ? String(num) : this.currentValue + num;
        }
    }

    inputDecimal() {
        if (this.waitingForOperand) {
            this.currentValue = '0.';
            this.waitingForOperand = false;
        } else if (this.currentValue.indexOf('.') === -1) {
            this.currentValue += '.';
        }
    }

    performOperation(nextOperation) {
        const inputValue = parseFloat(this.currentValue);

        if (this.previousValue === '') {
            this.previousValue = inputValue;
        } else if (this.operation) {
            const currentValue = this.previousValue || 0;
            const newValue = this.calculate(currentValue, inputValue, this.operation);

            if (newValue === null) {
                return false; // Error occurred
            }

            this.currentValue = String(newValue);
            this.previousValue = newValue;
        }

        this.waitingForOperand = true;
        this.operation = nextOperation;
        return true;
    }

    calculate(firstValue, secondValue, operation) {
        switch (operation) {
            case 'add':
                return firstValue + secondValue;
            case 'subtract':
                return firstValue - secondValue;
            case 'multiply':
                return firstValue * secondValue;
            case 'divide':
                if (secondValue === 0) {
                    return null; // Division by zero error
                }
                return firstValue / secondValue;
            case 'percentage':
                return firstValue * (secondValue / 100);
            default:
                return secondValue;
        }
    }

    equals() {
        const inputValue = parseFloat(this.currentValue);

        if (this.previousValue !== '' && this.operation) {
            const currentValue = this.previousValue || 0;
            const newValue = this.calculate(currentValue, inputValue, this.operation);

            if (newValue === null) {
                return false; // Error occurred
            }

            this.currentValue = String(newValue);
            this.previousValue = '';
            this.operation = null;
            this.waitingForOperand = true;
            return true;
        }

        // If no operation is pending, just return current value
        this.waitingForOperand = false;
        return true;
    }

    percentage() {
        const inputValue = parseFloat(this.currentValue);
        this.currentValue = String(inputValue / 100);
        this.waitingForOperand = true;
    }

    getDisplay() {
        // Format the display value
        const value = parseFloat(this.currentValue);
        
        // Handle very large or very small numbers
        if (Math.abs(value) >= 1e15 || (Math.abs(value) < 1e-6 && value !== 0)) {
            return value.toExponential(6);
        }

        // Format with appropriate decimal places
        const formatted = value.toString();
        
        // Limit display to reasonable length
        if (formatted.length > 12) {
            return parseFloat(value.toPrecision(8)).toString();
        }

        return formatted;
    }

    getCurrentValue() {
        return this.currentValue;
    }

    getPreviousValue() {
        return this.previousValue;
    }

    getOperation() {
        return this.operation;
    }

    isWaitingForOperand() {
        return this.waitingForOperand;
    }
}

// Export for testing (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Calculator;
}