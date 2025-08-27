const Calculator = require('./calculator');

describe('Calculator', () => {
    let calculator;

    beforeEach(() => {
        calculator = new Calculator();
    });

    describe('Basic Operations', () => {
        test('should perform addition correctly', () => {
            calculator.inputNumber('5');
            calculator.performOperation('add');
            calculator.inputNumber('3');
            calculator.equals();
            expect(calculator.getCurrentValue()).toBe('8');
        });

        test('should perform subtraction correctly', () => {
            calculator.inputNumber('10');
            calculator.performOperation('subtract');
            calculator.inputNumber('4');
            calculator.equals();
            expect(calculator.getCurrentValue()).toBe('6');
        });

        test('should perform multiplication correctly', () => {
            calculator.inputNumber('6');
            calculator.performOperation('multiply');
            calculator.inputNumber('7');
            calculator.equals();
            expect(calculator.getCurrentValue()).toBe('42');
        });

        test('should perform division correctly', () => {
            calculator.inputNumber('15');
            calculator.performOperation('divide');
            calculator.inputNumber('3');
            calculator.equals();
            expect(calculator.getCurrentValue()).toBe('5');
        });
    });

    describe('Number Input', () => {
        test('should handle single digit input', () => {
            calculator.inputNumber('5');
            expect(calculator.getCurrentValue()).toBe('5');
        });

        test('should handle multiple digit input', () => {
            calculator.inputNumber('1');
            calculator.inputNumber('2');
            calculator.inputNumber('3');
            expect(calculator.getCurrentValue()).toBe('123');
        });

        test('should handle zero input correctly', () => {
            calculator.inputNumber('0');
            expect(calculator.getCurrentValue()).toBe('0');
        });

        test('should replace leading zero with new number', () => {
            calculator.inputNumber('5');
            expect(calculator.getCurrentValue()).toBe('5');
        });
    });

    describe('Decimal Operations', () => {
        test('should handle decimal input', () => {
            calculator.inputNumber('3');
            calculator.inputDecimal();
            calculator.inputNumber('14');
            expect(calculator.getCurrentValue()).toBe('3.14');
        });

        test('should start with 0. when decimal pressed first', () => {
            calculator.inputDecimal();
            expect(calculator.getCurrentValue()).toBe('0.');
        });

        test('should not add multiple decimal points', () => {
            calculator.inputNumber('3');
            calculator.inputDecimal();
            calculator.inputNumber('14');
            calculator.inputDecimal();
            expect(calculator.getCurrentValue()).toBe('3.14');
        });

        test('should perform decimal arithmetic', () => {
            calculator.inputNumber('1');
            calculator.inputDecimal();
            calculator.inputNumber('5');
            calculator.performOperation('add');
            calculator.inputNumber('2');
            calculator.inputDecimal();
            calculator.inputNumber('3');
            calculator.equals();
            expect(calculator.getCurrentValue()).toBe('3.8');
        });
    });

    describe('Clear Operations', () => {
        test('should reset calculator with clear', () => {
            calculator.inputNumber('123');
            calculator.performOperation('add');
            calculator.inputNumber('456');
            calculator.reset();
            expect(calculator.getCurrentValue()).toBe('0');
            expect(calculator.getPreviousValue()).toBe('');
            expect(calculator.getOperation()).toBe(null);
        });

        test('should clear entry only', () => {
            calculator.inputNumber('123');
            calculator.performOperation('add');
            calculator.inputNumber('456');
            calculator.clearEntry();
            expect(calculator.getCurrentValue()).toBe('0');
            expect(calculator.getPreviousValue()).toBe(123);
            expect(calculator.getOperation()).toBe('add');
        });
    });

    describe('Error Handling', () => {
        test('should handle division by zero', () => {
            calculator.inputNumber('5');
            calculator.performOperation('divide');
            calculator.inputNumber('0');
            const result = calculator.equals();
            expect(result).toBe(false);
        });

        test('should handle division by zero in operation chain', () => {
            calculator.inputNumber('10');
            calculator.performOperation('divide');
            calculator.inputNumber('0');
            const result = calculator.performOperation('add');
            expect(result).toBe(false);
        });
    });

    describe('Percentage Operations', () => {
        test('should calculate percentage correctly', () => {
            calculator.inputNumber('50');
            calculator.percentage();
            expect(calculator.getCurrentValue()).toBe('0.5');
        });

        test('should handle percentage in operations', () => {
            calculator.inputNumber('200');
            calculator.performOperation('multiply');
            calculator.inputNumber('25');
            calculator.percentage();
            calculator.equals();
            expect(calculator.getCurrentValue()).toBe('50');
        });
    });

    describe('Operation Chaining', () => {
        test('should chain multiple operations', () => {
            calculator.inputNumber('10');
            calculator.performOperation('add');
            calculator.inputNumber('5');
            calculator.performOperation('multiply');
            calculator.inputNumber('2');
            calculator.equals();
            expect(calculator.getCurrentValue()).toBe('30');
        });

        test('should handle equals after operation without second operand', () => {
            calculator.inputNumber('10');
            calculator.performOperation('add');
            // When equals is pressed without second operand, it should use the first operand again
            calculator.equals();
            expect(calculator.getCurrentValue()).toBe('20');
        });
    });

    describe('Display Formatting', () => {
        test('should format large numbers in scientific notation', () => {
            calculator.currentValue = '1000000000000000';
            const display = calculator.getDisplay();
            expect(display).toMatch(/e\+/);
        });

        test('should format small numbers in scientific notation', () => {
            calculator.currentValue = '0.0000001';
            const display = calculator.getDisplay();
            expect(display).toMatch(/e-/);
        });

        test('should format normal numbers correctly', () => {
            calculator.currentValue = '123.456';
            const display = calculator.getDisplay();
            expect(display).toBe('123.456');
        });

        test('should limit precision for very long numbers', () => {
            calculator.currentValue = '1.23456789012345678901234567890';
            const display = calculator.getDisplay();
            expect(display.length).toBeLessThanOrEqual(15);
        });
    });

    describe('State Management', () => {
        test('should track waiting for operand state', () => {
            expect(calculator.isWaitingForOperand()).toBe(false);
            
            calculator.inputNumber('5');
            calculator.performOperation('add');
            expect(calculator.isWaitingForOperand()).toBe(true);
            
            calculator.inputNumber('3');
            expect(calculator.isWaitingForOperand()).toBe(false);
        });

        test('should handle repeated equals presses', () => {
            calculator.inputNumber('10');
            calculator.performOperation('add');
            calculator.inputNumber('5');
            calculator.equals();
            expect(calculator.getCurrentValue()).toBe('15');
            
            calculator.equals();
            expect(calculator.getCurrentValue()).toBe('15');
        });
    });

    describe('Edge Cases', () => {
        test('should handle very large numbers', () => {
            calculator.currentValue = '999999999999999';
            calculator.performOperation('add');
            calculator.inputNumber('1');
            calculator.equals();
            const result = parseFloat(calculator.getCurrentValue());
            expect(result).toBe(1000000000000000);
        });

        test('should handle negative results', () => {
            calculator.inputNumber('5');
            calculator.performOperation('subtract');
            calculator.inputNumber('10');
            calculator.equals();
            expect(calculator.getCurrentValue()).toBe('-5');
        });

        test('should handle fractional results', () => {
            calculator.inputNumber('1');
            calculator.performOperation('divide');
            calculator.inputNumber('3');
            calculator.equals();
            const result = parseFloat(calculator.getCurrentValue());
            expect(result).toBeCloseTo(0.3333333333333333);
        });
    });
});