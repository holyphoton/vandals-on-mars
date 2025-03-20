// globe.js - Mars globe rendering and management - 2025-03-18

/**
 * MarsGlobe class for creating and managing the Mars sphere
 */
class MarsGlobe {
    /**
     * Create a new Mars globe
     * @param {number} radius - Radius of the globe
     * @param {THREE.Scene} scene - Three.js scene to add the globe to
     */
    constructor(radius, scene) {
        this.radius = radius;
        this.scene = scene;
        this.globe = null;
        this.material = null;

        // Create a default texture if none provided
        this.defaultTexture = this.createDefaultTexture();
        
        // Initialize the globe
        this.initialize();
    }

    /**
     * Initialize the Mars globe
     */
    initialize() {
        console.log('Initializing Mars globe with radius:', this.radius);
        
        // Create sphere geometry
        const geometry = new THREE.SphereGeometry(this.radius, 64, 48);
        
        // Create material with default texture for now
        this.material = new THREE.MeshStandardMaterial({
            map: this.defaultTexture,
            bumpMap: this.defaultTexture,
            bumpScale: 0.5,
            roughness: 0.9,
            metalness: 0.1,
            color: CONSTANTS.MARS_COLOR
        });
        
        // Create mesh
        this.globe = new THREE.Mesh(geometry, this.material);
        
        // Add to scene
        this.scene.add(this.globe);
        
        // Load the Mars texture
        this.loadMarsTexture();
    }

    /**
     * Create a default texture for Mars
     * @returns {THREE.Texture} - Default texture
     */
    createDefaultTexture() {
        // Create a canvas for the texture
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Fill with base Mars color
        ctx.fillStyle = '#c1440e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add some noise/texture
        for (let i = 0; i < 10000; i++) {
            const x = Math.floor(Math.random() * canvas.width);
            const y = Math.floor(Math.random() * canvas.height);
            const size = Math.random() * 3 + 1;
            const brightness = Math.random() * 0.2 - 0.1; // -0.1 to 0.1
            
            ctx.fillStyle = brightness > 0 
                ? `rgba(255, 255, 255, ${brightness})` 
                : `rgba(0, 0, 0, ${-brightness})`;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Create a texture from the canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        return texture;
    }

    /**
     * Load the Mars texture from file
     */
    loadMarsTexture() {
        // Use the helper to load the texture
        Helpers.loadTexture('assets/textures/mars.jpg', (texture) => {
            if (texture) {
                console.log('Mars texture loaded successfully');
                
                // Update the material with the loaded texture
                this.material.map = texture;
                this.material.needsUpdate = true;
                
                // Try to load a bump map for more detail
                Helpers.loadTexture('assets/textures/mars-bump.jpg', (bumpMap) => {
                    if (bumpMap) {
                        this.material.bumpMap = bumpMap;
                        this.material.bumpScale = 0.5;
                        this.material.needsUpdate = true;
                    }
                });
            } else {
                console.warn('Failed to load Mars texture, using default');
                // Keep using the default texture
            }
        });
    }

    /**
     * Add a crater to the Mars surface
     * @param {Object} position - {phi, theta} position in spherical coordinates
     * @param {number} size - Size of the crater (radius)
     */
    addCrater(position, size) {
        // Convert spherical to Cartesian coordinates
        const cartesian = MathUtils.sphericalToCartesian(
            this.radius + 0.01, // Slightly above surface to prevent z-fighting
            position.theta,
            position.phi
        );
        
        // Create crater geometry
        const craterGeometry = new THREE.CircleGeometry(size, 32);
        
        // Create crater material
        const craterMaterial = new THREE.MeshStandardMaterial({
            color: 0x999999,
            roughness: 1.0,
            metalness: 0.0,
            side: THREE.DoubleSide
        });
        
        // Create crater mesh
        const crater = new THREE.Mesh(craterGeometry, craterMaterial);
        
        // Position the crater on the globe surface
        crater.position.set(cartesian.x, cartesian.y, cartesian.z);
        
        // Orient the crater to face outward from the center
        crater.lookAt(0, 0, 0);
        
        // Add to scene
        this.scene.add(crater);
        
        return crater;
    }

    /**
     * Add a rock to the Mars surface
     * @param {Object} position - {phi, theta} position in spherical coordinates
     * @param {number} size - Size of the rock
     */
    addRock(position, size) {
        // Convert spherical to Cartesian coordinates
        const cartesian = MathUtils.sphericalToCartesian(
            this.radius,
            position.theta,
            position.phi
        );
        
        // Create rock geometry (simplified as an icosahedron)
        const rockGeometry = new THREE.IcosahedronGeometry(size, 0);
        
        // Create rock material
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0xa86032,
            roughness: 0.9,
            metalness: 0.1
        });
        
