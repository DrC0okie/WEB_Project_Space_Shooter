import React, { useRef, useEffect, useState } from "react"; // Ensure useState is imported
import { canvasHeight, canvasWidth, blackHole } from "../constants"; // teleportEffectDuration no longer needed here
import {
  drawBackground,
  drawBlackHole,
  drawTeleportEffects,
  drawPlayers,
  drawProjectiles,
  drawRespawnCountdowns,
  drawExplosions,
} from "./canvasUtils";
import redShipSrc from "../assets/red_ship.png";
import blueShipSrc from "../assets/blue_ship.png";
import laserBlueSrc from "../assets/laser-blue.png";
import laserRedSrc from "../assets/laser-red.png";
import blackHoleSrc from "../assets/black_hole.png";
import backgroundSrc from "../assets/background.png";
import teleportEffectSrc from "../assets/teleport_effect.png";
import explosionTilesetSrc from "../assets/explosion_tileset.png";

/**
 * GameCanvas component to render the game canvas.
 *
 * @param {object} props - The props for the component.
 * @param {object} props.players - The players in the game.
 * @param {array} props.projectiles - The projectiles in the game.
 * @param {array} props.teleportEffect - The teleport effects.
 * @param {object} props.respawnCountdown - The respawn countdowns.
 * @param {array} props.explosions - The explosions in the game.
 * @returns {JSX.Element} The rendered game canvas component.
 */
const GameCanvas = ({
  players,
  projectiles,
  teleportEffect,
  respawnCountdown,
  explosions,
}) => {
  const canvasRef = useRef(null);
  const [loadedImages, setLoadedImages] = useState(null);
  const animationFrameId = useRef(null);

  // THIS IS THE KEY CHANGE: Define latestPropsRef at the top level
  const latestPropsRef = useRef({
    players,
    projectiles,
    teleportEffect,
    respawnCountdown,
    explosions,
  });

  // Effect 1: Load images ONCE when component mounts
  useEffect(() => {
    const imagesToLoad = {
      backgroundImg: backgroundSrc,
      redShipImg: redShipSrc,
      blueShipImg: blueShipSrc,
      laserRedImg: laserRedSrc,
      laserBlueImg: laserBlueSrc,
      blackHoleImg: blackHoleSrc,
      teleportEffectImg: teleportEffectSrc,
      explosionTileset: explosionTilesetSrc,
    };

    const imagePromises = Object.entries(imagesToLoad).map(([name, src]) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ name, img });
        img.onerror = (err) =>
          reject(new Error(`Failed to load image ${name}: ${src}`));
        img.src = src;
      });
    });

    Promise.all(imagePromises)
      .then((results) => {
        const images = results.reduce((acc, { name, img }) => {
          acc[name] = img;
          return acc;
        }, {});
        setLoadedImages(images);
      })
      .catch((error) => {
        console.error("Error loading images:", error);
      });
  }, []); // Empty dependency array: runs only once on mount

  // Effect 2: Update latestPropsRef.current WHENEVER props change
  // THIS IS ALSO AT THE TOP LEVEL
  useEffect(() => {
    latestPropsRef.current = {
      players,
      projectiles,
      teleportEffect,
      respawnCountdown,
      explosions,
    };
  }, [players, projectiles, teleportEffect, respawnCountdown, explosions]);

  // Effect 3: The main rendering loop
  useEffect(() => {
    if (!loadedImages || !canvasRef.current) {
      return; // Don't start if images or canvas aren't ready
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    const renderGameLoop = () => {
      // Access the most current props via the ref
      const currentProps = latestPropsRef.current;

      context.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground(
        context,
        loadedImages.backgroundImg,
        canvas.width,
        canvas.height
      );
      drawBlackHole(context, loadedImages.blackHoleImg, blackHole);

      drawTeleportEffects(
        context,
        currentProps.teleportEffect,
        currentProps.players,
        loadedImages.teleportEffectImg
      );
      drawRespawnCountdowns(
        context,
        currentProps.respawnCountdown,
        currentProps.players
      );
      drawExplosions(
        context,
        currentProps.explosions,
        loadedImages.explosionTileset
      );

      const alivePlayers = Object.fromEntries(
        Object.entries(currentProps.players).filter(
          ([id, player]) => player.health > 0
        )
      );
      drawPlayers(
        context,
        alivePlayers,
        loadedImages.redShipImg,
        loadedImages.blueShipImg,
        canvas.width,
        canvas.height
      );
      drawProjectiles(
        context,
        currentProps.projectiles,
        alivePlayers,
        loadedImages.laserRedImg,
        loadedImages.laserBlueImg
      );

      animationFrameId.current = requestAnimationFrame(renderGameLoop);
    };

    // Start the rendering loop
    animationFrameId.current = requestAnimationFrame(renderGameLoop);

    // Cleanup function for this effect
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [loadedImages]); // This effect re-runs ONLY if `loadedImages` changes.

  if (!loadedImages) {
    return <div>Loading game assets...</div>;
  }

  return <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} />;
};

export default GameCanvas;
