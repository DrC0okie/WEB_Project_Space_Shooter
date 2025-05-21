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
} = require("../src/constants");

// Import utility functions for gravity calculations
const { calculateGravitationalForce, isWithinBlackHole } = require("./gravity");

// Initialize Socket.io server with CORS configuration
const io = require("socket.io")(serverPort, { cors: { origin: "*" } });

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
let newProjectilesBuffer = []; // To collect projectiles created in the current tick
let nextProjectileId = 0;

// Handle new player connections
io.on("connection", (socket) => {
  console.log("New player connected:", socket.id);

  // Handle player joining the game
  socket.on("join-game", (playerInfo) => {
    const newPlayerId = socket.id;
    players[newPlayerId] = {
      ...playerInfo,
      health: playerHealth,
      score: 0,
      velocity: { x: 0, y: 0 },
      deathCount: 0,
      changedSinceLastTick: true,
      isTeleporting: false,
    };

    // Send full current state only to the newly connected player
    socket.emit("initial-game-state", {
      allPlayers: players, // Current state of all players
      allProjectiles: projectiles, // Current state of all projectiles
      yourId: newPlayerId,
    });

    console.log(
      "Player",
      newPlayerId,
      "joined the game, ",
      Object.keys(players).length,
      "players in total"
    );
  });

  // Handle player movement
  socket.on("move-player", (move) => {
    const player = players[socket.id];
    // Only process move if player exists, is alive, and not teleporting
    if (player && player.health > 0 && !player.isTeleporting) {
      Object.assign(player, move);
      player.changedSinceLastTick = true;
    }
  });

  // Handle player shooting
  socket.on("shoot", (clientProjectileData) => {
    const player = players[socket.id];
    if (player && player.health > 0) {
      const newProjectile = {
        id: nextProjectileId++, // Give projectile an ID
        x: clientProjectileData.x, // Ideally, server calculates this based on its state
        y: clientProjectileData.y,
        direction: clientProjectileData.direction,
        owner: socket.id,
      };
      projectiles.push(newProjectile);
      newProjectilesBuffer.push(newProjectile); // Add to a buffer for new projectiles this tick
    }
  });

  // Handle player teleportation
  socket.on("teleport-initiate", () => {
    const player = players[socket.id];
    if (player && player.health > 0 && !player.isTeleporting) {
      // Check !player.isTeleporting
      const teleportDistance = teleportEffectDistance;
      const targetPosition = {
        x: player.x + Math.cos(player.angle) * teleportDistance,
        y: player.y + Math.sin(player.angle) * teleportDistance,
      };

      player.x = targetPosition.x;
      player.y = targetPosition.y;
      player.changedSinceLastTick = true;
      player.isTeleporting = true; // Set the flag

      io.emit("teleport", { playerId: socket.id, targetPosition });

      // Reset the flag after a very short delay (e.g., one or two game ticks)
      // This gives the teleported position a chance to "settle" in the delta update
      // without being immediately overwritten by a move packet that was already in flight.
      setTimeout(() => {
        if (players[socket.id]) {
          // Player might disconnect
          players[socket.id].isTeleporting = false;
          // console.log(`[SERVER] Player ${socket.id} teleporting flag reset.`);
        }
      }, serverRefreshRate * 2); // e.g., 2 server ticks
    }
  });
  // Handle player disconnection
  socket.on("disconnect", () => {
    removePlayer(socket.id);
    console.log(
      "Player disconnected:",
      socket.id,
      Object.keys(players).length,
      "players remaining"
    );
  });
});

const updateProjectilesAndDetectCollisions = () => {
  const destroyedProjectileIds = new Set();
  const updatedProjectilePositions = {}; // Store { id: {x, y} } for moved projectiles

  projectiles = projectiles.filter((projectile) => {
    if (projectile.hit) {
      // 'hit' flag set during collision check
      destroyedProjectileIds.add(projectile.id);
      return false;
    }

    const gravityForce = calculateGravitationalForce(projectile, blackHole);
    projectile.direction.x += gravityForce.x;
    projectile.direction.y += gravityForce.y;
    const newDirectionMagnitude = Math.sqrt(
      projectile.direction.x ** 2 + projectile.direction.y ** 2
    );
    if (newDirectionMagnitude === 0) {
      // Avoid division by zero
      destroyedProjectileIds.add(projectile.id); // Or handle differently
      return false;
    }
    projectile.direction.x =
      (projectile.direction.x / newDirectionMagnitude) * projectileSpeed;
    projectile.direction.y =
      (projectile.direction.y / newDirectionMagnitude) * projectileSpeed;
    projectile.x += projectile.direction.x;
    projectile.y += projectile.direction.y;

    // Check bounds / black hole
    const isActive =
      projectile.x >= -projectilePadding &&
      projectile.x <= filterPaddingRight &&
      projectile.y >= -projectilePadding &&
      projectile.y <= filterPaddingBottom &&
      !isWithinBlackHole(projectile, blackHole);

    if (!isActive) {
      destroyedProjectileIds.add(projectile.id);
      return false;
    }

    // If it's an existing projectile that moved and is still active
    updatedProjectilePositions[projectile.id] = {
      x: projectile.x,
      y: projectile.y,
    };
    return true;
  });

  // Collision Checking (modifies player health, score and projectile.hit)
  projectiles.forEach((projectile) => {
    if (projectile.hit) return; // Already processed

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
          player.changedSinceLastTick = true; // Mark player as changed
          projectile.hit = true; // Mark projectile for removal in next filter pass
          destroyedProjectileIds.add(projectile.id);

          const shooter = players[projectile.owner];
          if (shooter) {
            if (shooter.team !== player.team) {
              shooter.score += enemyHitScore;
              if (player.health <= 0) shooter.score += killScore;
            } else {
              shooter.score -= teammateHitPenalty;
            }
            shooter.changedSinceLastTick = true; // Mark shooter as changed
          }

          if (player.health <= 0) {
            player.health = 0;
            player.deathCount += 1;
            player.changedSinceLastTick = true;
            io.emit("player-died", {
              playerId: id,
              position: { x: player.x, y: player.y },
            });

            if (player.deathCount >= maxDeaths) {
              // checkGameOver will handle removal, which is a form of "change"
              checkGameOver(id); // This might remove the player
            } else {
              setTimeout(() => {
                player.x = Math.floor(Math.random() * canvasPaddingWidth);
                player.y = Math.floor(Math.random() * canvasPaddingHeight);
                player.health = playerHealth;
                player.changedSinceLastTick = true;
                // Send specific respawn event, client will update based on this
                // Or, the 'changedSinceLastTick' will ensure it's in the next delta update
                io.emit("respawn-player", { playerId: id, player });
              }, respawnTimeMs);
            }
          }
        }
      }
    });
  });
  // Refilter projectiles to remove those marked as hit during collision
  projectiles = projectiles.filter((p) => !p.hit);

  return {
    updatedProjectilePositions,
    destroyedProjectileIds: Array.from(destroyedProjectileIds),
  };
};

