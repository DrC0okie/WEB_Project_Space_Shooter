import { useEffect } from "react";
import { playerHeight, playerWidth } from "../constants";

const halfPlayerHeight = playerHeight / 2;
const halfPlayerWidth = playerWidth / 2;

/**
 * Custom hook to handle player shooting.
 *
 * @param {Object} socket - The socket instance to communicate with the server.
 * @param {Object} playersRef - A reference to the current state of players.
 * @param {boolean} isSocketConnected - A flag indicating if the socket is connected.
 * @param {Object} spacePressed - A reference to the state of the space key (for shooting).
 */
const usePlayerShooting = (
  socket,
  playersRef,
  isSocketConnected,
  spacePressed
) => {
  useEffect(() => {
    if (isSocketConnected) {
      const handleShooting = () => {
        const currentPlayers = playersRef.current;
        const player = currentPlayers[socket.id];
        if (player && spacePressed.current) {
          const projectile = {
            x: player.x + halfPlayerWidth,
            y: player.y + halfPlayerHeight,
            direction: { x: Math.cos(player.angle), y: Math.sin(player.angle) },
            owner: socket.id,
          };
          // Emit the shoot event to the server
          socket.emit("shoot", projectile);

          // Ensure shooting only once per press
          spacePressed.current = false;
        }
        requestAnimationFrame(handleShooting);
      };

      // Start the shooting loop
      handleShooting();
    }
  }, [isSocketConnected, socket, playersRef, spacePressed]);
};

export default usePlayerShooting;
