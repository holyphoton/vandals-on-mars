// guns.js - Weapon system implementation - 2025-03-20

/**
 * Base Gun class - Abstract parent for all weapon types
 */
class Gun {
    /**
     * Base class for all guns
     * @param {THREE.Scene} scene - The scene to add the gun to
     * @param {PlayerCamera} playerCamera - The player's camera
     * @param {Object} options - Optional settings
     */
    constructor(scene, playerCamera, options = {}) {
        this.scene = scene;
        this.playerCamera = playerCamera;
        this.options = options;
        this.ammo = options.ammo || 30;
        this.maxAmmo = options.maxAmmo || 100;
        this.fireRate = options.fireRate || 0.2; // seconds between shots
        this.lastFired = 0;
        this.gunModel = null;
    }
    
    /**
     * Creates a gun model (to be implemented by subclasses)
     */
    createGunModel() {
        // Base implementation - create a default gun model
        this.gunModel = new THREE.Group();
        
        // Create a simple box as a placeholder
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.3);
        const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const box = new THREE.Mesh(geometry, material);
        this.gunModel.add(box);
        
        // Position the gun at the bottom right of the screen
        this.gunModel.position.set(0.2, -0.15, -0.4);
    }
    
    /**
     * Adds the gun model to the scene - attaching it to the camera
     */
    addToScene() {
        if (this.gunModel) {
            // Make sure we remove it first in case it was already added
            if (this.gunModel.parent) {
                this.gunModel.parent.remove(this.gunModel);
            }
            
            // Add the gun model to the camera
            this.playerCamera.camera.add(this.gunModel);
            
            // Set the visibility based on whether it's the active weapon
            this.gunModel.visible = true;
            
            console.log("Gun model added to camera:", this.constructor.name);
        } else {
            console.error("Gun model not created before adding to scene");
        }
    }
    
    /**
     * Fire the gun - to be implemented by subclasses
     */
    fire() {
        const now = Date.now();
        if (now - this.lastFired < this.fireRate) {
            return false;
        }
        
        this.lastFired = now;
        
        // Play sound if implemented
        this.playSound();
        
        return true;
    }
    
    /**
     * Play sound effect - to be implemented by subclasses
     */
    playSound() {
        // Default empty implementation
    }
    
    /**
     * Get camera direction as a normalized vector
     * @returns {Vector3} Direction vector
     */
    getCameraDirection() {
        return new THREE.Vector3(0, 0, -1).applyQuaternion(this.playerCamera.camera.quaternion);
    }
    
    /**
     * Update gun state
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        // Update gun position to follow camera if needed
    }
}

/**
 * BillboardGun class - Places billboards on the Mars globe
 */
class BillboardGun extends Gun {
    /**
     * Creates a billboard placement gun
     * @param {THREE.Scene} scene - The scene to add the gun to
     * @param {PlayerCamera} playerCamera - The player's camera
     * @param {MarsGlobe} globe - The Mars globe for billboard placement
     * @param {Object} options - Optional configuration
     */
    constructor(scene, playerCamera, globe, options = {}) {
        super(scene, playerCamera, options);
        
        this.globe = globe;
        this.ammo = options.ammo || 5; // Number of billboards that can be placed
        this.maxAmmo = options.maxAmmo || 5;
        this.placedBillboards = [];
        
        console.log("BillboardGun initialized with ammo:", this.ammo);
        
        // Create the gun model
        this.createGunModel();
        this.addToScene();
    }
    
