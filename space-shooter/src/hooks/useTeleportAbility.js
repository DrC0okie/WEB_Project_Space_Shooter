import { useEffect } from 'react';

/**
 * Custom hook to handle the teleport ability of a player.
 * 
 * @param {object} socket - The socket instance for communication.
 * @param {boolean} isSocketConnected - Boolean indicating the socket connection status.
 */
const useTeleportAbility = (socket, isSocketConnected) => {
  useEffect(() => {
    // Function to handle keydown event for teleport ability
    const handleKeyDown = (e) => {
      if (e.key === 'f' && isSocketConnected) {
        socket.emit('teleport-initiate');
      }
    };

    // Adding event listener for keydown
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [socket, isSocketConnected]);
};

export default useTeleportAbility;
