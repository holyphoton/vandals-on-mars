// terrain.js - Terrain generation (craters, rocks) - 2025-03-18

/**
 * Terrain class for generating and managing terrain features on the Mars globe
 */
class Terrain {
    /**
     * Create a new terrain generator
     * @param {MarsGlobe} globe - Reference to the Mars globe
     * @param {THREE.Scene} scene - Three.js scene
     */
    constructor(globe, scene) {
        this.globe = globe;
        this.scene = scene;
        this.features = {
            craters: [],
            rocks: [],
            mountains: []
        };
        
        // Initialize the terrain
        this.initialize();
    }

    /**
     * Initialize the terrain
     */
    initialize() {
        console.log('Initializing terrain');
    }

    /**
     * Generate craters across the globe surface
     * @param {number} count - Number of craters to generate
     * @param {Object} options - Options for crater generation
     */
    generateCraters(count = 50, options = {}) {
        console.log(`Generating ${count} craters`);
        
        const defaultOptions = {
            minSize: 1,
            maxSize: 6,
            depth: 0.3,
            distribution: 'random' // 'random', 'clustered'
        };
        
        const opts = { ...defaultOptions, ...options };
        
        // Clear existing craters if requested
        if (options.clear) {
            this.clearFeatures('craters');
        }
        
        // Generate craters based on distribution
        if (opts.distribution === 'clustered') {
            this.generateClusteredFeatures('craters', count, opts);
        } else {
            // Random distribution
            for (let i = 0; i < count; i++) {
                const position = MathUtils.randomSpherePoint(this.globe.radius);
                const size = opts.minSize + Math.random() * (opts.maxSize - opts.minSize);
                
                const crater = this.createCrater(position, size, opts.depth);
                this.features.craters.push(crater);
            }
        }
    }

