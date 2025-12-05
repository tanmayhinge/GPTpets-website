// GPTPets JavaScript
'use strict';

// ============================================
// CONSTANTS
// ============================================
// Detect if device is mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || window.innerWidth < 768;

// Detect device performance tier
const isLowPowerDevice = isMobile || navigator.hardwareConcurrency <= 4;

const PARTICLE_CONFIG = {
    GAP: isLowPowerDevice ? 26 : 13,  // Adaptive gap based on device power (26 on mobile = ~50% particles)
    SIZE_SMALL: 3,              // Small particle size
    SIZE_LARGE: 4.5,            // Large particle size
    BRIGHTNESS_THRESHOLD: 150,  // Threshold for particle size variation
    MIN_BRIGHTNESS: 25,         // Increased to reduce particle count
    MIN_ALPHA: 60,              // Increased to reduce particle count
    OPACITY: 0.8                // Base opacity for particles
};

const MOUSE_CONFIG = {
    BASE_RADIUS: 200,           // Base mouse interaction radius
    SPEED_MULTIPLIER: 3,        // Multiplier for radius based on speed
    MAX_SPEED_BONUS: 150,       // Maximum bonus to radius from speed
    INTERACTION_DISTANCE: 250   // Max distance to check for mouse interaction
};

const ANIMATION_CONFIG = {
    FADE_IN_SPEED: 0.08,        // Particle fade in speed
    FADE_OUT_SPEED: 0.03,       // Particle fade out speed
    OPACITY_THRESHOLD: 0.01,    // Minimum opacity before removal
    PARTICLE_DELAY: 100,        // Delay before showing new particles (ms)
    TARGET_FPS: 60,             // Target frames per second
    FRAME_TIME: 1000 / 60       // Target frame time in ms
};

const TIMING_CONFIG = {
    RESIZE_DEBOUNCE: 250        // Debounce time for resize events (ms)
};

// ============================================
// PARTICLE SYSTEM
// ============================================

const canvas = document.getElementById('particle-canvas');
const ctx = canvas?.getContext('2d');

let particles = [];
let mouse = {
    x: null,
    y: null,
    radius: MOUSE_CONFIG.BASE_RADIUS,
    baseRadius: MOUSE_CONFIG.BASE_RADIUS,
    targetRadius: MOUSE_CONFIG.BASE_RADIUS,
    angle: 0
};
let imageLoaded = false;
let currentPattern = 'ohsoshy-xK7Fd4YaX5Y-unsplash.jpg';
let mouseVelocity = { x: 0, y: 0 };
let lastMousePos = { x: 0, y: 0 };
let sourcePoint = null; // Point from which new particles will emanate
let animationRunning = false;
let lastFrameTime = 0;
let frameCount = 0;
let fps = 60;

/**
 * Resizes canvas to match window dimensions
 */
function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Initialize canvas on load
if (canvas && ctx) {
    resizeCanvas();
} else {
    console.error('Canvas element not found or context unavailable');
}

/**
 * Tracks mouse position and velocity for particle interaction
 */
window.addEventListener('mousemove', (e) => {
    if (mouse.x !== null && mouse.y !== null) {
        mouseVelocity.x = e.x - lastMousePos.x;
        mouseVelocity.y = e.y - lastMousePos.y;

        // Change radius based on movement speed
        const speed = Math.sqrt(mouseVelocity.x ** 2 + mouseVelocity.y ** 2);
        mouse.targetRadius = mouse.baseRadius + Math.min(
            speed * MOUSE_CONFIG.SPEED_MULTIPLIER,
            MOUSE_CONFIG.MAX_SPEED_BONUS
        );
    }

    lastMousePos.x = e.x;
    lastMousePos.y = e.y;
    mouse.x = e.x;
    mouse.y = e.y;
});

/**
 * Touch event handlers for mobile devices
 */
