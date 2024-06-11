import { useEffect, useRef } from 'react';
import { playerHeight, playerWidth } from '../constants';
//import shootMP3 from '../assets/sounds/shoot.mp3'; TODO: Repeating shootings with audio causes problems

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
const usePlayerShooting = (socket, playersRef, isSocketConnected, spacePressed) => {
  //const audioRef = useRef(new Audio());
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
            owner: socket.id
          };
          // Emit the shoot event to the server
          socket.emit('shoot', projectile);

          // Ensure shooting only once per press
          spacePressed.current = false;

          // TODO: Fix the audio issue
          // // Play the shooting sound
          // audioRef.current.src = shootMP3;
          // audioRef.current.play();
        }
        requestAnimationFrame(handleShooting);
      };

      // Start the shooting loop
      handleShooting();
    }
  }, [isSocketConnected, socket, playersRef, spacePressed]);

  // TODO: Fix the audio issue
  // return () => {
  //   if (audioRef.current) {
  //     audioRef.current.pause();
  //     audioRef.current.currentTime = 0;
  //   }
  // };
};

export default usePlayerShooting;
