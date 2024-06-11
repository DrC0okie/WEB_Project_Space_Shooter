const {
  canvasWidth,
  canvasHeight,
  playerWidth,
  playerHeight,
  playerHealth,
  respawnTimeSeconds,
  projectileRadius,
  teleportEffectDistance,
  serverRefreshRate,
  serverPort,
  healthReduction,
  enemyHitScore,
  teammateHitPenalty,
  killScore,
  maxDeaths,
  projectileSpeed,
  blackHole,
} = require('../src/constants');

// Import utility functions for gravity calculations
const { calculateGravitationalForce, isWithinBlackHole } = require('./gravity');

// Initialize Socket.io server with CORS configuration
const io = require('socket.io')(serverPort, { cors: { origin: "*", }, });

// Define canvas padding and projectile padding values for boundary checks
const canvasPaddingWidth = canvasWidth - playerWidth;
const canvasPaddingHeight = canvasHeight - playerHeight;
const projectilePadding = projectileRadius * 4;
const filterPaddingRight = canvasWidth + projectilePadding;
const filterPaddingBottom = canvasHeight + projectilePadding;
const respawnTimeMs = respawnTimeSeconds * 1000;

// Initialize players and projectiles objects
let players = {};
let projectiles = [];

// Handle new player connections
io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);

  // Handle player joining the game
  socket.on('join-game', (playerInfo) => {
    players[socket.id] = { ...playerInfo, health: playerHealth, score: 0, velocity: { x: 0, y: 0 }, deathCount: 0 };
    io.emit('update-players', players);
    console.log('Player', socket.id, 'joined the game, ', Object.keys(players).length, 'players in total');
  });

  // Handle player movement
  socket.on('move-player', (move) => {
    if (players[socket.id] && players[socket.id].health > 0) {
      Object.assign(players[socket.id], move);
      io.emit('update-players', players);
    }
  });

  // Handle player shooting
  socket.on('shoot', (projectile) => {
    if (players[socket.id] && players[socket.id].health > 0) {
      projectiles.push({ ...projectile, owner: socket.id });
    }
  });

  // Handle player teleportation
  socket.on('teleport-initiate', () => {
    const player = players[socket.id];
    if (player && player.health > 0) {
      const teleportDistance = teleportEffectDistance;
      const targetPosition = {
        x: player.x + Math.cos(player.angle) * teleportDistance,
        y: player.y + Math.sin(player.angle) * teleportDistance,
      };

      // Update player's position
      player.x = targetPosition.x;
      player.y = targetPosition.y;

      io.emit('teleport', { playerId: socket.id, targetPosition });
      io.emit('update-players', players);
    }
  });

  // Handle player disconnection
  socket.on('disconnect', () => {
    removePlayer(socket.id);
    console.log('Player disconnected:', socket.id, Object.keys(players).length, 'players remaining');
  });
});

// Update projectiles' positions and check for collisions
const updateProjectiles = () => {
  projectiles.forEach((projectile) => {
    const gravityForce = calculateGravitationalForce(projectile, blackHole);

    // Update the direction based on the gravitational force
    projectile.direction.x += gravityForce.x;
    projectile.direction.y += gravityForce.y;

    // Normalize the direction to maintain constant speed
    const newDirectionMagnitude = Math.sqrt(projectile.direction.x ** 2 + projectile.direction.y ** 2);
    projectile.direction.x = (projectile.direction.x / newDirectionMagnitude) * projectileSpeed;
    projectile.direction.y = (projectile.direction.y / newDirectionMagnitude) * projectileSpeed;

    // Update the position based on the updated direction
    projectile.x += projectile.direction.x;
    projectile.y += projectile.direction.y;

  });

  // Remove projectiles that are out of bounds or within the black hole's radius
  projectiles = projectiles.filter(projectile => {
    return (
      projectile.x >= -projectilePadding && projectile.x <= filterPaddingRight &&
      projectile.y >= -projectilePadding && projectile.y <= filterPaddingBottom &&
      !isWithinBlackHole(projectile, blackHole) && !projectile.hit
    );
  });
};

// Check for collisions between projectiles and players
const checkCollisions = () => {
  projectiles.forEach((projectile) => {
    Object.keys(players).forEach((id) => {
      const player = players[id];
      if (projectile.owner !== id && player.health > 0) {
        if (
          projectile.x >= player.x &&
          projectile.x <= player.x + playerWidth &&
          projectile.y >= player.y &&
          projectile.y <= player.y + playerHeight
        ) {
          player.health -= healthReduction;
          projectile.hit = true;

          const shooter = players[projectile.owner];
          if (shooter) {
            if (shooter.team !== player.team) { // Hit an enemy
              shooter.score += enemyHitScore;
              if (player.health <= 0) {
                shooter.score += killScore;
              }
            } else { // Hit a teammate
              shooter.score -= teammateHitPenalty;
            }
          }

          if (player.health <= 0) {
            player.health = 0;
            player.deathCount += 1;
            console.log('Player', id, 'died', player.deathCount, 'times');

            // Emit an event to notify the client about the player death
            io.emit('player-died', { playerId: id, position: { x: player.x, y: player.y } });

            if (player.deathCount >= maxDeaths) {
              checkGameOver(id);
            } else {
              // Delay respawn
              setTimeout(() => {
                // Respawn player at random location
                player.x = Math.floor(Math.random() * canvasPaddingWidth);
                player.y = Math.floor(Math.random() * canvasPaddingHeight);
                player.health = playerHealth;
                io.emit('respawn-player', { playerId: id, player });
                io.emit('update-players', players);
              }, respawnTimeMs);
            }
          }
        }
      }
    });
  });
};

// Remove a player from the game
const removePlayer = (playerId) => {
  console.log('Player', playerId, 'is out of the game');
  io.emit('player-removed', playerId);
  delete players[playerId];
  io.emit('update-players', players);
};

// Check if the game is over by counting the number of players left in each team
const checkGameOver = (playerId) => {
  const teamDeathCounts = { red: 0, blue: 0 };
  const teamSizes = { red: 0, blue: 0 };

  // Count team sizes and deaths before removing the player
  Object.values(players).forEach(player => {
    if (player.team === 'red') {
      teamSizes.red += 1;
      if (player.deathCount >= maxDeaths) {
        teamDeathCounts.red += 1;
      }
    } else if (player.team === 'blue') {
      teamSizes.blue += 1;
      if (player.deathCount >= maxDeaths) {
        teamDeathCounts.blue += 1;
      }
    }
  });

  // Remove the player after counting
  removePlayer(playerId);

  // Check if any team has no players left and declare the winning team
  if (teamDeathCounts.red >= teamSizes.red) {
    console.log('Blue team wins!');
    io.emit('game-over', { winner: 'blue' });
  } else if (teamDeathCounts.blue >= teamSizes.blue) {
    console.log('Red team wins!');
    io.emit('game-over', { winner: 'red' });
  }
};

// Emit updates for players and projectiles
const emitUpdates = () => {
  io.emit('update-players', players);
  if (projectiles.length > 0) {
    io.emit('update-projectiles', projectiles);
  }
};

// Set an interval to update the game state regularly
setInterval(() => {
  updateProjectiles();
  checkCollisions();
  emitUpdates();
}, serverRefreshRate);

console.log('Server is running on port ', serverPort);
