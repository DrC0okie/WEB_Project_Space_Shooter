import { useEffect, useRef } from "react";
import {
  respawnTimeSeconds,
  canvasWidth,
  canvasHeight,
  playerWidth,
  playerHeight,
  teleportEffectDuration,
} from "../constants";

import { InitialGameState, GameDeltaUpdate } from "../proto_gen/state_pb";

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
  const playerDiedIntervals = useRef({});

  useEffect(() => {
    let effectCleanupIntervalId = null;

    if (isSocketConnected && team && nickname && socket) {
      socket.emit("join-game", {
        team,
        nickname,
        x: Math.floor(Math.random() * (canvasWidth - playerWidth)),
        y: Math.floor(Math.random() * (canvasHeight - playerHeight)),
        angle: 0,
        velocity: { x: 0, y: 0 },
      });

      // Deserialize and Convert for Initial State
      const handleInitialStateProto = (binaryData) => {
        const uint8ArrayData = new Uint8Array(binaryData);
        const initialStateProto =
          InitialGameState.deserializeBinary(uint8ArrayData);

        localPlayerIdRef.current = initialStateProto.getYourId();

        const allPlayers = {};
        initialStateProto
          .getAllPlayersMap()
          .forEach((playerProto, playerId) => {
            allPlayers[playerId] = {
              id: playerProto.getId(), // Proto getters are getFieldName()
              nickname: playerProto.getNickname(),
              team: playerProto.getTeam(),
              x: playerProto.getPosition().getX(),
              y: playerProto.getPosition().getY(),
              angle: playerProto.getAngle(),
              velocity: {
                x: playerProto.getVelocity().getX(),
                y: playerProto.getVelocity().getY(),
              },
              health: playerProto.getHealth(),
              score: playerProto.getScore(),
              deathCount: playerProto.getDeathCount(),
            };
          });

        const allProjectiles = initialStateProto
          .getAllProjectilesList()
          .map((projProto) => ({
            id: projProto.getId(),
            owner: projProto.getOwnerId(),
            x: projProto.getPosition().getX(),
            y: projProto.getPosition().getY(),
            direction: {
              x: projProto.getDirection().getX(),
              y: projProto.getDirection().getY(),
            },
          }));

        setGameState({ players: allPlayers, projectiles: allProjectiles });

        const initialScores = {};
        Object.values(allPlayers).forEach((p) => {
          if (p.nickname) initialScores[p.nickname] = p.score;
        });
        setAllPlayerScores(initialScores);
      };

      // Deserialize and Convert for Delta Update
      const handleDeltaUpdateProto = (binaryData) => {
        const uint8ArrayData = new Uint8Array(binaryData);
        const deltaProto = GameDeltaUpdate.deserializeBinary(uint8ArrayData);

        setGameState((prevState) => {
          let newPlayers = { ...prevState.players };
          let newProjectiles = [...prevState.projectiles];

          // Apply player updates from proto
          deltaProto.getPlayersMap().forEach((playerProto, playerId) => {
            newPlayers[playerId] = {
              ...(newPlayers[playerId] || {}),
              id: playerProto.getId(),
              nickname: playerProto.getNickname(),
              team: playerProto.getTeam(),
              x: playerProto.getPosition().getX(),
              y: playerProto.getPosition().getY(),
              angle: playerProto.getAngle(),
              velocity: {
                x: playerProto.getVelocity().getX(),
                y: playerProto.getVelocity().getY(),
              },
              health: playerProto.getHealth(),
              score: playerProto.getScore(),
              deathCount: playerProto.getDeathCount(),
            };
          });

          // Add new projectiles from proto
          deltaProto.getNewProjectilesList().forEach((projProto) => {
            if (
              !newProjectiles.find(
                (existingP) => existingP.id === projProto.getId()
              )
            ) {
              newProjectiles.push({
                id: projProto.getId(),
                owner: projProto.getOwnerId(),
                x: projProto.getPosition().getX(),
                y: projProto.getPosition().getY(),
                direction: {
                  x: projProto.getDirection().getX(),
                  y: projProto.getDirection().getY(),
                },
              });
            }
          });

          // Update moved projectiles from proto
          deltaProto.getMovedProjectilesList().forEach((movedUpdateProto) => {
            const projectileId = movedUpdateProto.getId();
            const newPositionProto = movedUpdateProto.getPosition(); // This is a Vec2 proto
            const projectileIndex = newProjectiles.findIndex(
              (p) => p.id === projectileId
            );
            if (projectileIndex !== -1 && newPositionProto) {
              newProjectiles[projectileIndex] = {
                ...newProjectiles[projectileIndex],
                x: newPositionProto.getX(),
                y: newPositionProto.getY(),
              };
            }
          });

          // Remove destroyed projectiles from proto
          const destroyedIds = new Set(
            deltaProto.getDestroyedProjectileIdsList()
          );
          if (destroyedIds.size > 0) {
            newProjectiles = newProjectiles.filter(
              (p) => !destroyedIds.has(p.id)
            );
          }

          return { players: newPlayers, projectiles: newProjectiles };
        });

        // Update separate allPlayerScores if player scores changed in the delta
        if (deltaProto.getPlayersMap().getLength() > 0) {
          setAllPlayerScores((prevScores) => {
            const updatedScores = { ...prevScores };
            deltaProto.getPlayersMap().forEach((playerProto, playerId) => {
              if (
                playerProto.getNickname() &&
                typeof playerProto.getScore() === "number"
              ) {
                updatedScores[playerProto.getNickname()] =
                  playerProto.getScore();
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

      // Listen for new Protobuf event names
      socket.on("initial-game-state-proto", handleInitialStateProto);
      socket.on("game-delta-update-proto", handleDeltaUpdateProto);

      socket.on("player-removed", handlePlayerRemoved);
      socket.on("game-over", handleGameOver);
      socket.on("teleport", handleTeleport);
      socket.on("player-died", handlePlayerDied);
      socket.on("respawn-player", handleRespawnPlayer);

      effectCleanupIntervalId = setInterval(() => {
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

      // Cleanup function
      return () => {
        // Turn off new proto listeners
        socket.off("initial-game-state-proto", handleInitialStateProto);
        socket.off("game-delta-update-proto", handleDeltaUpdateProto);

        // Turn off other listeners
        socket.off("player-removed", handlePlayerRemoved);
        socket.off("game-over", handleGameOver);
        socket.off("teleport", handleTeleport);
        socket.off("player-died", handlePlayerDied);
        socket.off("respawn-player", handleRespawnPlayer);

        Object.values(playerDiedIntervals.current).forEach(clearInterval);
        playerDiedIntervals.current = {};

        if (effectCleanupIntervalId) {
          clearInterval(effectCleanupIntervalId);
        }
      };
    }

    // Cleanup for when the main if-condition is false
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
    socket,
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
