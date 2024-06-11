// Helper function to calculate the distance and direction between two objects
const calculateDistanceAndDirection = (objPosition, heavyObj) => {
  // Difference in x and y coordinates between the two objects
  const dx = heavyObj.x - objPosition.x;
  const dy = heavyObj.y - objPosition.y;

  // Calculate the distance between the two objects
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Return both the distance and the direction as an object
  return {
    distance,
    direction: { x: dx / distance, y: dy / distance },
  };
};

// Function to calculate the gravitational force exerted by a 
// heavy object (e.g., black hole) on another object (e.g., projectile)
const calculateGravitationalForce = (objPosition, heavyObj) => {
  const { distance, direction } = calculateDistanceAndDirection(objPosition, heavyObj);

  if (distance < heavyObj.radius * heavyObj.attractionRadiusFactor) {
    // Inverse-square falloff with a cap
    const forceMagnitude = Math.min(heavyObj.gravitationalConstant / (distance * distance), heavyObj.maxForce);
    return {
      x: direction.x * forceMagnitude,
      y: direction.y * forceMagnitude
    };
  } else {
    return { x: 0, y: 0 };
  }
};

// Function to check if an object is within the radius of the heavy object
const isWithinBlackHole = (objPosition, heavyObj) => { 
  const { distance } = calculateDistanceAndDirection(objPosition, heavyObj); 
  return distance <= heavyObj.radius; 
}; 

// Export the functions for use in other modules
module.exports = {
  calculateGravitationalForce,
  isWithinBlackHole,
};