    /**
     * Creates a gun model
     */
    createGunModel() {
        // Create a gun model - a simple shape for now
        this.gunModel = new THREE.Group();
        
        // Gun body
        const gunBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.15, 0.3),
            new THREE.MeshStandardMaterial({ color: 0x3366cc })
        );
        gunBody.position.z = -0.1;
        this.gunModel.add(gunBody);
        
        // Billboard projector
        const projector = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.12, 0.2, 8),
            new THREE.MeshStandardMaterial({ color: 0x66ccff })
        );
        projector.rotation.x = Math.PI / 2;
        projector.position.z = -0.25;
        this.gunModel.add(projector);
        
        // Fixed position relative to the screen/camera - positioned to be visible at bottom right
        this.gunModel.position.set(0.3, -0.3, -0.5);
    }
    
    /**
     * Places a billboard at the specified position
     * @param {THREE.Vector3} position - The position to place the billboard
     * @param {THREE.Vector3} cameraPosition - The current camera position for orientation
     */
    placeBillboard(position, cameraPosition) {
        // Create a billboard group that contains sign and legs
        const billboardGroup = new THREE.Group();
        
        // Create a billboard object for tracking
        const billboard = {
            mesh: billboardGroup,
            position: position.clone(),
            health: 100
        };
        
        // Create the sign part of the billboard (the actual display)
        const signGeometry = new THREE.PlaneGeometry(1.5, 1.0); // Width x Height (3:2 aspect ratio)
        const signMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        });
        const signMesh = new THREE.Mesh(signGeometry, signMaterial);
        
        // Position the sign above the ground to account for the taller legs
        signMesh.position.y = 2.0; // Raised higher because legs are taller now
        billboardGroup.add(signMesh);
        
        // Create legs for the billboard - now twice as tall
        const legGeometry = new THREE.CylinderGeometry(0.05, 0.05, 4.0, 8);
        const legMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333 // Dark gray
        });
        
        // Left leg - positioned at lower left corner of sign
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.6, 0, 0); // Wider placement for the 3:2 aspect ratio
        billboardGroup.add(leftLeg);
        
        // Right leg - positioned at lower right corner of sign
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(0.6, 0, 0); // Wider placement for the 3:2 aspect ratio
        billboardGroup.add(rightLeg);
        
        // Set the billboard position
        billboardGroup.position.copy(position);
        
        // Orient the billboard properly on the planet surface
        if (this.globe && this.globe.globe) {
            const globeCenter = this.globe.globe.position.clone();
            
            // SIMPLIFIED ORIENTATION APPROACH:
            // 1. Calculate up vector (normal to surface)
            const upVector = position.clone().sub(globeCenter).normalize();
            
            // 2. Find a forward direction (any perpendicular to up)
            // We'll use world up to help find a stable direction
            const worldUp = new THREE.Vector3(0, 1, 0);
            
            // If upVector is too close to worldUp, use a different reference
            const reference = Math.abs(upVector.dot(worldUp)) > 0.9 
                ? new THREE.Vector3(1, 0, 0) 
                : worldUp;
            
            // 3. Calculate right vector
            const rightVector = new THREE.Vector3().crossVectors(upVector, reference).normalize();
            
            // 4. Calculate the true forward vector
            const forwardVector = new THREE.Vector3().crossVectors(rightVector, upVector).normalize();
            
            // 5. Create the rotation matrix
            const matrix = new THREE.Matrix4().makeBasis(rightVector, upVector, forwardVector);
            billboardGroup.quaternion.setFromRotationMatrix(matrix);
            
            // 6. After setting upright orientation, rotate to face roughly toward camera
            // Get direction toward camera in the plane perpendicular to up
            const toCameraFlat = cameraPosition.clone().sub(position);
            // Remove the component in the up direction
            toCameraFlat.sub(upVector.clone().multiplyScalar(toCameraFlat.dot(upVector)));
            toCameraFlat.normalize();
            
            // Find angle between forward and toCameraFlat
            const currentForward = new THREE.Vector3(0, 0, 1).applyQuaternion(billboardGroup.quaternion);
            // Project onto plane perpendicular to up
            currentForward.sub(upVector.clone().multiplyScalar(currentForward.dot(upVector))).normalize();
            
            // Find rotation angle using dot and cross products
            const dot = currentForward.dot(toCameraFlat);
            const cross = new THREE.Vector3().crossVectors(currentForward, toCameraFlat);
            const angle = Math.atan2(cross.length(), dot) * Math.sign(cross.dot(upVector));
            
            // Rotate around the up vector
            const rotationMatrix = new THREE.Matrix4().makeRotationAxis(upVector, angle);
            billboardGroup.quaternion.premultiply(new THREE.Quaternion().setFromRotationMatrix(rotationMatrix));
        } else {
            // No globe reference, just face the camera
            billboardGroup.lookAt(cameraPosition);
        }
        
        // Add the billboard to the scene
        this.scene.add(billboardGroup);
        
        // Add to tracked billboards
        this.placedBillboards.push(billboard);
        
        return billboard;
    }
    
    /**
     * Updates the gun state
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        // No need to update model position since it's attached to the camera
        // The gun is properly parented to the camera
    }

    /**
     * Fires the gun to place a billboard at the target location
     */
    fire() {
        // Check ammo
        if (this.ammo <= 0) {
            console.log("BillboardGun: Out of ammo!");
            return false;
        }
        
        // Get the camera position and direction
        const cameraPosition = new THREE.Vector3();
        this.playerCamera.camera.getWorldPosition(cameraPosition);
        const direction = this.getCameraDirection();
        
        // First try to use raycasting to find an intersection with the planet
        if (this.globe && this.globe.globe) {
            // Create a raycaster from camera in view direction
            const raycaster = new THREE.Raycaster(cameraPosition, direction);
            const intersects = raycaster.intersectObject(this.globe.globe, true);
            
            // If we found an intersection point with the planet
            if (intersects.length > 0) {
                const intersectionPoint = intersects[0].point;
                this.placeBillboard(intersectionPoint, cameraPosition);
                this.ammo--;
                console.log(`Billboard placed! Ammo remaining: ${this.ammo}/${this.maxAmmo}`);
                return true;
            }
        }
        
        // If raycasting didn't find a hit or globe doesn't exist,
        // place billboard 10 units away and project to surface
        
        // Calculate position 10 units in front of player
        const targetPosition = cameraPosition.clone().add(direction.clone().multiplyScalar(10));
        
        // If we have a globe reference, project to surface
        if (this.globe && this.globe.globe) {
            const globeCenter = this.globe.globe.position.clone();
            const radius = this.globe.radius || 10; // Default radius if not defined
            
            // Get direction from center to target
            const centerToTarget = targetPosition.clone().sub(globeCenter);
            
            // Get distance from center to target
            const distanceToTarget = centerToTarget.length();
            
            // Normalize and scale to radius for surface position
            centerToTarget.normalize();
            const surfacePosition = globeCenter.clone().add(centerToTarget.multiplyScalar(radius));
            
            // Place billboard at this surface position
            this.placeBillboard(surfacePosition, cameraPosition);
        } else {
            // No globe, just place at the target position
            this.placeBillboard(targetPosition, cameraPosition);
        }
        
        // Decrease ammo
        this.ammo--;
        
        console.log(`Billboard placed! Ammo remaining: ${this.ammo}/${this.maxAmmo}`);
        return true;
    }
}

