// Initialize the calculator application
document.addEventListener('DOMContentLoaded', () => {
    // Create calculator instance
    const calculator = new Calculator();
    
    // Create UI instance and connect it to the calculator
    const calculatorUI = new CalculatorUI(calculator);
    
    // Add some visual polish
    addLoadingAnimation();
    
    console.log('Zen Calculator initialized successfully');
});

// Add a subtle loading animation
function addLoadingAnimation() {
    const calculator = document.querySelector('.calculator');
    
    // Add fade-in animation
    calculator.style.opacity = '0';
    calculator.style.transform = 'translateY(20px)';
    calculator.style.transition = 'all 0.5s ease-out';
    
    // Trigger animation
    setTimeout(() => {
        calculator.style.opacity = '1';
        calculator.style.transform = 'translateY(0)';
    }, 100);
    
    // Remove transition after animation completes
    setTimeout(() => {
        calculator.style.transition = '';
    }, 600);
}

// Handle service worker registration for potential PWA features
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Service worker could be added later for offline functionality
        console.log('Service Worker support detected');
    });
}

// Global error handling
window.addEventListener('error', (e) => {
    console.error('Calculator error:', e.error);
    
    // Reset calculator on critical errors
    if (window.calculator) {
        window.calculator.reset();
        if (window.calculatorUI) {
            window.calculatorUI.updateDisplay();
        }
    }
});

// Expose calculator instance globally for debugging
window.addEventListener('load', () => {
    const calculator = document.querySelector('.calculator');
    if (calculator) {
        // Make instances available for debugging
        window.calculatorApp = {
            version: '1.0.0',
            calculator: window.calculator,
            ui: window.calculatorUI
        };
    }
});