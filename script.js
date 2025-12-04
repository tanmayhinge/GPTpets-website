// GPTPets JavaScript

// ============================================
// PARTICLE SYSTEM
// ============================================

const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');

let particles = [];
let mouse = {
    x: null,
    y: null,
    radius: 200,
    baseRadius: 200,
    targetRadius: 200,
    angle: 0
};
let imageLoaded = false;
let currentPattern = 'ohsoshy-xK7Fd4YaX5Y-unsplash.jpg';
let mouseVelocity = { x: 0, y: 0 };
let lastMousePos = { x: 0, y: 0 };
let sourcePoint = null; // Point from which new particles will emanate
let animationRunning = false;

// Set canvas size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();

// Track mouse position and velocity
window.addEventListener('mousemove', (e) => {
    if (mouse.x !== null && mouse.y !== null) {
        mouseVelocity.x = e.x - lastMousePos.x;
        mouseVelocity.y = e.y - lastMousePos.y;

        // Change radius based on movement speed
        const speed = Math.sqrt(mouseVelocity.x ** 2 + mouseVelocity.y ** 2);
        mouse.targetRadius = mouse.baseRadius + Math.min(speed * 3, 150);
    }

    lastMousePos.x = e.x;
    lastMousePos.y = e.y;
    mouse.x = e.x;
    mouse.y = e.y;
});

// Reset mouse position when cursor leaves the window
function resetMouse() {
    mouse.x = null;
    mouse.y = null;
    mouse.targetRadius = mouse.baseRadius;
    mouseVelocity.x = 0;
    mouseVelocity.y = 0;
}

window.addEventListener('mouseleave', resetMouse);
document.addEventListener('mouseleave', resetMouse);

// Also reset if mouse goes outside viewport bounds
window.addEventListener('mouseout', (e) => {
    if (e.relatedTarget === null || e.relatedTarget.nodeName === 'HTML') {
        resetMouse();
    }
});

// Particle class
class Particle {
    constructor(x, y, color, size, startX = null, startY = null) {
        this.baseX = x;
        this.baseY = y;

        // If source point provided, start from there
        if (startX !== null && startY !== null) {
            this.x = startX;
            this.y = startY;
            // Add highly random initial velocity for explosive spread effect
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 15 + 5; // Much higher speed variation
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.initialSpread = true;
            this.spreadTimer = Math.random() * 30; // Staggered start for more chaos
        } else {
            this.x = x;
            this.y = y;
            this.vx = 0;
            this.vy = 0;
            this.initialSpread = false;
            this.spreadTimer = 0;
        }

        this.size = size;
        this.density = (Math.random() * 40) + 5;
        this.color = color;
        this.opacity = startX !== null ? 0.3 : 1; // Start semi-visible if from source
        this.targetOpacity = 1;
    }

    draw() {
        // Update opacity for fade in/out effect
        if (this.opacity < this.targetOpacity) {
            this.opacity += 0.08; // Even faster fade in
        } else if (this.opacity > this.targetOpacity) {
            this.opacity -= 0.03; // Slower fade out for old particles
        }

        // Clamp opacity between 0 and 1
        this.opacity = Math.max(0, Math.min(1, this.opacity));

        // Apply opacity to color
        const rgbaMatch = this.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if (rgbaMatch) {
            ctx.fillStyle = `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${this.opacity})`;
        } else {
            ctx.fillStyle = this.color;
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }

    update() {
        // Initial spread phase - chaotic explosion then settle
        if (this.initialSpread) {
            // Wait for staggered timer
            if (this.spreadTimer > 0) {
                this.spreadTimer--;
                this.draw();
                return;
            }

            const dx = this.baseX - this.x;
            const dy = this.baseY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Add turbulence for more chaotic movement
            this.vx += (Math.random() - 0.5) * 0.5;
            this.vy += (Math.random() - 0.5) * 0.5;

            // If close enough to base position, disable initial spread
            if (distance < 10) {
                this.initialSpread = false;
            } else {
                // Gradually increase pull towards base position as they get closer
                const pullStrength = Math.min(0.15, 0.03 + (1 / distance) * 100);
                this.vx += dx * pullStrength;
                this.vy += dy * pullStrength;
                // Less friction for more fluid movement
                this.vx *= 0.92;
                this.vy *= 0.92;
            }
        } else {
            // Normal mouse interaction with morphing elliptical shape
            if (mouse.x != null && mouse.y != null) {
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;

                // Create elliptical distortion based on mouse velocity
                const velocityAngle = Math.atan2(mouseVelocity.y, mouseVelocity.x);
                const relativeAngle = Math.atan2(dy, dx) - velocityAngle;

                // Morph the radius into an ellipse shape
                const ellipseStretch = 1 + Math.abs(Math.cos(relativeAngle)) * 0.5;
                const morphedRadius = mouse.radius * ellipseStretch;

                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < morphedRadius) {
                    let angle = Math.atan2(dy, dx);
                    let force = (morphedRadius - distance) / morphedRadius;
                    let pushForce = force * this.density * 0.6;

                    this.vx -= Math.cos(angle) * pushForce;
                    this.vy -= Math.sin(angle) * pushForce;
                }
            }

            // Return to base position with spring effect
            let dx = this.baseX - this.x;
            let dy = this.baseY - this.y;

            this.vx += dx * 0.05;
            this.vy += dy * 0.05;

            // Apply friction
            this.vx *= 0.85;
            this.vy *= 0.85;
        }

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        this.draw();
    }
}