/**
 * ShooterGun class - Fires projectiles that can destroy billboards
 */
class ShooterGun extends Gun {
    /**
     * Creates a new shooter gun
     * @param {THREE.Scene} scene - The scene to add the gun to
     * @param {PlayerCamera} playerCamera - The player's camera
     * @param {Array} billboards - Array of billboards for collision detection
     * @param {Object} options - Optional configuration
     */
    constructor(scene, playerCamera, billboards, options = {}) {
        super(scene, playerCamera, options);

        // Set default options for the shooter gun
        this.options = {
            ammo: 100,
            maxAmmo: 500,
            fireRate: 0.1, // seconds between shots
            bulletSpeed: 20,
            bulletSize: 0.1,
            ...options
        };

        // Ensure billboards is an array, use direct reference to maintain updates
        this.billboards = billboards || [];
        console.log("ShooterGun initialized with billboards array:", this.billboards);
        
        this.bullets = [];
        this.lastFired = 0;
        this.isFiring = false;
        this.ammo = this.options.ammo; // Set initial ammo
        this.maxAmmo = this.options.maxAmmo;
        this.fireRate = this.options.fireRate * 1000; // Convert seconds to milliseconds
        
        // Create the gun model
        this.createGunModel();
        this.addToScene();
    }

    /**
     * Creates a gun model
     */
    createGunModel() {
        // Create a gun model
        this.gunModel = new THREE.Group();
        
        // Gun body
        const gunBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.15, 0.4),
            new THREE.MeshStandardMaterial({ color: 0xcc3333 })
        );
        gunBody.position.z = -0.2;
        this.gunModel.add(gunBody);
        
        // Gun barrel
        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8),
            new THREE.MeshStandardMaterial({ color: 0x666666 })
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = -0.4;
        this.gunModel.add(barrel);
        
        // Fixed position relative to the screen/camera - positioned to be visible at bottom right
        this.gunModel.position.set(0.3, -0.3, -0.5);
    }

    /**
     * Starts continuous firing of the gun
     */
    startContinuousFire() {
        this.isFiring = true;
    }

    /**
     * Stops continuous firing of the gun
     */
    stopContinuousFire() {
        this.isFiring = false;
    }

    /**
     * Fires a bullet from the gun
     */
    fire() {
        const now = Date.now();
        
        // Check if enough time has passed since last fire
        if (now - this.lastFired < this.fireRate) {
            return false;
        }
        
        // Check ammo
        if (this.ammo <= 0) {
            console.log("ShooterGun: Out of ammo!");
            return false;
        }
        
        // Set last fired time
        this.lastFired = now;
        
        // Decrease ammo
        this.ammo--;
        
        // Create bullet
        const bulletGeometry = new THREE.SphereGeometry(this.options.bulletSize, 8, 8);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        // Position the bullet at the gun's position
        const direction = this.getCameraDirection();
        const cameraPosition = new THREE.Vector3();
        this.playerCamera.camera.getWorldPosition(cameraPosition);
        
        // Create a slight right and down offset for the bullet's starting position
        const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(0.2);
        const down = new THREE.Vector3(0, -0.1, 0);
        
        // Apply the offset to the bullet position
        bullet.position.copy(cameraPosition).add(right).add(down);
        
        // Store direction and creation time with the bullet
        bullet.userData = {
            direction: direction,
            createdAt: now,
            velocity: direction.clone().multiplyScalar(this.options.bulletSpeed)
        };
        
        // Add bullet to scene and tracking array
        this.scene.add(bullet);
        this.bullets.push(bullet);
        
        // Create muzzle flash effect
        this.createMuzzleFlash();
        
        // Play sound
        this.playSound();
        
        return true;
    }

    /**
     * Creates a muzzle flash effect
     */
    createMuzzleFlash() {
        // Simple muzzle flash implementation
        const flash = new THREE.PointLight(0xffff00, 2, 1);
        flash.position.copy(this.gunModel.position);
        flash.position.z -= 0.5; // Position at the end of the barrel
        this.scene.add(flash);
        
        // Remove the flash after a short time
        setTimeout(() => {
            this.scene.remove(flash);
        }, 50);
    }

    /**
     * Updates the gun and its bullets
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        // Continuously fire if the gun is in firing state
        if (this.isFiring) {
            this.fire();
        }
        
        // Update all bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            // Move bullet forward
            bullet.position.add(bullet.userData.velocity.clone().multiplyScalar(deltaTime));
            
            // Check for collisions with billboards
            let collided = false;
            
            // Only check billboards that exist
            if (this.billboards && this.billboards.length > 0) {
                // Debug billboard count
                if (Math.random() < 0.01) { // Only log occasionally
                    console.log(`Checking collision against ${this.billboards.length} billboards`);
                }
                
                for (let j = 0; j < this.billboards.length; j++) {
                    const billboard = this.billboards[j];
                    
                    // Skip invalid billboards
                    if (!billboard || !billboard.mesh) {
                        console.log("Skipping invalid billboard at index", j);
                        continue;
                    }
                    
                    // Get billboard position
                    const billboardPosition = billboard.mesh.position.clone();
                    
                    // Calculate distance between bullet and billboard
                    const distance = bullet.position.distanceTo(billboardPosition);
                    
                    // Debug distances occasionally
                    if (Math.random() < 0.005) {
                        console.log(`Bullet distance to billboard ${j}: ${distance.toFixed(2)} units`);
                    }
                    
                    // Increase hit radius significantly for the taller billboard structure
                    const hitRadius = 3.0; // Increased from 1.5 to better match the larger structure
                    
                    // If close enough, consider it a hit
                    if (distance < hitRadius) {
                        console.log(`Hit detected! Distance: ${distance.toFixed(2)}, Billboard index: ${j}`);
                        
                        // Store the bullet position before removing it
                        const bulletPosition = bullet.position.clone();
                        
                        // Remove bullet from scene and array FIRST
                        this.scene.remove(bullet);
                        this.bullets.splice(i, 1);
                        
                        // THEN create explosion at the stored bullet position
                        this.createBulletImpactEffect(bulletPosition);
                        
                        // Show hit effect and reduce billboard health
                        this.showHitEffect(billboard);
                        
                        collided = true;
                        break;
                    }
                }
            } else {
                // Debug if no billboards exist
                if (Math.random() < 0.01) { // Only log occasionally
                    console.log("No billboards to check collisions against");
                }
            }
            
            // Remove bullets that have been flying for too long
            if (!collided) {
                const now = Date.now();
                const age = now - bullet.userData.createdAt;
                if (age > 5000) { // 5 seconds
                    this.scene.remove(bullet);
                    this.bullets.splice(i, 1);
                }
            }
        }
    }

    /**
     * Shows a hit effect when a bullet hits a billboard
     * @param {Object} billboard - The billboard that was hit
     */
    showHitEffect(billboard) {
        if (!billboard || !billboard.mesh) {
            console.log("Invalid billboard object in showHitEffect");
            return;
        }
        
        // Decrease billboard health
        if (typeof billboard.health === 'undefined') {
            billboard.health = 100;
        }
        
        // Set damage amount for 20 hits to destroy (100/5 = 20 hits)
        const damageAmount = 4; // Changed from 25 to require 20 hits
        billboard.health -= damageAmount;
        console.log(`Billboard hit! Health reduced to: ${billboard.health}`);
        
        // Scale billboard based on health - scale the entire group
        const healthScale = 0.5 + (billboard.health / 100) * 0.5;
        billboard.mesh.scale.set(healthScale, healthScale, healthScale);
        
        // Find the sign part (first child is typically the sign)
        let signMesh = null;
        billboard.mesh.children.forEach((child, index) => {
            console.log(`Billboard child ${index} type:`, child.type, child.geometry ? child.geometry.type : "no geometry");
            // The sign is usually the plane geometry
            if (child.geometry && child.geometry.type === 'PlaneGeometry') {
                signMesh = child;
                console.log("Found sign mesh!");
            }
        });
        
        // Change sign color based on damage
        if (signMesh && signMesh.material) {
            const damageColor = new THREE.Color(1, billboard.health / 100, billboard.health / 100);
            signMesh.material.color.copy(damageColor);
        } else {
            console.log("Could not find sign mesh to change color");
        }
        
        // Create a more noticeable hit effect
        const hitLight = new THREE.PointLight(0xff0000, 4, 5); // Brighter light
        hitLight.position.copy(billboard.mesh.position);
        // Raise the light to be at sign height, not ground level
        hitLight.position.y += 2.0; // Match the sign height from ground
        this.scene.add(hitLight);
        
        // Add a small explosion effect at hit point
        const explosionGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: 0xff5500,
            transparent: true,
            opacity: 0.8
        });
        const explosionMesh = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosionMesh.position.copy(hitLight.position);
        this.scene.add(explosionMesh);
        
        // Remove the light and explosion after a short time
        setTimeout(() => {
            this.scene.remove(hitLight);
            this.scene.remove(explosionMesh);
        }, 300);
        
        // If billboard is destroyed, trigger destruction effect
        if (billboard.health <= 0) {
            this.destroyBillboard(billboard);
        }
    }

    /**
     * Destroys a billboard
     * @param {Object} billboard - The billboard to destroy
     */
    destroyBillboard(billboard) {
        if (!billboard || !billboard.mesh) return;
        
        console.log("Billboard destroyed!");
        
        // Create explosion effect at the billboard's position
        this.createExplosion(billboard.mesh.position);
        
        // Trigger the falling animation
        this.animateBillboardDestruction(billboard);
        
        // Remove from billboards array after a delay (animation will remove from scene)
        setTimeout(() => {
            const index = this.billboards.indexOf(billboard);
            if (index !== -1) {
                this.billboards.splice(index, 1);
                console.log("Billboard removed from tracking array");
            }
        }, 1100); // Just after the animation finishes
    }

    /**
     * Creates an explosion effect
     * @param {THREE.Vector3} position - The position of the explosion
     */
    createExplosion(position) {
        // Create a light flash
        const explosionLight = new THREE.PointLight(0xffaa00, 3, 5);
        explosionLight.position.copy(position);
        this.scene.add(explosionLight);
        
        // Fade out and remove the light
        let intensity = 3;
        const fadeInterval = setInterval(() => {
            intensity -= 0.1;
            explosionLight.intensity = intensity;
            
            if (intensity <= 0) {
                clearInterval(fadeInterval);
                this.scene.remove(explosionLight);
            }
        }, 50);
    }

    /**
     * Animates the destruction of a billboard
     * @param {Object} billboard - The billboard to animate
     */
    animateBillboardDestruction(billboard) {
        if (!billboard || !billboard.mesh) return;
        
        const mesh = billboard.mesh;
        const startScale = mesh.scale.clone();
        const startRotation = mesh.rotation.clone();
        const startPosition = mesh.position.clone();
        
        // Find the up vector (normal to planet surface)
        let upVector = new THREE.Vector3(0, 1, 0);
        if (this.globe && this.globe.globe) {
            const globeCenter = this.globe.globe.position.clone();
            upVector = startPosition.clone().sub(globeCenter).normalize();
        }
        
        // Create rotation axis perpendicular to up vector
        const rotationAxis = new THREE.Vector3(1, 0, 0);
        if (Math.abs(rotationAxis.dot(upVector)) > 0.9) {
            rotationAxis.set(0, 0, 1); // Use a different axis if too close to up
        }
        rotationAxis.crossVectors(rotationAxis, upVector).normalize();
        
        let progress = 0;
        const duration = 1000; // ms
        const startTime = performance.now();
        
        const animate = () => {
            const currentTime = performance.now();
            progress = Math.min(1, (currentTime - startTime) / duration);
            
            // Scale down slightly
            mesh.scale.copy(startScale).multiplyScalar(1 - progress * 0.3);
            
            // Rotate to fall over
            const fallAngle = progress * Math.PI / 2; // 90 degrees in radians
            const fallQuat = new THREE.Quaternion().setFromAxisAngle(rotationAxis, fallAngle);
            mesh.quaternion.premultiply(fallQuat);
            
            // Move down slightly (falling effect)
            mesh.position.copy(startPosition).sub(upVector.clone().multiplyScalar(progress * 0.5));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Remove from scene when animation completes
                this.scene.remove(mesh);
            }
        };
        
        animate();
    }

    /**
     * Creates a bullet impact explosion effect
     * @param {THREE.Vector3} position - The position of the impact
     */
    createBulletImpactEffect(position) {
        // Create a flash of light at impact point
        const impactLight = new THREE.PointLight(0xffaa00, 2, 3);
        impactLight.position.copy(position);
        this.scene.add(impactLight);
        
        // Create particle explosion
        const particleCount = 10;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            // Small sphere for each particle
            const particleGeometry = new THREE.SphereGeometry(0.05, 4, 4);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0xff3300,
                transparent: true,
                opacity: 0.8
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(position);
            
            // Random velocity for each particle
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            );
            velocity.normalize().multiplyScalar(0.05);
            
            particle.userData.velocity = velocity;
            particle.userData.lifetime = 300; // milliseconds
            particle.userData.born = Date.now();
            
            this.scene.add(particle);
            particles.push(particle);
        }
        
        // Animate and remove particles
        const animateParticles = () => {
            const now = Date.now();
            let allDone = true;
            
            particles.forEach(particle => {
                const age = now - particle.userData.born;
                
                if (age < particle.userData.lifetime) {
                    // Move particle
                    particle.position.add(particle.userData.velocity);
                    
                    // Fade out
                    const opacity = 1 - (age / particle.userData.lifetime);
                    particle.material.opacity = opacity;
                    
                    allDone = false;
                } else if (particle.parent) {
                    // Remove expired particle
                    this.scene.remove(particle);
                }
            });
            
            // Remove light after short time
            if (now - impactLight.userData.born > 150) {
                this.scene.remove(impactLight);
            } else {
                allDone = false;
            }
            
            // Continue animation if needed
            if (!allDone) {
                requestAnimationFrame(animateParticles);
            }
        };
        
        // Store creation time for the light
        impactLight.userData = { born: Date.now() };
        
        // Start animation
        requestAnimationFrame(animateParticles);
    }
}

