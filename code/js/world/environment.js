// environment.js - Environmental elements (sky, sun, earth) - 2025-03-18

/**
 * Environment class for creating and managing the sky, sun, Earth and other
 * environmental elements in the scene
 */
class Environment {
    /**
     * Create a new environment
     * @param {THREE.Scene} scene - Three.js scene to add elements to
     */
    constructor(scene) {
        this.scene = scene;
        this.skybox = null;
        this.sun = null;
        this.earth = null;
        this.stars = null;
        this.lights = [];
        
        // Initialize the environment
        this.initialize();
    }

    /**
     * Initialize the environment
     */
    initialize() {
        console.log('Initializing environment');
        
        // Create sky
        this.createSky();
        
        // Create stars
        this.createStars();
        
        // Create sun
        this.createSun();
        
        // Create earth
        this.createEarth();
        
        // Add lighting
        this.createLights();
    }

    /**
     * Create the skybox
     */
    createSky() {
        // Create a large sphere for the sky
        const skyGeometry = new THREE.SphereGeometry(1000, 32, 32);
        
        // Invert the geometry so we're looking at the inside
        skyGeometry.scale(-1, 1, 1);
        
        // Create a simple dark blue/black material for space
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: CONSTANTS.SKY_COLOR,
            side: THREE.BackSide
        });
        
        // Create mesh and add to scene
        this.skybox = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(this.skybox);
        
        // Try to load a skybox texture
        Helpers.loadTexture('assets/textures/sky.jpg', (texture) => {
            if (texture) {
                console.log('Sky texture loaded successfully');
                skyMaterial.map = texture;
                skyMaterial.needsUpdate = true;
            }
        });
    }

    /**
     * Create the stars
     */
    createStars() {
        // Create a particle system for stars
        const starCount = 5000;
        const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1,
            transparent: true,
            opacity: 0.8
        });
        
        // Create random positions for stars
        const positions = new Float32Array(starCount * 3);
        
        for (let i = 0; i < starCount; i++) {
            // Random position in sphere
            const radius = 900 + Math.random() * 100; // Between 900 and 1000
            const theta = Math.random() * Math.PI * 2; // 0 to 2π
            const phi = Math.acos(2 * Math.random() - 1); // 0 to π (using cosine distribution)
            
            // Convert to Cartesian coordinates
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.cos(phi);
            positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
        }
        
        // Add the positions to the geometry
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Create the particle system
        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);
    }

    /**
     * Create the sun
     */
    createSun() {
        // Create a sphere for the sun
        const sunGeometry = new THREE.SphereGeometry(50, 32, 32);
        
        // Create a bright material for the sun
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: CONSTANTS.SUN_COLOR
        });
        
        // Create mesh
        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        
        // Position the sun far away but visible
        this.sun.position.set(800, 100, -200);
        
        // Add to scene
        this.scene.add(this.sun);
        
        // Add a glow effect
        this.addSunGlow();
    }

    /**
     * Add a glow effect to the sun
     */
    addSunGlow() {
        // Create a sprite for the glow
        const spriteMaterial = new THREE.SpriteMaterial({
            map: this.createGlowTexture(),
            color: 0xffee88,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(150, 150, 1);
        this.sun.add(sprite);
    }

    /**
     * Create a glow texture for the sun
     * @returns {THREE.Texture} - Glow texture
     */
    createGlowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Create radial gradient
        const gradient = ctx.createRadialGradient(
            32, 32, 0,    // inner circle
            32, 32, 32    // outer circle
        );
        gradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 150, 0.8)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        // Fill with gradient
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    /**
     * Create Earth
     */
    createEarth() {
        // Create a sphere for the Earth
        const earthGeometry = new THREE.SphereGeometry(15, 32, 32);
        
        // Create material
        const earthMaterial = new THREE.MeshStandardMaterial({
            color: CONSTANTS.EARTH_COLOR,
            roughness: 0.8,
            metalness: 0.1
        });
        
        // Create mesh
        this.earth = new THREE.Mesh(earthGeometry, earthMaterial);
        
        // Position Earth opposite to the sun
        this.earth.position.set(-500, 100, 200);
        
        // Add to scene
        this.scene.add(this.earth);
        
        // Try to load Earth texture
        Helpers.loadTexture('assets/textures/earth.jpg', (texture) => {
            if (texture) {
                console.log('Earth texture loaded successfully');
                earthMaterial.map = texture;
                earthMaterial.needsUpdate = true;
            }
        });
    }

    /**
     * Create lighting for the scene
     */
    createLights() {
        // Ambient light (space ambient)
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        this.lights.push(ambientLight);
        
        // Directional light from the sun
        const sunLight = new THREE.DirectionalLight(0xffffcc, 1.2);
        sunLight.position.copy(this.sun.position);
        this.scene.add(sunLight);
        this.lights.push(sunLight);
        
        // Hemisphere light (simulates atmospheric scattering)
        const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.3);
        this.scene.add(hemiLight);
        this.lights.push(hemiLight);
    }

    /**
     * Update the environment (called once per frame)
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        // Rotate stars slightly for a subtle twinkling effect
        if (this.stars) {
            this.stars.rotation.y += 0.00005 * deltaTime;
        }
        
        // Optional: Slowly update sun and Earth positions to create a day/night cycle
        // this.updateDayNightCycle(deltaTime);
    }

    /**
     * Update day/night cycle
     * @param {number} deltaTime - Time since last frame in seconds
     */
    updateDayNightCycle(deltaTime) {
        // This is just a basic implementation
        const cycleSpeed = 0.02 * deltaTime;
        
        // Rotate sun and Earth around the scene center
        if (this.sun) {
            this.sun.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), cycleSpeed);
        }
        
        if (this.earth) {
            this.earth.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), cycleSpeed);
        }
        
        // Update directional light position
        if (this.lights[1]) {
            this.lights[1].position.copy(this.sun.position);
        }
    }
}

// Export as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Environment;
} 