    /**
     * Create a single crater
     * @param {Object} position - {phi, theta} position
     * @param {number} size - Size (radius) of the crater
     * @param {number} depth - Depth of the crater
     * @returns {THREE.Object3D} - The created crater object
     */
    createCrater(position, size, depth) {
        // Convert spherical coordinates to cartesian
        const cartesian = MathUtils.sphericalToCartesian(
            this.globe.radius + 0.01, // Slightly above surface
            position.theta,
            position.phi
        );
        
        // Create a group to hold crater parts
        const craterGroup = new THREE.Group();
        
        // Create the main crater (circle)
        const craterGeometry = new THREE.CircleGeometry(size, 32);
        const craterMaterial = new THREE.MeshStandardMaterial({
            color: 0x999999,
            roughness: 1.0,
            metalness: 0.0,
            side: THREE.DoubleSide
        });
        
        const craterMesh = new THREE.Mesh(craterGeometry, craterMaterial);
        
        // Create a rim (ring)
        const rimGeometry = new THREE.RingGeometry(size, size * 1.2, 32);
        const rimMaterial = new THREE.MeshStandardMaterial({
            color: 0xb86d45, // Slightly different color from Mars
            roughness: 0.7,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        
        const rimMesh = new THREE.Mesh(rimGeometry, rimMaterial);
        
        // Position both in the crater group
        craterGroup.add(craterMesh);
        craterGroup.add(rimMesh);
        
        // Position at the calculated position
        craterGroup.position.set(cartesian.x, cartesian.y, cartesian.z);
        
        // Orient to face outward from center
        craterGroup.lookAt(0, 0, 0);
        
        // Add to scene
        this.scene.add(craterGroup);
        
        return craterGroup;
    }

    /**
     * Generate rocks across the globe surface
     * @param {number} count - Number of rocks to generate
     * @param {Object} options - Options for rock generation
     */
    generateRocks(count = 200, options = {}) {
        console.log(`Generating ${count} rocks`);
        
        const defaultOptions = {
            minSize: 0.5,
            maxSize: 2.5,
            distribution: 'random' // 'random', 'clustered'
        };
        
        const opts = { ...defaultOptions, ...options };
        
        // Clear existing rocks if requested
        if (options.clear) {
            this.clearFeatures('rocks');
        }
        
        // Generate rocks based on distribution
        if (opts.distribution === 'clustered') {
            this.generateClusteredFeatures('rocks', count, opts);
        } else {
            // Random distribution
            for (let i = 0; i < count; i++) {
                const position = MathUtils.randomSpherePoint(this.globe.radius);
                const size = opts.minSize + Math.random() * (opts.maxSize - opts.minSize);
                
                const rock = this.createRock(position, size);
                this.features.rocks.push(rock);
            }
        }
    }

    /**
     * Create a single rock
     * @param {Object} position - {phi, theta} position
     * @param {number} size - Size of the rock
     * @returns {THREE.Object3D} - The created rock object
     */
    createRock(position, size) {
        // Convert spherical coordinates to cartesian
        const cartesian = MathUtils.sphericalToCartesian(
            this.globe.radius,
            position.theta,
            position.phi
        );
        
        // Choose a random rock type
        const rockType = Math.floor(Math.random() * 3);
        let rockGeometry;
        
        switch (rockType) {
            case 0:
                rockGeometry = new THREE.IcosahedronGeometry(size, 0); // Angular rock
                break;
            case 1:
                rockGeometry = new THREE.TetrahedronGeometry(size); // Pointy rock
                break;
            case 2:
            default:
                rockGeometry = new THREE.DodecahedronGeometry(size, 0); // Rounder rock
                break;
        }
        
        // Create rock material with slight color variation
        const hue = 0.05 + Math.random() * 0.05; // Reddish-brown
        const saturation = 0.6 + Math.random() * 0.2;
        const lightness = 0.2 + Math.random() * 0.2;
        
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(hue, saturation, lightness),
            roughness: 0.8 + Math.random() * 0.2,
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
     * Generate clustered features (craters or rocks)
     * @param {string} featureType - Type of feature ('craters' or 'rocks')
     * @param {number} count - Number of features to generate
     * @param {Object} options - Generation options
     */
    generateClusteredFeatures(featureType, count, options) {
        // Generate cluster centers
        const clusterCount = Math.floor(count / 10) + 1; // ~10 features per cluster
        const clusters = [];
        
        for (let i = 0; i < clusterCount; i++) {
            clusters.push(MathUtils.randomSpherePoint(this.globe.radius));
        }
        
        // Generate features around cluster centers
        for (let i = 0; i < count; i++) {
            // Select a random cluster
            const cluster = clusters[Math.floor(Math.random() * clusters.length)];
            
            // Generate a position near the cluster center
            const deviation = 0.2 + Math.random() * 0.3; // 0.2-0.5 radians from center
            const randAngle = Math.random() * Math.PI * 2;
            
            // Move from cluster center
            const newPosition = MathUtils.moveOnSphere(
                cluster.phi,
                cluster.theta,
                randAngle,
                deviation * this.globe.radius,
                this.globe.radius
            );
            
            // Create the feature
            const size = options.minSize + Math.random() * (options.maxSize - options.minSize);
            let feature;
            
            if (featureType === 'craters') {
                feature = this.createCrater(newPosition, size, options.depth);
                this.features.craters.push(feature);
            } else { // rocks
                feature = this.createRock(newPosition, size);
                this.features.rocks.push(feature);
            }
        }
    }

    /**
     * Clear all features of a specific type
     * @param {string} featureType - Type of feature to clear ('craters', 'rocks', 'mountains')
     */
    clearFeatures(featureType) {
        if (!this.features[featureType]) return;
        
        // Remove each feature from the scene
        this.features[featureType].forEach(feature => {
            this.scene.remove(feature);
            
            // Dispose of geometries and materials
            if (feature.geometry) feature.geometry.dispose();
            if (feature.material) {
                if (Array.isArray(feature.material)) {
                    feature.material.forEach(mat => mat.dispose());
                } else {
                    feature.material.dispose();
                }
            }
        });
        
        // Clear the array
        this.features[featureType] = [];
    }

    /**
     * Generate all terrain features
     * @param {Object} options - Options for terrain generation
     */
    generateAll(options = {}) {
        const defaultOptions = {
            craterCount: 50,
            rockCount: 200,
            craterOptions: {},
            rockOptions: {}
        };
        
        const opts = { ...defaultOptions, ...options };
        
        // Generate all features
        this.generateCraters(opts.craterCount, opts.craterOptions);
        this.generateRocks(opts.rockCount, opts.rockOptions);
    }

    /**
     * Get nearest terrain feature to a position
     * @param {Object} position - {phi, theta} position in spherical coordinates
     * @param {string} featureType - Type of feature to find ('craters', 'rocks', or null for all)
     * @returns {Object} - Nearest feature and its distance
     */
    getNearestFeature(position, featureType = null) {
        let nearest = null;
        let minDistance = Infinity;
        
        // Function to check features of a specific type
        const checkFeatures = (type) => {
            if (!this.features[type]) return;
            
            this.features[type].forEach(feature => {
                // Get feature position in spherical coordinates
                const featurePos = this.globe.worldToGlobe(feature.position);
                
                // Calculate distance on sphere surface
                const distance = MathUtils.sphereDistance(
                    position.phi, position.theta,
                    featurePos.phi, featurePos.theta,
                    this.globe.radius
                );
                
                // Update nearest if closer
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = {
                        feature: feature,
                        type: type,
                        distance: distance
                    };
                }
            });
        };
        
        // Check specific type or all types
        if (featureType) {
            checkFeatures(featureType);
        } else {
            for (const type in this.features) {
                checkFeatures(type);
            }
        }
        
        return nearest;
    }
}

// Export as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Terrain;
} 