        // Create rock mesh
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        
        // Position the rock on the globe surface
        rock.position.set(cartesian.x, cartesian.y, cartesian.z);
        
        // Orient the rock to face outward from the center
        const normal = new THREE.Vector3(cartesian.x, cartesian.y, cartesian.z).normalize();
        rock.lookAt(rock.position.clone().add(normal));
        
        // Add some random rotation
        rock.rotation.x += Math.random() * Math.PI;
        rock.rotation.y += Math.random() * Math.PI;
        rock.rotation.z += Math.random() * Math.PI;
        
        // Add to scene
        this.scene.add(rock);
        
        return rock;
    }

    /**
     * Generate random terrain features (craters, rocks) across the Mars surface
     * @param {number} craterCount - Number of craters to add
     * @param {number} rockCount - Number of rocks to add
     */
    generateTerrain(craterCount = 50, rockCount = 200) {
        console.log(`Generating terrain: ${craterCount} craters, ${rockCount} rocks`);
        
        // Add craters
        for (let i = 0; i < craterCount; i++) {
            const position = MathUtils.randomSpherePoint(this.radius);
            const size = Math.random() * 5 + 1; // 1-6 units
            this.addCrater(position, size);
        }
        
        // Add rocks
        for (let i = 0; i < rockCount; i++) {
            const position = MathUtils.randomSpherePoint(this.radius);
            const size = Math.random() * 2 + 0.5; // 0.5-2.5 units
            this.addRock(position, size);
        }
    }

    /**
     * Update the globe (called once per frame)
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        // Rotate the globe very slowly (optional)
        // this.globe.rotation.y += 0.001 * deltaTime;
    }

    /**
     * Get the height of the terrain at the given position
     * @param {THREE.Vector3} position - Position to check
     * @returns {number} - Height at the position
     */
    getHeightAt(position) {
        // Simplified implementation - just return the radius for now
        // In a more complex implementation, this would check for terrain features
        return this.radius;
    }

    /**
     * Convert a point from world space to globe space (spherical coordinates)
     * @param {THREE.Vector3} point - Point in world space
     * @returns {Object} - {phi, theta, radius} in spherical coordinates
     */
    worldToGlobe(point) {
        // Ensure the point is relative to globe center
        const localPoint = point.clone().sub(this.globe.position);
        
        // Convert to spherical coordinates
        return MathUtils.cartesianToSpherical(localPoint.x, localPoint.y, localPoint.z);
    }

    /**
     * Convert a point from globe space (spherical coordinates) to world space
     * @param {number} phi - Latitude
     * @param {number} theta - Longitude
     * @param {number} radius - Distance from center (optional, defaults to globe radius)
     * @returns {THREE.Vector3} - Point in world space
     */
    globeToWorld(phi, theta, radius = this.radius) {
        const cart = MathUtils.sphericalToCartesian(radius, theta, phi);
        return new THREE.Vector3(cart.x, cart.y, cart.z).add(this.globe.position);
    }

    /**
     * Get the globe material
     * @returns {THREE.Material} - The globe's material
     */
    getMaterial() {
        // Return the main globe material for other objects to reference
        if (this.globe && this.globe.material) {
            return this.globe.material;
        }
        
        // Fallback material if globe isn't created yet
        return new THREE.MeshStandardMaterial({
            color: CONSTANTS.MARS_COLOR,
            roughness: 0.8,
            metalness: 0.1
        });
    }
}

// Export as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarsGlobe;
} 