// Load and convert image to particles
function init(imageSrc = currentPattern, sourceX = null, sourceY = null) {
    // Fade out old particles
    particles.forEach(p => {
        p.targetOpacity = 0;
    });

    imageLoaded = false;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    img.onload = function() {
        // Create temporary canvas to sample image
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        // Calculate scaling to cover the screen
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const offsetX = (canvas.width - scaledWidth) / 2;
        const offsetY = (canvas.height - scaledHeight) / 2;

        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

        const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        // Sample particles from image (skip pixels for performance)
        const gap = 11; // Distance between particles (increased to reduce count)
        const newParticles = [];

        for (let y = 0; y < canvas.height; y += gap) {
            for (let x = 0; x < canvas.width; x += gap) {
                const index = (y * canvas.width + x) * 4;
                const red = pixels[index];
                const green = pixels[index + 1];
                const blue = pixels[index + 2];
                const alpha = pixels[index + 3];

                // Only create particle if pixel is not too dark and visible
                const brightness = (red + green + blue) / 3;

                if (alpha > 50 && brightness > 20) {
                    // Use actual image colors without tint
                    const color = `rgba(${red}, ${green}, ${blue}, ${alpha / 255 * 0.8})`;

                    // Vary particle size based on brightness
                    const size = brightness > 150 ? 4.5 : 3;

                    // Create particle with source point if provided
                    newParticles.push(new Particle(x, y, color, size, sourceX, sourceY));
                }
            }
        }

        // Add new particles immediately
        setTimeout(() => {
            particles = newParticles; // Replace old particles
            imageLoaded = true;
            if (!animationRunning) {
                animate();
            }
        }, 100);
    };

    img.onerror = function() {
        console.error('Failed to load image');
        // Fallback: create simple grid of pink particles
        for (let y = 0; y < canvas.height; y += 11) {
            for (let x = 0; x < canvas.width; x += 11) {
                if (Math.random() > 0.5) {
                    const colors = [
                        'rgba(255, 105, 180, 0.6)',
                        'rgba(255, 20, 147, 0.6)',
                        'rgba(138, 43, 226, 0.4)'
                    ];
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    particles.push(new Particle(x, y, color, 4));
                }
            }
        }
        imageLoaded = true;
        animate();
    };
}

// Animation loop
function animate() {
    animationRunning = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Smoothly interpolate radius changes
    mouse.radius += (mouse.targetRadius - mouse.radius) * 0.1;

    // Decay velocity
    mouseVelocity.x *= 0.9;
    mouseVelocity.y *= 0.9;

    // Reset to base radius when mouse is stationary
    const currentSpeed = Math.sqrt(mouseVelocity.x ** 2 + mouseVelocity.y ** 2);
    if (currentSpeed < 0.5) {
        mouse.targetRadius = mouse.baseRadius;
    }

    // Update and draw all particles
    particles.forEach(particle => {
        particle.update();
    });

    // Remove fully faded particles
    particles = particles.filter(p => p.opacity > 0.01);

    requestAnimationFrame(animate);
}

// Initialize particles
init();

// ============================================
// PATTERN SELECTOR
// ============================================

const patternButtons = document.querySelectorAll('.pattern-btn');
patternButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons
        patternButtons.forEach(b => b.classList.remove('active'));

        // Add active class to clicked button
        btn.classList.add('active');

        // Get button position
        const rect = btn.getBoundingClientRect();
        const sourceX = rect.left + rect.width / 2;
        const sourceY = rect.top + rect.height / 2;

        // Get the pattern from data attribute
        const pattern = btn.getAttribute('data-pattern');
        currentPattern = pattern;

        // Reinitialize particles with new pattern from button position
        init(pattern, sourceX, sourceY);
    });
});

// Reinitialize on resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        resizeCanvas();
        init(currentPattern);
    }, 250);
});

// ============================================
// SCROLL & UI INTERACTIONS
// ============================================

// Scroll reveal animation
function reveal() {
    const reveals = document.querySelectorAll('.reveal');

    reveals.forEach(element => {
        const windowHeight = window.innerHeight;
        const elementTop = element.getBoundingClientRect().top;
        const elementVisible = 150;

        if (elementTop < windowHeight - elementVisible) {
            element.classList.add('active');
        }
    });
}

window.addEventListener('scroll', reveal);
reveal(); // Check on load

// Smooth scroll for links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// CTA button click handler
const ctaButton = document.querySelector('.cta-button');
ctaButton.addEventListener('click', function(e) {
    // You can add your Chrome Web Store link here
    // For now, preventing default
    e.preventDefault();
    alert('Chrome Web Store link will be added here!');
});

// Scroll indicator functionality
const scrollIndicator = document.getElementById('scrollIndicator');
const demoSection = document.querySelector('.demo');

scrollIndicator.addEventListener('click', () => {
    demoSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
});

// Hide scroll indicator when user scrolls past hero section
window.addEventListener('scroll', () => {
    const heroSection = document.querySelector('.hero');
    const heroBottom = heroSection.offsetTop + heroSection.offsetHeight;

    if (window.scrollY > heroBottom - 200) {
        scrollIndicator.style.opacity = '0';
        scrollIndicator.style.pointerEvents = 'none';
    } else {
        scrollIndicator.style.opacity = '1';
        scrollIndicator.style.pointerEvents = 'auto';
    }
});
