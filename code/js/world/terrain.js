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
            this.globe.radius, // Directly on the surface
            position.theta,
            position.phi
        );
        
        // Create a group to hold crater parts
        const craterGroup = new THREE.Group();
        
        // Get the Mars surface material properties to match textures
        const globeMaterial = this.globe.getMaterial();
        
        // Create crater geometry - use a disc with slight depression
        const segments = Math.max(32, Math.floor(size * 12)); // More segments for smoother appearance
        const craterGeometry = new THREE.CircleGeometry(size, segments);
        
        // Create crater material that matches Mars surface but darker
        const craterMaterial = new THREE.MeshStandardMaterial({
            map: globeMaterial.map, // Use the same texture map as the globe
            bumpMap: globeMaterial.bumpMap, // Use the same bump map
            bumpScale: globeMaterial.bumpScale * 1.5, // Enhanced bump for more detail
            color: new THREE.Color(0x662222), // Darker reddish color for crater interior
            roughness: 0.95,
            metalness: 0.05,
            side: THREE.DoubleSide
        });
        
        // If we have normal maps, use those too
        if (globeMaterial.normalMap) {
            craterMaterial.normalMap = globeMaterial.normalMap;
            craterMaterial.normalScale = new THREE.Vector2(1.5, 1.5); // Enhanced normal for more detail
        }
        
        const craterMesh = new THREE.Mesh(craterGeometry, craterMaterial);
        
        // Create depression by displacing vertices
        const vLength = craterGeometry.attributes.position.count;
        const positions = craterGeometry.attributes.position.array;
        
        for (let i = 0; i < vLength; i++) {
            const i3 = i * 3;
            const x = positions[i3];
            const y = positions[i3 + 1];
            const z = positions[i3 + 2];
            
            // Calculate distance from center normalized by size
            const distance = Math.sqrt(x*x + y*y) / size;
            
            // Parabolic depression profile - deeper in middle, gradually rising to edges
            let depression = depth * (1 - Math.pow(distance, 2)); 
            
            // Apply depression
            positions[i3 + 2] -= depression;
        }
        
        // Update the geometry
        craterGeometry.attributes.position.needsUpdate = true;
        craterGeometry.computeVertexNormals();
        
        // Add the crater mesh to the group
        craterGroup.add(craterMesh);
        
        // Instead of a zigzag ring geometry, create a smooth crater rim effect
        // using a circular geometry with a gradient material
        const rimOuterRadius = size * 1.2;
        const rimGeometry = new THREE.CircleGeometry(rimOuterRadius, segments);
        
        // Create a smooth rim material that blends with the surface
        const rimMaterial = new THREE.MeshStandardMaterial({
            map: globeMaterial.map,
            color: new THREE.Color(0x9a4c35), // Slightly different color for rim
            roughness: 0.85,
            metalness: 0.1,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            alphaMap: createCraterRimGradient(rimOuterRadius, size)
        });
        
        const rimMesh = new THREE.Mesh(rimGeometry, rimMaterial);
        
        // Position rim slightly below the crater to avoid z-fighting
        rimMesh.position.z = -0.05;
        
        // Add the rim to the group
        craterGroup.add(rimMesh);
        
        // Position the crater group on the surface
        craterGroup.position.set(cartesian.x, cartesian.y, cartesian.z);
        
        // Orient to face outward from center
        const normal = new THREE.Vector3(cartesian.x, cartesian.y, cartesian.z).normalize();
        craterGroup.lookAt(craterGroup.position.clone().add(normal));
        
        // Add to scene
        this.scene.add(craterGroup);
        
        // Store data for collision detection
        craterGroup.userData = {
            type: 'crater',
            position: {
                phi: position.phi,
                theta: position.theta
            },
            size: size,
            collider: {
                radius: size * 1.2 // Collision radius
            }
        };
        
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
        
        // Use a sphere as the base shape for all rocks to ensure solidity
        const rockGeometry = new THREE.SphereGeometry(size * 0.8, 16, 16);
        
        // Create rock material with slight color variation
        const hue = 0.05 + Math.random() * 0.05; // Reddish-brown
        const saturation = 0.6 + Math.random() * 0.2;
        const lightness = 0.2 + Math.random() * 0.2;
        
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(hue, saturation, lightness),
            roughness: 0.9 + Math.random() * 0.1,
            metalness: 0.1,
            flatShading: true // Keep flat shading for rugged appearance
        });
        
        // Noise function for consistent displacement
        const noise = (x, y, z, scale = 1) => {
            // Simple coherent noise function
            return Math.sin(x * 7.5 * scale) * Math.cos(y * 9.5 * scale) * Math.sin(z * 5.5 * scale);
        };
        
        // Deform the sphere into an irregular rock shape
        const vertices = rockGeometry.attributes.position;
        const vertex = new THREE.Vector3();
        
        // Apply displacement to vertices
        for (let i = 0; i < vertices.count; i++) {
            vertex.fromBufferAttribute(vertices, i);
            
            // Get current direction from center
            const nx = vertex.x;
            const ny = vertex.y;
            const nz = vertex.z;
            
            // Get current length (distance from center)
            const length = vertex.length();
            
            // Generate coherent noise based on vertex position
            const noiseValue = noise(nx, ny, nz, 0.7) * 0.3 + 0.7;
            
            // Scale vertex by noise value
            const scale = 1 + (noiseValue * 0.5); // Limit displacement to avoid holes
            vertex.multiplyScalar(scale);
            
            // Set the modified position
            vertices.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        
        // Update geometry after modifications
        vertices.needsUpdate = true;
        rockGeometry.computeVertexNormals();
        
        // Add noise detail bumps to make it more rugged but still solid
        const detailGeometry = new THREE.DodecahedronGeometry(size * 0.85, 1);
        const detailVertices = detailGeometry.attributes.position;
        const detailVertex = new THREE.Vector3();
        
        // Apply different noise pattern to detail geometry
        for (let i = 0; i < detailVertices.count; i++) {
            detailVertex.fromBufferAttribute(detailVertices, i);
            
            // Get normalized direction
            const nx = detailVertex.x;
            const ny = detailVertex.y;
            const nz = detailVertex.z;
            
            // Different noise pattern for details
            const noiseValue = noise(nx * 2, ny * 2, nz * 2, 1.5) * 0.2 + 0.8;
            
            // Scale vertex 
            detailVertex.multiplyScalar(noiseValue);
            
            // Set modified position
            detailVertices.setXYZ(i, detailVertex.x, detailVertex.y, detailVertex.z);
        }
        
        // Update detail geometry
        detailVertices.needsUpdate = true;
        detailGeometry.computeVertexNormals();
        
        // Create meshes
        const rockMesh = new THREE.Mesh(rockGeometry, rockMaterial);
        const detailMesh = new THREE.Mesh(detailGeometry, rockMaterial.clone());
        
        // Create a group to hold both meshes
        const rockGroup = new THREE.Group();
        rockGroup.add(rockMesh);
        rockGroup.add(detailMesh);
        
        // Position the rock on the surface
        rockGroup.position.set(cartesian.x, cartesian.y, cartesian.z);
        
        // Orient to face outward from center
        const normal = new THREE.Vector3(cartesian.x, cartesian.y, cartesian.z).normalize();
        rockGroup.lookAt(rockGroup.position.clone().add(normal));
        
        // Add random rotation for variety
        rockGroup.rotation.x += Math.random() * Math.PI / 6;
        rockGroup.rotation.y += Math.random() * Math.PI / 6;
        rockGroup.rotation.z += Math.random() * Math.PI / 6;
        
        // Add to scene
        this.scene.add(rockGroup);
        
        // Store data for collision detection
        rockGroup.userData = {
            type: 'rock',
            position: {
                phi: position.phi,
                theta: position.theta
            },
            size: size,
            collider: {
                radius: size * 1.2 // Slightly larger collision radius
            }
        };
        
        return rockGroup;
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
        
        console.log('Generating terrain with non-overlapping features');
        
        // Tracking placed features to prevent overlap
        const placedFeatures = [];
        
        // Generate craters first (they're larger features)
        console.log(`Generating ${opts.craterCount} craters`);
        let successfulCraters = 0;
        let attempts = 0;
        const maxAttempts = opts.craterCount * 3; // 3 attempts per crater
        
        while (successfulCraters < opts.craterCount && attempts < maxAttempts) {
            attempts++;
            
            // Generate position and size
            const position = MathUtils.randomSpherePoint(this.globe.radius);
            const size = opts.craterOptions.minSize || 1 + 
                         Math.random() * ((opts.craterOptions.maxSize || 6) - (opts.craterOptions.minSize || 1));
            
            // Check for overlap with existing features
            if (!this.wouldOverlap(position, size * 1.5, placedFeatures)) {
                const crater = this.createCrater(position, size, opts.craterOptions.depth || 0.3);
                this.features.craters.push(crater);
                
                // Add to placed features
                placedFeatures.push({
                    position: position,
                    radius: size * 1.5,
                    type: 'crater'
                });
                
                successfulCraters++;
            }
        }
        
        // Now generate rocks
        console.log(`Generating ${opts.rockCount} rocks`);
        let successfulRocks = 0;
        attempts = 0;
        const rockMaxAttempts = opts.rockCount * 3; // 3 attempts per rock
        
        while (successfulRocks < opts.rockCount && attempts < rockMaxAttempts) {
            attempts++;
            
            // Generate position and size
            const position = MathUtils.randomSpherePoint(this.globe.radius);
            const size = opts.rockOptions.minSize || 0.5 + 
                         Math.random() * ((opts.rockOptions.maxSize || 2.5) - (opts.rockOptions.minSize || 0.5));
            
            // Check for overlap with existing features
            if (!this.wouldOverlap(position, size * 1.5, placedFeatures)) {
                const rock = this.createRock(position, size);
                this.features.rocks.push(rock);
                
                // Add to placed features
                placedFeatures.push({
                    position: position,
                    radius: size * 1.5,
                    type: 'rock'
                });
                
                successfulRocks++;
            }
        }
        
        console.log(`Successfully placed ${successfulCraters} craters and ${successfulRocks} rocks`);
    }

    /**
     * Check if a new feature would overlap with existing features
     * @param {Object} position - Position of the new feature {phi, theta}
     * @param {number} radius - Radius of the new feature plus buffer
     * @param {Array} existingFeatures - List of existing features
     * @returns {boolean} - True if the feature would overlap
     */
    wouldOverlap(position, radius, existingFeatures) {
        for (const feature of existingFeatures) {
            const distance = MathUtils.sphereDistance(
                position.phi, position.theta,
                feature.position.phi, feature.position.theta,
                this.globe.radius
            );
            
            // If distance is less than combined radii, they overlap
            if (distance < radius + feature.radius) {
                return true;
            }
        }
        
        return false;
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

    /**
     * Check if a position collides with any terrain features
     * @param {Object} position - Position to check {x, y, z}
     * @param {number} radius - Radius around position to check for collisions
     * @returns {Object|null} - Colliding feature or null if no collision
     */
    checkCollision(position, radius = 1) {
        // Normalize the position to get direction from center
        const direction = new THREE.Vector3(position.x, position.y, position.z).normalize();
        
        // Get spherical coordinates to check distance on sphere surface
        const sphericalPos = {
            phi: Math.acos(direction.y),
            theta: Math.atan2(direction.z, direction.x)
        };
        
        // Check collisions with rocks
        for (const rock of this.features.rocks) {
            if (!rock.userData || !rock.userData.collider) continue;
            
            // Use the actual world position of the rock instead of stored spherical coords
            const rockPos = rock.position.clone();
            const rockDirection = rockPos.clone().normalize();
            const rockSpherical = {
                phi: Math.acos(rockDirection.y),
                theta: Math.atan2(rockDirection.z, rockDirection.x)
            };
            
            // Calculate distance on sphere surface using the actual positions
            const distance = MathUtils.sphereDistance(
                sphericalPos.phi, sphericalPos.theta,
                rockSpherical.phi, rockSpherical.theta,
                this.globe.radius
            );
            
            // Use a slightly smaller collision radius to better match visual size
            const collisionRadius = rock.userData.collider.radius * 0.9;
            
            // Check if distance is less than combined radii
            if (distance < radius + collisionRadius) {
                return { 
                    feature: {
                        position: rockPos,  // Use actual position for collision response
                        userData: rock.userData
                    }, 
                    type: 'rock',
                    distance: distance
                };
            }
        }
        
        // No collision found
        return null;
    }
}

// Export as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Terrain;
}

// Helper function to create a smooth gradient for crater rims
function createCraterRimGradient(outerRadius, innerRadius) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Create a radial gradient from inner to outer radius
    const gradient = ctx.createRadialGradient(
        128, 128, innerRadius * (canvas.width / (outerRadius * 2)),
        128, 128, outerRadius * (canvas.width / (outerRadius * 2))
    );
    
    // Smooth transition from transparent inside to solid at edge
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); // Inner edge (crater boundary) - transparent
    gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.2)'); // Start faint elevation
    gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.7)'); // Higher elevation
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Outer edge fades to terrain
    
    // Fill with gradient
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
} 