// Remove a player from the game
const removePlayer = (playerId) => {
  console.log("Player", playerId, "is out of the game");
  io.emit("player-removed", playerId);
  delete players[playerId];
  io.emit("update-players", players);
};

// Check if the game is over by counting the number of players left in each team
const checkGameOver = (playerIdJustDied) => {
  // Store the team of the player who just triggered the potential game over
  const dyingPlayerTeam = players[playerIdJustDied]?.team;
  let redTeamActivePlayers = 0;
  let blueTeamActivePlayers = 0;

  Object.values(players).forEach((p) => {
    if (p.deathCount < maxDeaths) {
      if (p.team === "red") redTeamActivePlayers++;
      else if (p.team === "blue") blueTeamActivePlayers++;
    }
  });

  let winner = null;
  // Check if the team of the player who just died (or any player that hit max deaths) has no active players left
  if (
    dyingPlayerTeam === "red" &&
    redTeamActivePlayers === 0 &&
    Object.values(players).some((p) => p.team === "red")
  ) {
    winner = "blue";
  } else if (
    dyingPlayerTeam === "blue" &&
    blueTeamActivePlayers === 0 &&
    Object.values(players).some((p) => p.team === "blue")
  ) {
    winner = "red";
  }
  // Handle scenario where one team has no players left at all (e.g. all disconnected)
  const totalRedPlayers = Object.values(players).filter(
    (p) => p.team === "red"
  ).length;
  const totalBluePlayers = Object.values(players).filter(
    (p) => p.team === "blue"
  ).length;

  if (
    totalRedPlayers > 0 &&
    blueTeamActivePlayers === 0 &&
    totalBluePlayers > 0 &&
    !winner
  ) {
    // Blue team has players, but none are active
    winner = "red";
  } else if (
    totalBluePlayers > 0 &&
    redTeamActivePlayers === 0 &&
    totalRedPlayers > 0 &&
    !winner
  ) {
    // Red team has players, but none are active
    winner = "blue";
  }

  if (winner) {
    console.log(`${winner} team wins!`);
    io.emit("game-over", { winner });
    // Potentially reset game or clear players for a new round after a delay
  }
};

/// Game Loop
setInterval(() => {
  const projectileChanges = updateProjectilesAndDetectCollisions();
  const playerUpdates = {};

  Object.keys(players).forEach((id) => {
    const player = players[id];
    if (player.changedSinceLastTick) {
      // Create a snapshot of the player data to send
      // Avoid sending internal flags like 'changedSinceLastTick'
      const { changedSinceLastTick, ...playerDataToSend } = player;
      playerUpdates[id] = playerDataToSend;
      player.changedSinceLastTick = false; // Reset flag
    }
  });

  // Construct the delta update payload
  const deltaUpdate = {};
  let somethingChanged = false;

  if (Object.keys(playerUpdates).length > 0) {
    deltaUpdate.players = playerUpdates;
    somethingChanged = true;
  }
  if (newProjectilesBuffer.length > 0) {
    // Send a copy of the buffer's contents
    deltaUpdate.newProjectiles = newProjectilesBuffer.map((p) => ({ ...p }));
    somethingChanged = true;
  }
  if (Object.keys(projectileChanges.updatedProjectilePositions).length > 0) {
    deltaUpdate.movedProjectiles = projectileChanges.updatedProjectilePositions;
    somethingChanged = true;
  }
  if (projectileChanges.destroyedProjectileIds.length > 0) {
    deltaUpdate.destroyedProjectiles = projectileChanges.destroyedProjectileIds;
    somethingChanged = true;
  }

  if (somethingChanged) {
    io.emit("game-delta-update", deltaUpdate);
  }
  newProjectilesBuffer = [];
}, serverRefreshRate);

console.log("Server is running on port ", serverPort);
