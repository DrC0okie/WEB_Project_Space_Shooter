import {
  playerWidth,
  playerHeight,
  teleportEffectDistance,
  teleportRenderWidth,
  projectileRadius,
  teleportEffectDuration,
} from "../constants";

const halfPlayerWidth = playerWidth / 2;
const halfPlayerHeight = playerHeight / 2;
const halfPi = Math.PI / 2;
const halfTeleportDistance = teleportEffectDistance / 2;
const halfEffectWidth = teleportRenderWidth / 2;
const NICKNAME_TEXT_OFFSET_Y = -10; // How far above the ship the name appears
const NICKNAME_FONT_SIZE = 12; // Font size in pixels
const NICKNAME_FONT_FAMILY = "'Press Start 2P', cursive";

/**
 * Draws the background image on the canvas.
 *
 * @param {CanvasRenderingContext2D} context - The canvas rendering context.
 * @param {HTMLImageElement} backgroundImg - The background image.
 * @param {number} canvasWidth - The width of the canvas.
 * @param {number} canvasHeight - The height of the canvas.
 */
export const drawBackground = (
  context,
  backgroundImg,
  canvasWidth,
  canvasHeight
) => {
  context.drawImage(backgroundImg, 0, 0, canvasWidth, canvasHeight);
};

/**
 * Draws the black hole image on the canvas.
 *
 * @param {CanvasRenderingContext2D} context - The canvas rendering context.
 * @param {HTMLImageElement} blackHoleImg - The black hole image.
 * @param {object} blackHole - The black hole data.
 * @param {number} blackHole.x - The x-coordinate of the black hole.
 * @param {number} blackHole.y - The y-coordinate of the black hole.
 * @param {number} blackHole.radius - The radius of the black hole.
 */
export const drawBlackHole = (context, blackHoleImg, blackHole) => {
  if (blackHoleImg) {
    const imgRadius = blackHole.radius * 4;
    context.drawImage(
      blackHoleImg,
      blackHole.x - imgRadius,
      blackHole.y - imgRadius,
      imgRadius * 2,
      imgRadius * 2
    );
  }
};

/**
 * Draws teleport effects on the canvas.
 *
 * @param {CanvasRenderingContext2D} context - The canvas rendering context.
 * @param {array} teleportEffects - The teleport effects data.
 * @param {object} players - The players data.
 * @param {HTMLImageElement} teleportEffectImg - The teleport effect image.
 */
export const drawTeleportEffects = (
  context,
  teleportEffects,
  players,
  teleportEffectImg
) => {
  teleportEffects.forEach((effect) => {
    const player = players[effect.playerId];
    const elapsed = Date.now() - effect.timestamp;
    if (elapsed < teleportEffectDuration && player) {
      const alpha = 1 - elapsed / teleportEffectDuration; // Fade out effect
      const effectX = player.x + Math.cos(player.angle + Math.PI); // Center the effect behind the player
      const effectY = player.y + Math.sin(player.angle + Math.PI); // Center the effect behind the player

      context.save();
      context.globalAlpha = alpha;
      context.translate(effectX + halfPlayerWidth, effectY + halfPlayerHeight);
      context.rotate(player.angle + halfPi);
      context.translate(halfEffectWidth, halfTeleportDistance); // Center the effect image
      context.drawImage(
        teleportEffectImg,
        -halfEffectWidth,
        -halfTeleportDistance,
        teleportRenderWidth,
        teleportEffectDistance
      );
      context.restore();
    }
  });
};

export const drawPlayers = (
  context,
  players,
  redShipImg,
  blueShipImg,
  canvasWidth,
  canvasHeight
) => {
  Object.values(players).forEach((player) => {
    // MUTATE the player object for screen wrapping
    // This will affect the 'players' object in GameCanvas's latestPropsRef.current.players
    player.x = (player.x + canvasWidth) % canvasWidth;
    player.y = (player.y + canvasHeight) % canvasHeight;

    // Use the now-mutated player.x and player.y for drawing
    const currentX = player.x;
    const currentY = player.y;

    context.save();
    context.translate(currentX + halfPlayerWidth, currentY + halfPlayerHeight);
    context.rotate(player.angle + halfPi);
    context.translate(-halfPlayerWidth, -halfPlayerHeight);

    const shipImg = player.team === "red" ? redShipImg : blueShipImg;
    context.drawImage(shipImg, 0, 0, playerWidth, playerHeight);
    context.restore();

    context.save();
    context.font = `${NICKNAME_FONT_SIZE}px ${NICKNAME_FONT_FAMILY}`;
    context.textAlign = "center";
    context.fillStyle =
      player.team === "red"
        ? "rgba(255, 150, 150, 1)"
        : "rgba(150, 150, 255, 1)";

    const textX = currentX + halfPlayerWidth;
    const textY = currentY + NICKNAME_TEXT_OFFSET_Y;
    context.fillText(player.nickname || "", textX, textY);
    context.restore();
  });
};

/**
 * Draws projectiles on the canvas.
 *
 * @param {CanvasRenderingContext2D} context - The canvas rendering context.
 * @param {array} projectiles - The projectiles data.
 * @param {object} players - The players data.
 * @param {HTMLImageElement} laserRedImg - The red laser image.
 * @param {HTMLImageElement} laserBlueImg - The blue laser image.
 */
export const drawProjectiles = (
  context,
  projectiles,
  players,
  laserRedImg,
  laserBlueImg
) => {
  projectiles.forEach((projectile) => {
    const owner = players[projectile.owner];
    if (!owner) return;
    const projectileImg = owner.team === "red" ? laserRedImg : laserBlueImg;
    context.save();
    context.translate(projectile.x, projectile.y);
    context.drawImage(
      projectileImg,
      -projectileRadius,
      -projectileRadius,
      projectileRadius * 2,
      projectileRadius * 2
    );
    context.restore();
  });
};

/**
 * Draws respawn countdowns on the canvas.
 *
 * @param {CanvasRenderingContext2D} context - The canvas rendering context.
 * @param {object} respawnCountdown - The respawn countdown data.
 * @param {object} players - The players data.
 */
export const drawRespawnCountdowns = (context, respawnCountdown, players) => {
  Object.keys(respawnCountdown).forEach((playerId) => {
    const player = players[playerId];
    if (player) {
      context.save();
      context.font = playerWidth + "px Arial";
      context.fillStyle = "red";
      context.textAlign = "center";
      context.fillText(
        respawnCountdown[playerId],
        player.x + halfPlayerWidth,
        player.y + halfPlayerHeight
      );
      context.restore();
    }
  });
};

/**
 * Draws explosions on the canvas.
 *
 * @param {CanvasRenderingContext2D} context - The canvas rendering context.
 * @param {array} explosions - The explosions data.
 * @param {HTMLImageElement} explosionTileset - The explosion tileset image.
 */
export const drawExplosions = (context, explosions, explosionTileset) => {
  const frameWidth = 32;
  const frameHeight = 32;
  const totalFrames = 8;
  const frameDuration = 150;
  const scaledWidth = playerWidth * 2;
  const scaledHeight = playerHeight * 2;

  explosions.forEach((explosion) => {
    const elapsed = Date.now() - explosion.timestamp;
    const frameIndex = Math.floor(elapsed / frameDuration);
    if (frameIndex < totalFrames) {
      const sx = frameIndex * frameWidth;
      const sy = 0;
      context.drawImage(
        explosionTileset,
        sx,
        sy,
        frameWidth,
        frameHeight,
        explosion.position.x - halfPlayerWidth,
        explosion.position.y - halfPlayerHeight,
        scaledWidth,
        scaledHeight
      );
    }
  });
};