/**
 * WeaponManager class - Manages the player's weapons
 */
class WeaponManager {
    /**
     * Create a new weapon manager
     * @param {PlayerCamera} playerCamera - The player camera
     * @param {Scene} scene - The Three.js scene
     * @param {MarsGlobe} globe - The Mars globe
     */
    constructor(playerCamera, scene, globe) {
        this.playerCamera = playerCamera;
        this.scene = scene;
        this.globe = globe;
        
        console.log("Initializing weapons manager with scene:", scene);
        console.log("Mars globe provided:", globe ? "Yes" : "No");
        
        // First create billboard gun
        this.billboardGun = new BillboardGun(scene, playerCamera, globe);
        console.log("BillboardGun created with placedBillboards array:", this.billboardGun.placedBillboards);
        
        // CRITICAL: Store a direct reference to the billboards array to ensure consistent reference
        const billboardsReference = this.billboardGun.placedBillboards;
        
        // Then create shooter gun, passing the DIRECT reference to billboard gun's billboards
        this.shooterGun = new ShooterGun(scene, playerCamera, billboardsReference);
        console.log("ShooterGun created with billboards reference:", this.shooterGun.billboards);
        
        // Verify reference consistency
        console.log("Reference check - same object?", this.shooterGun.billboards === this.billboardGun.placedBillboards);
        
        // Make sure gun models are created
        if (!this.billboardGun.gunModel) {
            console.log("Creating missing BillboardGun model");
            this.billboardGun.createGunModel();
        }
        
        if (!this.shooterGun.gunModel) {
            console.log("Creating missing ShooterGun model");
            this.shooterGun.createGunModel();
        }
        
        // Make sure gun models are added to the scene
        this.billboardGun.addToScene();
        this.shooterGun.addToScene();
        
        // Set active weapon
        this.activeWeaponIndex = 0;
        this.weapons = [this.billboardGun, this.shooterGun];
        
        // Initialize visibility
        this.updateWeaponVisibility();
        
        // Update weapon indicators
        this.updateWeaponIndicator();
        
        console.log("Weapons initialized! Active weapon:", this.getActiveWeapon().constructor.name);
    }
    
