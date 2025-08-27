// Import classes for testing
const Calculator = require('./calculator');
const CalculatorUI = require('./ui');

describe('CalculatorUI', () => {
    let calculator;
    let calculatorUI;

    beforeEach(() => {
        // Create fresh instances for each test
        calculator = new Calculator();
        calculatorUI = new CalculatorUI(calculator);
    });

    describe('Display Updates', () => {
        test('should initialize display with 0', () => {
            const display = document.getElementById('display');
            expect(display.textContent).toBe('0');
        });

        test('should update display when number is clicked', () => {
            const button = document.querySelector('[data-number="5"]');
            button.click();
            
            const display = document.getElementById('display');
            expect(display.textContent).toBe('5');
        });

        test('should update display for multiple digit numbers', () => {
            const button1 = document.querySelector('[data-number="1"]');
            const button2 = document.querySelector('[data-number="2"]');
            const button3 = document.querySelector('[data-number="3"]');
            
            button1.click();
            button2.click();
            button3.click();
            
            const display = document.getElementById('display');
            expect(display.textContent).toBe('123');
        });
    });

    describe('Button Click Handling', () => {
        test('should handle number button clicks', () => {
            const spy = jest.spyOn(calculatorUI, 'handleNumber');
            const button = document.querySelector('[data-number="7"]');
            
            button.click();
            
            expect(spy).toHaveBeenCalledWith('7');
        });

        test('should handle operation button clicks', () => {
            const spy = jest.spyOn(calculatorUI, 'handleAction');
            const button = document.querySelector('[data-action="add"]');
            
            button.click();
            
            expect(spy).toHaveBeenCalledWith('add');
        });

        test('should handle clear button clicks', () => {
            const button5 = document.querySelector('[data-number="5"]');
            const clearButton = document.querySelector('[data-action="clear"]');
            
            button5.click();
            clearButton.click();
            
            const display = document.getElementById('display');
            expect(display.textContent).toBe('0');
        });

        test('should handle decimal button clicks', () => {
            const button3 = document.querySelector('[data-number="3"]');
            const decimalButton = document.querySelector('[data-action="decimal"]');
            const button1 = document.querySelector('[data-number="1"]');
            
            button3.click();
            decimalButton.click();
            button1.click();
            
            const display = document.getElementById('display');
            expect(display.textContent).toBe('3.1');
        });
    });

    describe('Keyboard Input', () => {
        test('should handle number key presses', () => {
            const spy = jest.spyOn(calculatorUI, 'handleNumber');
            
            const event = new KeyboardEvent('keydown', { key: '5' });
            document.dispatchEvent(event);
            
            expect(spy).toHaveBeenCalledWith('5');
        });

        test('should handle operation key presses', () => {
            const spy = jest.spyOn(calculatorUI, 'handleAction');
            
            const event = new KeyboardEvent('keydown', { key: '+' });
            document.dispatchEvent(event);
            
            expect(spy).toHaveBeenCalledWith('add');
        });

        test('should handle Enter key as equals', () => {
            const spy = jest.spyOn(calculatorUI, 'handleAction');
            
            const event = new KeyboardEvent('keydown', { key: 'Enter' });
            document.dispatchEvent(event);
            
            expect(spy).toHaveBeenCalledWith('equals');
        });

        test('should handle Escape key as clear', () => {
            const spy = jest.spyOn(calculatorUI, 'handleAction');
            
            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(event);
            
            expect(spy).toHaveBeenCalledWith('clear');
        });

        test('should prevent default behavior for handled keys', () => {
            const event = new KeyboardEvent('keydown', { key: '5' });
            const spy = jest.spyOn(event, 'preventDefault');
            
            document.dispatchEvent(event);
            
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('Calculator Operations Integration', () => {
        test('should perform complete calculation via UI', () => {
            // Click 5 + 3 =
            const button5 = document.querySelector('[data-number="5"]');
            const plusButton = document.querySelector('[data-action="add"]');
            const button3 = document.querySelector('[data-number="3"]');
            const equalsButton = document.querySelector('[data-action="equals"]');
            
            button5.click();
            plusButton.click();
            button3.click();
            equalsButton.click();
            
            const display = document.getElementById('display');
            expect(display.textContent).toBe('8');
        });

        test('should handle division by zero error', () => {
            const spy = jest.spyOn(calculatorUI, 'showError');
            
            const button5 = document.querySelector('[data-number="5"]');
            const divideButton = document.querySelector('[data-action="divide"]');
            const button0 = document.querySelector('[data-number="0"]');
            const equalsButton = document.querySelector('[data-action="equals"]');
            
            button5.click();
            divideButton.click();
            button0.click();
            equalsButton.click();
            
            expect(spy).toHaveBeenCalledWith('Error');
        });
    });

    describe('Display Font Size Adjustment', () => {
        test('should adjust font size for long numbers', () => {
            // Set a long number directly
            calculator.currentValue = '123456789012345';
            calculatorUI.updateDisplay();
            
            const display = document.getElementById('display');
            const fontSize = window.getComputedStyle ? 
                window.getComputedStyle(display).fontSize : 
                display.style.fontSize;
                
            expect(display.style.fontSize).toBe('1.8rem');
        });

        test('should use medium font size for medium numbers', () => {
            calculator.currentValue = '1234567890';
            calculatorUI.updateDisplay();
            
            const display = document.getElementById('display');
            expect(display.style.fontSize).toBe('2.2rem');
        });

        test('should use normal font size for short numbers', () => {
            calculator.currentValue = '123';
            calculatorUI.updateDisplay();
            
            const display = document.getElementById('display');
            expect(display.style.fontSize).toBe('2.5rem');
        });
    });

    describe('Error Handling', () => {
        test('should show error message', () => {
            calculatorUI.showError('Test Error');
            
            const display = document.getElementById('display');
            expect(display.textContent).toBe('Test Error');
        });

        test('should reset calculator after error timeout', (done) => {
            const resetSpy = jest.spyOn(calculator, 'reset');
            
            calculatorUI.showError('Test Error');
            
            setTimeout(() => {
                expect(resetSpy).toHaveBeenCalled();
                done();
            }, 1600);
        });
    });

    describe('Button Animation', () => {
        test('should animate button on click', () => {
            const button = document.querySelector('[data-number="5"]');
            calculatorUI.animateButton('[data-number="5"]');
            
            expect(button.style.transform).toBe('scale(0.95)');
            
            setTimeout(() => {
                expect(button.style.transform).toBe('');
            }, 150);
        });

        test('should highlight button for keyboard input', () => {
            const spy = jest.spyOn(calculatorUI, 'animateButton');
            calculatorUI.highlightButtonForKey('5');
            
            expect(spy).toHaveBeenCalledWith('[data-number="5"]');
        });
    });

    describe('Event Listener Management', () => {
        test('should not handle clicks on non-button elements', () => {
            const spy = jest.spyOn(calculatorUI, 'handleButtonClick');
            const display = document.getElementById('display');
            
            display.click();
            
            expect(spy).not.toHaveBeenCalled();
        });

        test('should prevent context menu on buttons', () => {
            const button = document.querySelector('[data-number="5"]');
            const event = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true
            });
            const spy = jest.spyOn(event, 'preventDefault');
            
            button.dispatchEvent(event);
            
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('Accessibility and UX', () => {
        test('should remove focus from buttons after click', () => {
            const button = document.querySelector('[data-number="5"]');
            const spy = jest.spyOn(button, 'blur');
            
            button.click();
            
            expect(spy).toHaveBeenCalled();
        });
    });
});