// Game state
let score = 0;
let lastConfettiScore = 0;
let gameActive = true;

// Get DOM elements
const scoreElement = document.getElementById('score');
const resetBtn = document.getElementById('reset-btn');
const gameArea = document.getElementById('game-area');

// Update score display
function updateScore(points) {
    score += points;
    scoreElement.textContent = score;
    
    // Check if we need to show confetti (every 10 points)
    if (score >= lastConfettiScore + 10 && score > 0) {
        lastConfettiScore = Math.floor(score / 10) * 10;
        showConfetti();
    }
}

// Show confetti animation
function showConfetti() {
    if (typeof confetti !== 'undefined') {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FFD700', '#1E90FF', '#00BFFF']
        });
    }
}

// Create a water drop
function createDrop() {
    if (!gameActive) return;
    
    const drop = document.createElement('div');
    drop.className = 'water-drop';
    
    // 70% chance of clean drop, 30% chance of bad drop
    const isClean = Math.random() < 0.7;
    drop.classList.add(isClean ? 'clean' : 'bad');
    
    // Random horizontal position
    const maxX = window.innerWidth - 60;
    drop.style.left = Math.random() * maxX + 'px';
    
    // Random fall duration (3-6 seconds)
    const duration = 3 + Math.random() * 3;
    drop.style.animationDuration = duration + 's';
    
    // Click/tap handler
    drop.addEventListener('click', function(e) {
        e.preventDefault();
        handleDropClick(drop, isClean);
    });
    
    // Touch handler for mobile
    drop.addEventListener('touchstart', function(e) {
        e.preventDefault();
        handleDropClick(drop, isClean);
    });
    
    gameArea.appendChild(drop);
    
    // Remove drop after animation completes
    setTimeout(() => {
        if (drop.parentNode) {
            drop.remove();
        }
    }, duration * 1000);
}

// Handle drop click
function handleDropClick(drop, isClean) {
    if (!gameActive) return;
    
    // Update score
    if (isClean) {
        updateScore(1);
    } else {
        updateScore(-2);
    }
    
    // Remove the drop
    drop.remove();
}

// Reset game
function resetGame() {
    score = 0;
    lastConfettiScore = 0;
    scoreElement.textContent = '0';
    
    // Remove all drops
    const drops = document.querySelectorAll('.water-drop');
    drops.forEach(drop => drop.remove());
    
    // Show reset confetti
    if (typeof confetti !== 'undefined') {
        confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#FFD700', '#000000']
        });
    }
}

// Spawn drops at regular intervals
function startSpawning() {
    setInterval(() => {
        if (gameActive) {
            createDrop();
        }
    }, 1000); // Spawn a drop every second
}

// Event listeners
resetBtn.addEventListener('click', resetGame);

// Start the game
startSpawning();
