import { useEffect } from 'react';
import { shipMaxSpeed, shipAcceleration, shipMomentum, shipAngularSpeed } from '../constants';
const maxSpeedPow = shipMaxSpeed * shipMaxSpeed;

/**
 * Custom hook to handle player movement.
 * 
 * @param {Object} socket - The socket instance to communicate with the server.
 * @param {Object} playersRef - A reference to the current state of players.
 * @param {boolean} isSocketConnected - A flag indicating if the socket is connected.
 * @param {Object} keysPressed - A reference to the keys currently pressed.
 */
const usePlayerMovement = (socket, playersRef, isSocketConnected, keysPressed) => {
  useEffect(() => {
    if (isSocketConnected) {
      let lastTimestamp = 0;

      /**
       * Updates player movement based on the elapsed time since the last frame.
       * 
       * @param {number} timestamp - The current time in milliseconds.
       */
      const updatePlayerMovement = (timestamp) => {
        if (!lastTimestamp) lastTimestamp = timestamp;
        const elapsed = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        const currentPlayers = playersRef.current;
        const player = currentPlayers[socket.id];
        if (player && player.health > 0) {
          let newVelocity = { ...player.velocity };
          let newAngle = player.angle;

          // Adjust movement based on elapsed time. 14 works well independently of the refresh rate.
          const speedFactor = elapsed / 14;

          // Update velocity based on acceleration or momentum
          if (keysPressed.current['w'] && (newVelocity.x * newVelocity.x + newVelocity.y * newVelocity.y) < maxSpeedPow) {
            newVelocity.x += Math.cos(player.angle) * shipAcceleration * speedFactor;
            newVelocity.y += Math.sin(player.angle) * shipAcceleration * speedFactor;
          } else {
            newVelocity.x *= Math.pow(shipMomentum, speedFactor);
            newVelocity.y *= Math.pow(shipMomentum, speedFactor);
          }
          // Update angle based on angular speed
          if (keysPressed.current['a']) {
            newAngle -= shipAngularSpeed * speedFactor;
          }
          if (keysPressed.current['d']) {
            newAngle += shipAngularSpeed * speedFactor;
          }

          // Calculate the new position based on velocity
          const move = {
            x: player.x + newVelocity.x * speedFactor,
            y: player.y + newVelocity.y * speedFactor,
            angle: newAngle,
            velocity: newVelocity,
          };

          // Emit the move event to the server
          socket.emit('move-player', move);
        }

        // Initial request to ensure the `updatePlayerMovement` function is scheduled 
        // to run before the next repaint.
        requestAnimationFrame(updatePlayerMovement);
      };

      // Second call to schedule the next iteration of the updatePlayerMovement function,
      // creating a loop that continuously updates the player's movement based on the
      // elapsed time and the current state of the keys pressed.
      requestAnimationFrame(updatePlayerMovement);
    }
  }, [isSocketConnected, socket, playersRef, keysPressed]);
};

export default usePlayerMovement;