window.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        lastMousePos.x = touch.clientX;
        lastMousePos.y = touch.clientY;
        mouse.x = touch.clientX;
        mouse.y = touch.clientY;
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
        const touch = e.touches[0];

        if (mouse.x !== null && mouse.y !== null) {
            mouseVelocity.x = touch.clientX - lastMousePos.x;
            mouseVelocity.y = touch.clientY - lastMousePos.y;

            // Change radius based on movement speed
            const speed = Math.sqrt(mouseVelocity.x ** 2 + mouseVelocity.y ** 2);
            mouse.targetRadius = mouse.baseRadius + Math.min(
                speed * MOUSE_CONFIG.SPEED_MULTIPLIER,
                MOUSE_CONFIG.MAX_SPEED_BONUS
            );
        }

        lastMousePos.x = touch.clientX;
        lastMousePos.y = touch.clientY;
        mouse.x = touch.clientX;
        mouse.y = touch.clientY;
    }
}, { passive: true });

window.addEventListener('touchend', () => {
    resetMouse();
}, { passive: true });

/**
 * Resets mouse state when cursor leaves the window
 */
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

/**
 * Particle class representing individual animated particles
 */
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
            this.opacity += ANIMATION_CONFIG.FADE_IN_SPEED;
        } else if (this.opacity > this.targetOpacity) {
            this.opacity -= ANIMATION_CONFIG.FADE_OUT_SPEED;
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
            const distanceSquared = dx * dx + dy * dy;

            // Add turbulence for more chaotic movement
            this.vx += (Math.random() - 0.5) * 0.5;
            this.vy += (Math.random() - 0.5) * 0.5;

            // If close enough to base position, disable initial spread
            if (distanceSquared < 100) { // 10^2 = 100
                this.initialSpread = false;
            } else {
                const distance = Math.sqrt(distanceSquared);
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
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distanceSquared = dx * dx + dy * dy;

                // Quick distance check before expensive calculations
                const maxInteractionDistSquared = MOUSE_CONFIG.INTERACTION_DISTANCE * MOUSE_CONFIG.INTERACTION_DISTANCE;

                if (distanceSquared < maxInteractionDistSquared) {
                    const distance = Math.sqrt(distanceSquared);

                    // Create elliptical distortion based on mouse velocity
                    const velocityAngle = Math.atan2(mouseVelocity.y, mouseVelocity.x);
                    const relativeAngle = Math.atan2(dy, dx) - velocityAngle;

                    // Morph the radius into an ellipse shape
                    const ellipseStretch = 1 + Math.abs(Math.cos(relativeAngle)) * 0.5;
                    const morphedRadius = mouse.radius * ellipseStretch;

                    if (distance < morphedRadius) {
                        const angle = Math.atan2(dy, dx);
                        const force = (morphedRadius - distance) / morphedRadius;
                        const pushForce = force * this.density * 0.6;

                        this.vx -= Math.cos(angle) * pushForce;
                        this.vy -= Math.sin(angle) * pushForce;
                    }
                }
            }

            // Return to base position with spring effect
            const dx = this.baseX - this.x;
            const dy = this.baseY - this.y;

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

/**
 * Loads an image and converts it to particles
 * @param {string} imageSrc - Source path of the image
 * @param {number|null} sourceX - X coordinate for particle animation source
 * @param {number|null} sourceY - Y coordinate for particle animation source
 */
function init(imageSrc = currentPattern, sourceX = null, sourceY = null) {
    if (!canvas || !ctx) {
        console.error('Canvas not available for initialization');
        return;
    }
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
        const newParticles = [];

        for (let y = 0; y < canvas.height; y += PARTICLE_CONFIG.GAP) {
            for (let x = 0; x < canvas.width; x += PARTICLE_CONFIG.GAP) {
                const index = (y * canvas.width + x) * 4;
                const red = pixels[index];
                const green = pixels[index + 1];
                const blue = pixels[index + 2];
                const alpha = pixels[index + 3];

                // Only create particle if pixel is not too dark and visible
                const brightness = (red + green + blue) / 3;

                if (alpha > PARTICLE_CONFIG.MIN_ALPHA && brightness > PARTICLE_CONFIG.MIN_BRIGHTNESS) {
                    // Use actual image colors without tint
                    const color = `rgba(${red}, ${green}, ${blue}, ${alpha / 255 * PARTICLE_CONFIG.OPACITY})`;

                    // Vary particle size based on brightness
                    const size = brightness > PARTICLE_CONFIG.BRIGHTNESS_THRESHOLD
                        ? PARTICLE_CONFIG.SIZE_LARGE
                        : PARTICLE_CONFIG.SIZE_SMALL;

                    // Create particle with source point if provided
                    newParticles.push(new Particle(x, y, color, size, sourceX, sourceY));
                }
            }
        }

        // Add new particles after delay
        setTimeout(() => {
            particles = newParticles; // Replace old particles
            imageLoaded = true;
            if (!animationRunning) {
                animate();
            }
        }, ANIMATION_CONFIG.PARTICLE_DELAY);
    };

    img.onerror = function() {
        console.error('Failed to load image:', imageSrc);
        // Fallback: create simple grid of pink particles
        for (let y = 0; y < canvas.height; y += PARTICLE_CONFIG.GAP) {
            for (let x = 0; x < canvas.width; x += PARTICLE_CONFIG.GAP) {
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

/**
 * Main animation loop for particle system
 */
function animate(currentTime = 0) {
    if (!ctx || !canvas) return;

    // Calculate delta time and FPS
    const deltaTime = currentTime - lastFrameTime;

    // Throttle to target frame rate on low-power devices
    if (isLowPowerDevice && deltaTime < ANIMATION_CONFIG.FRAME_TIME) {
        requestAnimationFrame(animate);
        return;
    }

    lastFrameTime = currentTime;
    frameCount++;

    // Update FPS counter every 60 frames
    if (frameCount % 60 === 0) {
        fps = Math.round(1000 / deltaTime);
    }

    animationRunning = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Smoothly interpolate radius changes
    mouse.radius += (mouse.targetRadius - mouse.radius) * 0.1;

    // Decay velocity
    mouseVelocity.x *= 0.9;
    mouseVelocity.y *= 0.9;

    // Reset to base radius when mouse is stationary
    const velocitySquared = mouseVelocity.x * mouseVelocity.x + mouseVelocity.y * mouseVelocity.y;
    if (velocitySquared < 0.25) { // 0.5^2 = 0.25
        mouse.targetRadius = mouse.baseRadius;
    }

    // Update and draw all particles
    const particleCount = particles.length;
    for (let i = 0; i < particleCount; i++) {
        particles[i].update();
    }

    // Remove fully faded particles (do this less frequently for performance)
    if (frameCount % 10 === 0) {
        particles = particles.filter(p => p.opacity > ANIMATION_CONFIG.OPACITY_THRESHOLD);
    }

    requestAnimationFrame(animate);
}

// Initialize particles on load
if (canvas && ctx) {
    init();
}

// ============================================
// PATTERN SELECTOR
// ============================================

/**
 * Initialize pattern selector buttons
 */
const patternButtons = document.querySelectorAll('.pattern-btn');
if (patternButtons.length > 0) {
    patternButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            patternButtons.forEach(b => b.classList.remove('active'));

            // Add active class to clicked button
            btn.classList.add('active');

            // Get button position for particle animation source
            const rect = btn.getBoundingClientRect();
            const sourceX = rect.left + rect.width / 2;
            const sourceY = rect.top + rect.height / 2;

            // Get the pattern from data attribute
            const pattern = btn.getAttribute('data-pattern');
            if (pattern) {
                currentPattern = pattern;
                // Reinitialize particles with new pattern from button position
                init(pattern, sourceX, sourceY);
            }
        });
    });
}

/**
 * Reinitialize particles on window resize (debounced)
 */
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        resizeCanvas();
        if (canvas && ctx) {
            init(currentPattern);
        }
    }, TIMING_CONFIG.RESIZE_DEBOUNCE);
});

// ============================================
// SCROLL & UI INTERACTIONS
// ============================================

/**
 * Scroll reveal animation for elements with .reveal class
 */
function reveal() {
    const reveals = document.querySelectorAll('.reveal');
    if (reveals.length === 0) return;

    const windowHeight = window.innerHeight;
    const elementVisible = 150;

    reveals.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;
        if (elementTop < windowHeight - elementVisible) {
            element.classList.add('active');
        }
    });
}

if (document.querySelectorAll('.reveal').length > 0) {
    window.addEventListener('scroll', reveal);
    reveal(); // Check on load
}

/**
 * Smooth scroll for anchor links
 */
const anchorLinks = document.querySelectorAll('a[href^="#"]');
if (anchorLinks.length > 0) {
    anchorLinks.forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (!href || href === '#') return; // Skip empty anchors

            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

/**
 * CTA button is now a direct link (no handler needed)
 * Link is set in HTML to Chrome Web Store
 */