    /**
     * Update the weapon indicator in the UI
     */
    updateWeaponIndicator() {
        const billboardIndicator = document.querySelector('.gun-indicator[data-weapon="billboard"]');
        const shooterIndicator = document.querySelector('.gun-indicator[data-weapon="shooter"]');
        const ammoDisplay = document.querySelector('.ammo-display');
        const billboardCount = document.querySelector('.billboard-count');
        
        // Skip if elements don't exist yet
        if (!billboardIndicator || !shooterIndicator || !ammoDisplay || !billboardCount) {
            return;
        }
        
        // Update the active weapon indicator
        if (this.isBillboardGunActive()) {
            billboardIndicator.classList.add('active');
            shooterIndicator.classList.remove('active');
        } else {
            billboardIndicator.classList.remove('active');
            shooterIndicator.classList.add('active');
        }
        
        // Update ammo display
        const ammoInfo = this.getAmmoInfo();
        if (ammoInfo) {
            ammoDisplay.textContent = `Ammo: ${ammoInfo.ammo}/${ammoInfo.maxAmmo}`;
            billboardCount.textContent = `Billboards: ${ammoInfo.billboards}/${ammoInfo.maxBillboards}`;
        }
    }
    
    /**
     * Get the active weapon
     * @returns {Gun} The active weapon
     */
    getActiveWeapon() {
        return this.weapons[this.activeWeaponIndex];
    }
    
