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
        
        // Fixed positions for celestial objects to ensure consistency across all clients
        this.celestialPositions = {
            // Fixed position for the sun (x, y, z)
            sun: new THREE.Vector3(800, 100, -200),
            
            // Fixed position for the earth (x, y, z)
            earth: new THREE.Vector3(-500, 100, 200)
        };
        
        // Initialize the environment
        this.initialize();
    }

    /**
     * Initialize the environment
     */
    initialize() {
        console.log('Initializing environment with fixed celestial positions');
        
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
        
        // Change from black to a dusky blue color for space
        const dusky_blue = new THREE.Color(0x232846); // Dark dusky blue
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: dusky_blue,
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
                
                // Apply a blue tint to the texture
                skyMaterial.color = dusky_blue;
                skyMaterial.needsUpdate = true;
            }
        });
    }

    /**
     * Create the stars
     */
    createStars() {
        // Create a particle system for stars
        const starCount = 8000; // Increased star count
        const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.2, // Slightly larger stars
            transparent: true,
            opacity: 0.9 // More visible
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
        const sunGeometry = new THREE.SphereGeometry(60, 32, 32); // Slightly larger sun
        
        // Create a bright material for the sun
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: CONSTANTS.SUN_COLOR,
            emissive: new THREE.Color(0xffee88),
            emissiveIntensity: 1.2
        });
        
        // Create mesh
        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        
        // Position the sun at its fixed position for consistency across clients
        this.sun.position.copy(this.celestialPositions.sun);
        
        // Add to scene
        this.scene.add(this.sun);
        
        // Add an enhanced glow effect
        this.addSunGlow();
        
        // Add a point light at the sun's position for extra illumination
        const sunPointLight = new THREE.PointLight(0xffffcc, 2.0, 2000);
        sunPointLight.position.copy(this.sun.position);
        this.scene.add(sunPointLight);
        
        console.log('Sun created at fixed position:', this.celestialPositions.sun);
    }

    /**
     * Add a glow effect to the sun
     */
    addSunGlow() {
        // Create a larger sprite for the glow
        const spriteMaterial = new THREE.SpriteMaterial({
            map: this.createGlowTexture(),
            color: 0xffee88,
            transparent: true,
            blending: THREE.AdditiveBlending,
            opacity: 0.8
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(220, 220, 1); // Larger glow
        this.sun.add(sprite);
        
        // Add a second glow layer for more intensity
        const innerGlowMaterial = new THREE.SpriteMaterial({
            map: this.createGlowTexture(),
            color: 0xffffff,
            transparent: true,
            blending: THREE.AdditiveBlending,
            opacity: 0.6
        });
        
        const innerGlow = new THREE.Sprite(innerGlowMaterial);
        innerGlow.scale.set(120, 120, 1);
        this.sun.add(innerGlow);
    }

    /**
     * Create a glow texture for the sun
     * @returns {THREE.Texture} - Glow texture
     */
    createGlowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128; // Larger texture for better quality
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Create radial gradient
        const gradient = ctx.createRadialGradient(
            64, 64, 0,    // inner circle
            64, 64, 64    // outer circle
        );
        gradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 150, 0.8)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        // Fill with gradient
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        
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
        
        // Position Earth at its fixed position for consistency across clients
        this.earth.position.copy(this.celestialPositions.earth);
        
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
        
        console.log('Earth created at fixed position:', this.celestialPositions.earth);
    }

    /**
     * Create lights
     */
    createLights() {
        // Main directional light (Sun)
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2); // Increased intensity
        this.sunLight.position.set(100, 50, 50); // Sun position
        this.sunLight.castShadow = true;
        
        // Improve shadow quality
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.bias = -0.0003;
        
        this.scene.add(this.sunLight);
        
        // Add ambient light to prevent completely dark areas - increased intensity
        this.ambientLight = new THREE.AmbientLight(0x664444, 0.6); // Increased reddish ambient light for Mars
        this.scene.add(this.ambientLight);
        
        // Add a stronger secondary light to represent light reflection from distant objects
        this.secondaryLight = new THREE.DirectionalLight(0x7777bb, 0.4); // Stronger bluish tint
        this.secondaryLight.position.set(-100, -50, -50); // Opposite side from sun
        this.scene.add(this.secondaryLight);
        
        // Add a hemisphere light for better environment simulation
        this.hemisphereLight = new THREE.HemisphereLight(
            0x334466, // Sky color - bluer for space
            0x773322, // Ground color - reddish for Mars surface
            0.5        // Increased intensity
        );
        this.scene.add(this.hemisphereLight);
    }

    /**
     * Update the environment
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        // Update environment elements here if needed
        // For example, day/night cycle, dust storms, etc.
        
        // Slowly rotate the secondary light to simulate changing ambient light conditions
        if (this.secondaryLight) {
            this.secondaryLight.position.applyAxisAngle(
                new THREE.Vector3(0, 1, 0), 
                0.05 * deltaTime
            );
        }
    }
}

// Export as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Environment;
} 