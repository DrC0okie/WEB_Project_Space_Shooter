import React, { useRef, useEffect } from 'react';
import { canvasHeight, canvasWidth, blackHole } from '../constants';
import { drawBackground, drawBlackHole, drawTeleportEffects, drawPlayers, drawProjectiles, drawRespawnCountdowns, drawExplosions } from './canvasUtils';
import redShipSrc from '../assets/red_ship.png';
import blueShipSrc from '../assets/blue_ship.png';
import laserBlueSrc from '../assets/laser-blue.png';
import laserRedSrc from '../assets/laser-red.png';
import blackHoleSrc from '../assets/black_hole.png';
import backgroundSrc from '../assets/background.png';
import teleportEffectSrc from '../assets/teleport_effect.png';
import explosionTilesetSrc from '../assets/explosion_tileset.png';

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
const GameCanvas = ({ players, projectiles, teleportEffect, respawnCountdown, explosions }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Load all images
    const images = {
      backgroundImg: new Image(),
      redShipImg: new Image(),
      blueShipImg: new Image(),
      laserRedImg: new Image(),
      laserBlueImg: new Image(),
      blackHoleImg: new Image(),
      teleportEffectImg: new Image(),
      explosionTileset: new Image()
    };

    images.backgroundImg.src = backgroundSrc;
    images.redShipImg.src = redShipSrc;
    images.blueShipImg.src = blueShipSrc;
    images.laserRedImg.src = laserRedSrc;
    images.laserBlueImg.src = laserBlueSrc;
    images.blackHoleImg.src = blackHoleSrc;
    images.teleportEffectImg.src = teleportEffectSrc;
    images.explosionTileset.src = explosionTilesetSrc;

    // Function to render the game
    const renderGame = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground(context, images.backgroundImg, canvas.width, canvas.height);
      drawBlackHole(context, images.blackHoleImg, blackHole);
      drawTeleportEffects(context, teleportEffect, players, images.teleportEffectImg);
      drawRespawnCountdowns(context, respawnCountdown, players);
      drawExplosions(context, explosions, images.explosionTileset);

      // Filter out dead players for rendering
      const alivePlayers = Object.fromEntries(Object.entries(players).filter(([id, player]) => player.health > 0));
      drawPlayers(context, alivePlayers, images.redShipImg, images.blueShipImg, canvas.width, canvas.height);
      drawProjectiles(context, projectiles, alivePlayers, images.laserRedImg, images.laserBlueImg);
    };

    renderGame();
  }, [players, projectiles, teleportEffect, respawnCountdown, explosions]);

  return <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} />;
};

export default GameCanvas;
