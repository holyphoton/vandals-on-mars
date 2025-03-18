// math.js - Math utility functions for 3D sphere calculations - 2025-03-18

/**
 * Math utilities for handling spherical coordinates and conversions
 * for movement on the Mars globe surface
 */
const MathUtils = {
    /**
     * Convert spherical coordinates (radius, theta, phi) to Cartesian (x, y, z)
     * @param {number} radius - Distance from center
     * @param {number} theta - Longitude (0 to 2π)
     * @param {number} phi - Latitude (0 to π)
     * @returns {Object} - {x, y, z} Cartesian coordinates
     */
    sphericalToCartesian: function(radius, theta, phi) {
        return {
            x: radius * Math.sin(phi) * Math.cos(theta),
            y: radius * Math.cos(phi),
            z: radius * Math.sin(phi) * Math.sin(theta)
        };
    },

    /**
     * Convert Cartesian coordinates (x, y, z) to spherical (radius, theta, phi)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} z - Z coordinate
     * @returns {Object} - {radius, theta, phi} Spherical coordinates
     */
    cartesianToSpherical: function(x, y, z) {
        const radius = Math.sqrt(x * x + y * y + z * z);
        return {
            radius: radius,
            theta: Math.atan2(z, x),
            phi: Math.acos(y / radius)
        };
    },

    /**
     * Calculate distance on sphere surface between two points (great-circle distance)
     * @param {number} phi1 - Latitude of point 1
     * @param {number} theta1 - Longitude of point 1
     * @param {number} phi2 - Latitude of point 2
     * @param {number} theta2 - Longitude of point 2
     * @param {number} radius - Sphere radius
     * @returns {number} - Distance on sphere surface
     */
    sphereDistance: function(phi1, theta1, phi2, theta2, radius) {
        // Haversine formula
        const dPhi = phi2 - phi1;
        const dTheta = theta2 - theta1;
        
        const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
                Math.sin(dTheta / 2) * Math.sin(dTheta / 2) * 
                Math.cos(phi1) * Math.cos(phi2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return radius * c;
    },

    /**
     * Move a point on sphere surface in a direction
     * @param {number} phi - Starting latitude
     * @param {number} theta - Starting longitude
     * @param {number} heading - Direction angle in radians (0 = north)
     * @param {number} distance - Distance to move
     * @param {number} radius - Sphere radius
     * @returns {Object} - {phi, theta} New spherical coordinates
     */
    moveOnSphere: function(phi, theta, heading, distance, radius) {
        // Convert the angular distance to radians
        const angularDistance = distance / radius;
        
        // Calculate new coordinates using spherical trigonometry
        const sinPhi1 = Math.cos(angularDistance) * Math.cos(phi) +
                      Math.sin(angularDistance) * Math.sin(phi) * Math.cos(heading);
        
        const newPhi = Math.acos(sinPhi1);
        
        let newTheta;
        if (Math.abs(newPhi) < 1e-10) {
            // At poles, longitude is arbitrary
            newTheta = theta;
        } else {
            const y = Math.sin(heading) * Math.sin(angularDistance) / Math.sin(newPhi);
            const x = (Math.cos(angularDistance) - Math.cos(phi) * sinPhi1) / 
                    (Math.sin(phi) * Math.sin(newPhi));
            
            newTheta = theta + Math.atan2(y, x);
            
            // Normalize theta to be between 0 and 2π
            while (newTheta < 0) newTheta += 2 * Math.PI;
            while (newTheta >= 2 * Math.PI) newTheta -= 2 * Math.PI;
        }
        
        // Ensure phi is between 0 and π
        while (newPhi < 0) newPhi += Math.PI;
        while (newPhi >= Math.PI) newPhi -= Math.PI;
        
        return { phi: newPhi, theta: newTheta };
    },

    /**
     * Calculate heading angle between two points on sphere
     * @param {number} phi1 - Latitude of point 1
     * @param {number} theta1 - Longitude of point 1
     * @param {number} phi2 - Latitude of point 2
     * @param {number} theta2 - Longitude of point 2
     * @returns {number} - Heading angle in radians
     */
    calculateHeading: function(phi1, theta1, phi2, theta2) {
        const dTheta = theta2 - theta1;
        
        const y = Math.sin(dTheta) * Math.sin(phi2);
        const x = Math.cos(phi1) * Math.sin(phi2) - 
                Math.sin(phi1) * Math.cos(phi2) * Math.cos(dTheta);
        
        return Math.atan2(y, x);
    },

    /**
     * Get a random point on a sphere
     * @param {number} radius - Sphere radius
     * @returns {Object} - {phi, theta} Random spherical coordinates
     */
    randomSpherePoint: function(radius) {
        // Random longitude (0 to 2π)
        const theta = Math.random() * 2 * Math.PI;
        
        // Random latitude (0 to π)
        // Using cos distribution to ensure uniform distribution on sphere
        const phi = Math.acos(2 * Math.random() - 1);
        
        return { phi, theta, radius };
    },

    /**
     * Lerp (Linear interpolation) between two values
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} - Interpolated value
     */
    lerp: function(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Clamp a value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} - Clamped value
     */
    clamp: function(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Normalize an angle to be between 0 and 2π
     * @param {number} angle - Angle in radians
     * @returns {number} - Normalized angle
     */
    normalizeAngle: function(angle) {
        while (angle < 0) angle += 2 * Math.PI;
        while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
        return angle;
    }
};

// Export as a module if in a module context
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MathUtils;
} 