    /**
     * Check if the billboard gun is active
     * @returns {boolean} True if billboard gun is active
     */
    isBillboardGunActive() {
        return this.activeWeaponIndex === 0;
    }
    
    /**
     * Check if the shooter gun is active
     * @returns {boolean} True if shooter gun is active
     */
    isShooterGunActive() {
        return this.activeWeaponIndex === 1;
    }
    
    /**
     * Switch to the next weapon
     */
    switchWeapon() {
        // First stop any continuous firing from the shooter gun
        this.stopContinuousFire();
        
        // Switch weapon
        this.activeWeaponIndex = (this.activeWeaponIndex + 1) % this.weapons.length;
        
        // Update indicators
        this.updateWeaponIndicator();
        
        console.log(`Switched to weapon: ${this.isBillboardGunActive() ? 'Billboard Gun' : 'Shooter Gun'}`);
        
        // Make sure both guns are visible in the scene
        this.updateWeaponVisibility();
    }
    
    /**
     * Update weapon visibility based on active weapon
     */
    updateWeaponVisibility() {
        if (this.billboardGun && this.billboardGun.gunModel) {
            this.billboardGun.gunModel.visible = this.isBillboardGunActive();
        }
        
        if (this.shooterGun && this.shooterGun.gunModel) {
            this.shooterGun.gunModel.visible = this.isShooterGunActive();
        }
    }
    
