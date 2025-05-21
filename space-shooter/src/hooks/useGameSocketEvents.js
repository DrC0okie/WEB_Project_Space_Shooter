import { useEffect, useRef } from "react";
import {
  respawnTimeSeconds,
  canvasWidth,
  canvasHeight,
  playerWidth,
  playerHeight,
  teleportEffectDuration,
} from "../constants";

const EXPLOSION_TOTAL_FRAMES = 8;
const EXPLOSION_FRAME_DURATION = 150; // ms
const EXPLOSION_ANIMATION_DURATION =
  EXPLOSION_TOTAL_FRAMES * EXPLOSION_FRAME_DURATION;

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
const useGameSocketEvents = (
  socket,
  isSocketConnected,
  team,
  nickname,
  setGameState,
  setAllPlayerScores,
  setIsGameOver,
  setWinner,
  setTeleportEffect,
  setExplosions,
  setRespawnCountdown
) => {
  const localPlayerIdRef = useRef(null);
  const playerDiedIntervals = useRef({}); // Initialized to an empty object, this is good.

  useEffect(() => {
    // Declare effectCleanupIntervalId here so it's in scope for cleanup,
    // even if the if-block isn't entered.
    let effectCleanupIntervalId = null;

    if (isSocketConnected && team && nickname && socket) {
      // Added 'socket' to condition
      // Join the game
      const x = Math.floor(Math.random() * (canvasWidth - playerWidth));
      const y = Math.floor(Math.random() * (canvasHeight - playerHeight));
      socket.emit("join-game", {
        team,
        nickname,
        x,
        y,
        angle: 0,
        velocity: { x: 0, y: 0 },
      });

      // Socket event listeners
      const handleInitialState = ({ allPlayers, allProjectiles, yourId }) => {
        localPlayerIdRef.current = yourId;
        setGameState({ players: allPlayers, projectiles: allProjectiles });
        const initialScores = {};
        Object.values(allPlayers).forEach((p) => {
          if (p.nickname) initialScores[p.nickname] = p.score;
        });
        setAllPlayerScores(initialScores);
      };

      const handleDeltaUpdate = (delta) => {
        setGameState((prevState) => {
          let newPlayers = { ...prevState.players };
          let newProjectiles = [...prevState.projectiles];
          if (delta.players) {
            Object.entries(delta.players).forEach(([playerId, playerData]) => {
              newPlayers[playerId] = {
                ...(newPlayers[playerId] || {}),
                ...playerData,
              };
            });
          }
          if (delta.newProjectiles) {
            delta.newProjectiles.forEach((p) => {
              if (!newProjectiles.find((existingP) => existingP.id === p.id)) {
                newProjectiles.push(p);
              }
            });
          }
          if (delta.movedProjectiles) {
            newProjectiles = newProjectiles.map((p) => {
              if (delta.movedProjectiles[p.id]) {
                return { ...p, ...delta.movedProjectiles[p.id] };
              }
              return p;
            });
          }
          if (delta.destroyedProjectiles) {
            const destroyedIds = new Set(delta.destroyedProjectiles);
            newProjectiles = newProjectiles.filter(
              (p) => !destroyedIds.has(p.id)
            );
          }
          return { players: newPlayers, projectiles: newProjectiles };
        });
        if (delta.players) {
          setAllPlayerScores((prevScores) => {
            const updatedScores = { ...prevScores };
            Object.values(delta.players).forEach((pData) => {
              if (pData.nickname && typeof pData.score === "number") {
                updatedScores[pData.nickname] = pData.score;
              }
            });
            return updatedScores;
          });
        }
      };

      const handlePlayerRemoved = (playerId) => {
        setGameState((prevState) => {
          const newPlayers = { ...prevState.players };
          const removedPlayer = newPlayers[playerId];
          delete newPlayers[playerId];
          if (removedPlayer && removedPlayer.nickname) {
            setAllPlayerScores((prevScores) => ({
              ...prevScores,
              [removedPlayer.nickname]: removedPlayer.score,
            }));
          }
          return { ...prevState, players: newPlayers };
        });
      };

      const handleGameOver = ({ winner }) => {
        setWinner(winner);
        setIsGameOver(true);
        setGameState((currentState) => {
          const finalScores = {};
          Object.values(currentState.players).forEach((p) => {
            if (p.nickname) finalScores[p.nickname] = p.score;
          });
          setAllPlayerScores((prevScores) => ({
            ...prevScores,
            ...finalScores,
          }));
          return currentState;
        });
      };

      const handleTeleport = ({ playerId, targetPosition }) => {
        setTeleportEffect((prevEffects) => [
          ...prevEffects,
          { playerId, position: targetPosition, timestamp: Date.now() },
        ]);
      };

      const handlePlayerDied = ({ playerId, position }) => {
        setExplosions((prevExplosions) => [
          ...prevExplosions,
          { playerId, position, timestamp: Date.now() },
        ]);
        if (playerDiedIntervals.current[playerId]) {
          clearInterval(playerDiedIntervals.current[playerId]);
        }
        setRespawnCountdown((prevCountdown) => ({
          ...prevCountdown,
          [playerId]: respawnTimeSeconds,
        }));
        playerDiedIntervals.current[playerId] = setInterval(() => {
          setRespawnCountdown((prev) => {
            const newCd = { ...prev };
            if (newCd[playerId] !== undefined && newCd[playerId] > 0) {
              newCd[playerId] -= 1;
            } else {
              if (playerDiedIntervals.current[playerId]) {
                clearInterval(playerDiedIntervals.current[playerId]);
                delete playerDiedIntervals.current[playerId];
              }
            }
            return newCd;
          });
        }, 1000);
      };

      const handleRespawnPlayer = ({ playerId, player }) => {
        if (playerDiedIntervals.current[playerId]) {
          clearInterval(playerDiedIntervals.current[playerId]);
          delete playerDiedIntervals.current[playerId];
        }
        setRespawnCountdown((prevCountdown) => {
          const newCountdown = { ...prevCountdown };
          delete newCountdown[playerId];
          return newCountdown;
        });
      };

      socket.on("initial-game-state", handleInitialState);
      socket.on("game-delta-update", handleDeltaUpdate);
      socket.on("player-removed", handlePlayerRemoved);
      socket.on("game-over", handleGameOver);
      socket.on("teleport", handleTeleport);
      socket.on("player-died", handlePlayerDied);
      socket.on("respawn-player", handleRespawnPlayer);

      // Interval to clean up expired visual effects from client state
      effectCleanupIntervalId = setInterval(() => {
        // Assign to the declared variable
        const now = Date.now();
        setTeleportEffect((prevEffects) =>
          prevEffects.filter(
            (effect) => now - effect.timestamp < teleportEffectDuration
          )
        );
        setExplosions((prevExplosions) =>
          prevExplosions.filter(
            (explosion) =>
              now - explosion.timestamp < EXPLOSION_ANIMATION_DURATION
          )
        );
      }, 1000);

      // Cleanup function for this effect instance
      return () => {
        socket.off("initial-game-state", handleInitialState);
        socket.off("game-delta-update", handleDeltaUpdate);
        socket.off("player-removed", handlePlayerRemoved);
        socket.off("game-over", handleGameOver);
        socket.off("teleport", handleTeleport);
        socket.off("player-died", handlePlayerDied);
        socket.off("respawn-player", handleRespawnPlayer);

        // Clear all intervals created by this effect instance
        Object.values(playerDiedIntervals.current).forEach(clearInterval);
        playerDiedIntervals.current = {}; // Important to reset for next effect run

        if (effectCleanupIntervalId) {
          // Only clear if it was set
          clearInterval(effectCleanupIntervalId);
        }
      };
    }
    // If the main condition (isSocketConnected etc.) is false,
    // we still need a cleanup for any intervals from a *previous* run of this effect
    // where the condition was true.
    return () => {
      Object.values(playerDiedIntervals.current).forEach(clearInterval);
      playerDiedIntervals.current = {};
      if (effectCleanupIntervalId) {
        clearInterval(effectCleanupIntervalId);
      }
    };
  }, [
    isSocketConnected,
    team,
    nickname,
    socket, // Make sure socket is stable or included if it can change
    setGameState,
    setAllPlayerScores,
    setWinner,
    setIsGameOver,
    setTeleportEffect,
    setExplosions,
    setRespawnCountdown,
  ]);
};

export default useGameSocketEvents;
