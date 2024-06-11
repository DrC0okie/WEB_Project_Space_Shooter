
import { useEffect } from 'react';
import { respawnTimeSeconds, canvasWidth, canvasHeight, playerWidth, playerHeight } from '../constants';

/**
 * Custom hook to handle socket events for the game.
 * 
 * @param {Object} socket - The socket instance for communication with the server.
 * @param {boolean} isSocketConnected - Indicates if the socket is connected.
 * @param {string} team - The team of the player.
 * @param {string} nickname - The nickname of the player.
 * @param {function} setGameState - Function to update the game state.
 * @param {function} setAllPlayerScores - Function to update all player scores.
 * @param {function} setIsGameOver - Function to set the game over state.
 * @param {function} setWinner - Function to set the winner of the game.
 * @param {function} setTeleportEffect - Function to set the teleport effect.
 * @param {function} setExplosions - Function to set the explosions.
 * @param {function} setRespawnCountdown - Function to set the respawn countdown.
 */
const useGameSocketEvents = (socket, isSocketConnected, team, nickname, setGameState, setAllPlayerScores, setIsGameOver, setWinner, setTeleportEffect, setExplosions, setRespawnCountdown) => {
  useEffect(() => {
    if (isSocketConnected && team && nickname) {

      // Join the game with the specified team and nickname
      const x = Math.floor(Math.random() * (canvasWidth - playerWidth));
      const y = Math.floor(Math.random() * (canvasHeight - playerHeight));
      socket.emit('join-game', { team, nickname, x: x, y: y, angle: 0, velocity: { x: 0, y: 0 } });

      // Listen for updates to the players
      socket.on('update-players', (updatedPlayers) => {
        setGameState((prevState) => ({
          ...prevState,
          players: { ...prevState.players, ...updatedPlayers }
        }));
      });

      // Listen for updates to the projectiles
      socket.on('update-projectiles', (updatedProjectiles) => {
        setGameState((prevState) => ({
          ...prevState,
          projectiles: updatedProjectiles
        }));
      });

      // Handle player removal
      socket.on('player-removed', (playerId) => {
        setGameState((prevState) => {
          const newPlayers = { ...prevState.players };
          const removedPlayer = newPlayers[playerId];
          delete newPlayers[playerId];
          if (removedPlayer) {
            setAllPlayerScores((prevScores) => ({
              ...prevScores,
              [removedPlayer.nickname]: removedPlayer.score
            }));
          }
          return { ...prevState, players: newPlayers };
        });
      });

      // Handle game over event
      socket.on('game-over', ({ winner }) => {
        setWinner(winner);
        setIsGameOver(true);
      });

      // Handle teleportation events
      socket.on('teleport', ({ playerId, targetPosition }) => {
        setTeleportEffect((prevEffects) => [
          ...prevEffects,
          { playerId, position: targetPosition, timestamp: Date.now() }
        ]);
      });

      // Handle player death and start respawn countdown
      socket.on('player-died', ({ playerId, position }) => {
        setExplosions((prevExplosions) => [
          ...prevExplosions,
          { playerId, position, timestamp: Date.now() }
        ]);
        setRespawnCountdown((prevCountdown) => ({
          ...prevCountdown,
          [playerId]: respawnTimeSeconds
        }));

        const intervalId = setInterval(() => {
          setRespawnCountdown((prevCountdown) => {
            const newCountdown = { ...prevCountdown };
            if (newCountdown[playerId] > 0) {
              newCountdown[playerId] -= 1;
            } else {
              clearInterval(intervalId);
            }
            return newCountdown;
          });
        }, 1000);
      });

      // Handle player respawn
      socket.on('respawn-player', ({ playerId, player }) => {
        setGameState((prevState) => ({
          ...prevState,
          players: {
            ...prevState.players,
            [playerId]: player
          }
        }));
        setRespawnCountdown((prevCountdown) => {
          const newCountdown = { ...prevCountdown };
          delete newCountdown[playerId];
          return newCountdown;
        });
      });

      // Cleanup event listeners on component unmount
      return () => {
        socket.off('update-players');
        socket.off('update-projectiles');
        socket.off('player-removed');
        socket.off('game-over');
        socket.off('teleport');
        socket.off('player-died');
        socket.off('respawn-player');
      };
    }
  }, [isSocketConnected, team, nickname, socket, setGameState, setAllPlayerScores, setWinner, setIsGameOver, setTeleportEffect, setExplosions, setRespawnCountdown]);
};

export default useGameSocketEvents;
