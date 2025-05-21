import { useEffect, useRef } from "react"; // Add useRef
import {
  shipMaxSpeed,
  shipAcceleration,
  shipMomentum,
  shipAngularSpeed,
} from "../constants";
const maxSpeedPow = shipMaxSpeed * shipMaxSpeed;
const MOVEMENT_THRESHOLD = 0.4; // Small threshold for position/angle changes
const VELOCITY_THRESHOLD = 0.4; // Small threshold for velocity changes

/**
 * Custom hook to handle player movement.
 *
 * @param {Object} socket - The socket instance to communicate with the server.
 * @param {Object} playersRef - A reference to the current state of players.
 * @param {boolean} isSocketConnected - A flag indicating if the socket is connected.
 * @param {Object} keysPressed - A reference to the keys currently pressed.
 */
const usePlayerMovement = (
  socket,
  playersRef,
  isSocketConnected,
  keysPressed
) => {
  const lastSentMoveRef = useRef(null); // Store the last sent move data

  useEffect(() => {
    if (isSocketConnected) {
      let lastTimestamp = 0;

      const updatePlayerMovement = (timestamp) => {
        if (!socket.id) {
          // Guard: ensure socket.id is available
          requestAnimationFrame(updatePlayerMovement);
          return;
        }
        if (!lastTimestamp) lastTimestamp = timestamp;
        const elapsed = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        const currentPlayers = playersRef.current;
        const player = currentPlayers[socket.id];

        if (player && player.health > 0) {
          let newVelocity = { ...player.velocity };
          let newAngle = player.angle;
          let newX = player.x;
          let newY = player.y;

          const speedFactor = elapsed / 14; // Adjust movement based on elapsed time.

          let isAccelerating = false;
          let isTurning = false;

          if (keysPressed.current["w"]) {
            isAccelerating = true;
            if (
              newVelocity.x * newVelocity.x + newVelocity.y * newVelocity.y <
              maxSpeedPow
            ) {
              newVelocity.x +=
                Math.cos(player.angle) * shipAcceleration * speedFactor;
              newVelocity.y +=
                Math.sin(player.angle) * shipAcceleration * speedFactor;
            }
          }
          // Apply momentum only if not accelerating forward (or if you want momentum to always apply and cap speed)
          if (!isAccelerating) {
            newVelocity.x *= Math.pow(shipMomentum, speedFactor);
            newVelocity.y *= Math.pow(shipMomentum, speedFactor);
          }

          if (keysPressed.current["a"]) {
            isTurning = true;
            newAngle -= shipAngularSpeed * speedFactor;
          }
          if (keysPressed.current["d"]) {
            isTurning = true;
            newAngle += shipAngularSpeed * speedFactor;
          }

          newX += newVelocity.x * speedFactor;
          newY += newVelocity.y * speedFactor;

          const move = {
            x: newX,
            y: newY,
            angle: newAngle,
            velocity: newVelocity,
          };

          // Check if there's a significant change or active input
          let hasChangedSignificantly = false;
          if (lastSentMoveRef.current === null) {
            hasChangedSignificantly = true; // Always send the first state
          } else {
            const last = lastSentMoveRef.current;
            if (
              Math.abs(move.x - last.x) > MOVEMENT_THRESHOLD ||
              Math.abs(move.y - last.y) > MOVEMENT_THRESHOLD ||
              Math.abs(move.angle - last.angle) > MOVEMENT_THRESHOLD || // Angles can wrap, be careful with simple diff
              Math.abs(move.velocity.x - last.velocity.x) >
                VELOCITY_THRESHOLD ||
              Math.abs(move.velocity.y - last.velocity.y) > VELOCITY_THRESHOLD
            ) {
              hasChangedSignificantly = true;
            }
          }

          // Only emit if there's active input OR a significant change (e.g., due to momentum)
          // AND the player's computed state is different from what server has (or what we last sent)
          if (isAccelerating || isTurning || hasChangedSignificantly) {
            socket.emit("move-player", move);
            lastSentMoveRef.current = { ...move }; // Store what was sent
          }
        }
        requestAnimationFrame(updatePlayerMovement);
      };
      requestAnimationFrame(updatePlayerMovement);
    }
    // Cleanup if socket disconnects or component unmounts
    return () => {
      lastSentMoveRef.current = null;
      // Potentially cancel animation frame if you store its ID
    };
  }, [isSocketConnected, socket, playersRef, keysPressed]);
};

export default usePlayerMovement;