    /**
     * Fire the active weapon
     */
    fire() {
        const activeWeapon = this.getActiveWeapon();
        if (activeWeapon) {
            activeWeapon.fire();
        }
    }
    
    /**
     * Start continuous fire for the active weapon
     */
    startContinuousFire() {
        if (this.isShooterGunActive()) {
            this.shooterGun.startContinuousFire();
        }
    }
    
    /**
     * Stop continuous fire for the shooter gun
     */
    stopContinuousFire() {
        // Make sure the shooter gun stops firing regardless of which gun is active
        this.shooterGun.stopContinuousFire();
    }
    
    /**
     * Update the weapon manager and active weapons
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        // Debug log billboard count occasionally
        if (Math.random() < 0.01) {
            console.log(`WeaponManager - Billboards count: ${this.billboardGun.placedBillboards.length}`);
        }
        
        // Make sure shooterGun always has the latest reference to billboards
        if (this.shooterGun && this.billboardGun) {
            // This is critical: ensure the reference is shared
            this.shooterGun.billboards = this.billboardGun.placedBillboards;
        }
        
        // Update both weapons
        this.billboardGun.update(deltaTime);
        this.shooterGun.update(deltaTime);
        
        // Ensure billboards reference stays synchronized
        this.shooterGun.billboards = this.billboardGun.placedBillboards;
        
        // Update visibility
        this.updateWeaponVisibility();
        
        // Log billboards count occasionally for debugging
        if (Math.random() < 0.01) { // About once every 100 frames
            console.log("Current billboard count:", this.billboardGun.placedBillboards.length);
            console.log("ShooterGun billboard reference:", this.shooterGun.billboards === this.billboardGun.placedBillboards ? "CORRECT" : "BROKEN");
        }
    }
    
    /**
     * Get ammo information for UI display
     * @returns {Object} Object containing billboard and shooter gun ammo info
     */
    getAmmoInfo() {
        if (!this.shooterGun || !this.billboardGun) {
            return {
                ammo: "0/0",
                maxAmmo: "0",
                billboards: "0",
                maxBillboards: "0"
            };
        }
        
        return {
            ammo: this.shooterGun.ammo,
            maxAmmo: this.shooterGun.maxAmmo,
            billboards: this.billboardGun.ammo,
            maxBillboards: this.billboardGun.maxAmmo
        };
    }
} 