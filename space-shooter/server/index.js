const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const {
  Player,
  Projectile,
  MovedProjectileUpdate,
  GameDeltaUpdate,
  InitialGameState,
  Vec2,
} = require("../src/proto_gen/state_pb");

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

// Define canvas padding and projectile padding values for boundary checks
const canvasPaddingWidth = canvasWidth - playerWidth;
const canvasPaddingHeight = canvasHeight - playerHeight;
const projectilePadding = projectileRadius * 4;
const filterPaddingRight = canvasWidth + projectilePadding;
const filterPaddingBottom = canvasHeight + projectilePadding;
const respawnTimeMs = respawnTimeSeconds * 1000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Attach Socket.IO to the http server
  cors: {
    origin: "*",
  },
});

// Serve static files from the React build
// The Dockerfile places the build into ./public/build
app.use(express.static(path.join(__dirname, "../public/build")));

// Serve index.html for any other routes (for client-side routing)
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/build", "index.html"));
});

// Initialize players and projectiles objects
let players = {};
let projectiles = [];
let newProjectilesBuffer = []; // To collect projectiles created in the current tick
let nextProjectileId = 0;

// Function to get current team counts
function getTeamCounts() {
  let redCount = 0;
  let blueCount = 0;
  Object.values(players).forEach((p) => {
    if (p.team === "red") redCount++;
    else if (p.team === "blue") blueCount++;
  });
  return { redCount, blueCount, totalCount: redCount + blueCount };
}

// Handle new player connections
io.on("connection", (socket) => {
  console.log("New player connected:", socket.id);

  // Emit current player counts to newly connected socket (for Home page)
  socket.emit("player-counts", getTeamCounts());

  socket.on("request-initial-player-counts", () => {
    socket.emit("player-counts", getTeamCounts());
  });

  // Handle player joining the game
  socket.on("join-game", (playerInfo) => {
    const { nickname, team } = playerInfo; // Destructure team here

    // Nickname Validation
    if (
      !nickname ||
      typeof nickname !== "string" ||
      nickname.length < 1 ||
      nickname.length > 8
    ) {
      socket.emit("join-error", {
        message: `Nickname must be between 1 and 8 characters.`,
      });
      console.log(`Player ${socket.id} rejected: invalid nickname.`);
      return;
    }

    const currentCounts = getTeamCounts();

    // Overall Player Cap Validation
    if (currentCounts.totalCount >= 8) {
      socket.emit("join-error", { message: "Game is full." });
      console.log(`Player ${socket.id} rejected: game full.`);
      return;
    }

    // Team Cap Validation
    if (team === "red" && currentCounts.redCount >= 4) {
      socket.emit("join-error", { message: "Red team is full." });
      console.log(`Player ${socket.id} rejected: red team full.`);
      return;
    }
    if (team === "blue" && currentCounts.blueCount >= 4) {
      socket.emit("join-error", { message: "Blue team is full." });
      console.log(`Player ${socket.id} rejected: blue team full.`);
      return;
    }

    const newPlayerId = socket.id;
    players[newPlayerId] = {
      nickname: nickname,
      team: team,
      x: Math.floor(Math.random() * (canvasWidth - playerWidth)),
      y: Math.floor(Math.random() * (canvasHeight - playerHeight)),
      angle: 0,
      health: playerHealth,
      score: 0,
      velocity: { x: 0, y: 0 },
      deathCount: 0,
      changedSinceLastTick: true,
      isTeleporting: false,
    };

    const initialStateProto = new InitialGameState();
    initialStateProto.setYourId(newPlayerId);

    const allPlayersMap = initialStateProto.getAllPlayersMap();
    Object.values(players).forEach((pData) => {
      const playerProto = new Player();
      playerProto.setId(pData.id || newPlayerId);
      playerProto.setNickname(pData.nickname);
      playerProto.setTeam(pData.team);
      const posVec = new Vec2();
      posVec.setX(pData.x);
      posVec.setY(pData.y);
      playerProto.setPosition(posVec);
      playerProto.setAngle(pData.angle);
      const velVec = new Vec2();
      velVec.setX(pData.velocity.x);
      velVec.setY(pData.velocity.y);
      playerProto.setVelocity(velVec);
      playerProto.setHealth(pData.health);
      playerProto.setScore(pData.score);
      playerProto.setDeathCount(pData.deathCount);
      allPlayersMap.set(pData.id || newPlayerId, playerProto);
    });

    projectiles.forEach((projData) => {
      const projectileProto = new Projectile();
      projectileProto.setId(projData.id);
      projectileProto.setOwnerId(projData.owner);
      const projPosVec = new Vec2();
      projPosVec.setX(projData.x);
      projPosVec.setY(projData.y);
      projectileProto.setPosition(projPosVec);
      const projDirVec = new Vec2();
      projDirVec.setX(projData.direction.x);
      projDirVec.setY(projData.direction.y);
      projectileProto.setDirection(projDirVec);
      initialStateProto.addAllProjectiles(projectileProto);
    });

    const serializedInitialState = initialStateProto.serializeBinary(); // Uint8Array
    socket.emit("initial-game-state-proto", serializedInitialState);

    console.log(
      "Player",
      newPlayerId,
      `(${players[newPlayerId].nickname})`,
      "joined",
      team,
      "team.",
      Object.keys(players).length,
      "players in total."
    );
    io.emit("player-counts", getTeamCounts());
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
      const teleportDistance = teleportEffectDistance;
      const targetPosition = {
        x: player.x + Math.cos(player.angle) * teleportDistance,
        y: player.y + Math.sin(player.angle) * teleportDistance,
      };

      player.x = targetPosition.x;
      player.y = targetPosition.y;
      player.changedSinceLastTick = true;
      player.isTeleporting = true;

      io.emit("teleport", { playerId: socket.id, targetPosition });

      // Reset the flag after a very short delay (e.g., one or two game ticks)
      setTimeout(() => {
        if (players[socket.id]) {
          // Player might disconnect
          players[socket.id].isTeleporting = false;
        }
      }, serverRefreshRate * 2);
    }
  });

  // Handle player disconnection
  socket.on("disconnect", () => {
    const player = players[socket.id];
    if (player) {
      const wasRemoved = removePlayer(socket.id);
      if (wasRemoved) {
        console.log(
          "Player disconnected:",
          socket.id,
          Object.keys(players).length,
          "players remaining"
        );
        io.emit("player-counts", getTeamCounts());
      }
    }
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
      destroyedProjectileIds.add(projectile.id);
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
  if (players[playerId]) {
    io.emit("player-removed", playerId);
    delete players[playerId];
    io.emit("update-players", players);
    return true; // Indicate player was found and removed
  }
  return false; // Indicate player was not found
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
  }
};

/// Game Loop
setInterval(() => {
  const projectileChanges = updateProjectilesAndDetectCollisions();
  const playerUpdates = {}; // Still collect JS objects first for easier logic

  Object.keys(players).forEach((id) => {
    const player = players[id];
    if (player.changedSinceLastTick) {
      const { changedSinceLastTick, isTeleporting, ...playerDataToSend } =
        player; // Exclude internal flags
      playerUpdates[id] = playerDataToSend;
      player.changedSinceLastTick = false;
    }
  });

  let somethingChanged = false;
  const deltaUpdateProto = new GameDeltaUpdate(); // Create the protobuf message

  // Populate Player updates
  if (Object.keys(playerUpdates).length > 0) {
    const playersMap = deltaUpdateProto.getPlayersMap();
    Object.entries(playerUpdates).forEach(([pId, pData]) => {
      const playerProto = new Player();
      playerProto.setId(pId);
      playerProto.setNickname(pData.nickname);
      playerProto.setTeam(pData.team);
      const posVec = new Vec2();
      posVec.setX(pData.x);
      posVec.setY(pData.y);
      playerProto.setPosition(posVec);
      playerProto.setAngle(pData.angle);
      const velVec = new Vec2();
      velVec.setX(pData.velocity.x);
      velVec.setY(pData.velocity.y);
      playerProto.setVelocity(velVec);
      playerProto.setHealth(pData.health);
      playerProto.setScore(pData.score);
      playerProto.setDeathCount(pData.deathCount);
      playersMap.set(pId, playerProto);
    });
    somethingChanged = true;
  }

  // Populate New Projectiles
  if (newProjectilesBuffer.length > 0) {
    newProjectilesBuffer.forEach((projData) => {
      const projectileProto = new Projectile();
      projectileProto.setId(projData.id);
      projectileProto.setOwnerId(projData.owner);
      const projPosVec = new Vec2();
      projPosVec.setX(projData.x);
      projPosVec.setY(projData.y);
      projectileProto.setPosition(projPosVec);
      const projDirVec = new Vec2();
      projDirVec.setX(projData.direction.x);
      projDirVec.setY(projData.direction.y);
      projectileProto.setDirection(projDirVec);
      deltaUpdateProto.addNewProjectiles(projectileProto);
    });
    somethingChanged = true;
  }

  // Populate Moved Projectiles
  if (Object.keys(projectileChanges.updatedProjectilePositions).length > 0) {
    Object.entries(projectileChanges.updatedProjectilePositions).forEach(
      ([idStr, posData]) => {
        const movedProjectileUpdateProto = new MovedProjectileUpdate();
        movedProjectileUpdateProto.setId(parseInt(idStr));
        const projPosVec = new Vec2();
        projPosVec.setX(posData.x);
        projPosVec.setY(posData.y);
        movedProjectileUpdateProto.setPosition(projPosVec);
        deltaUpdateProto.addMovedProjectiles(movedProjectileUpdateProto);
      }
    );
    somethingChanged = true;
  }

  // Populate Destroyed Projectile IDs
  if (projectileChanges.destroyedProjectileIds.length > 0) {
    projectileChanges.destroyedProjectileIds.forEach((id) => {
      deltaUpdateProto.addDestroyedProjectileIds(id);
    });
    somethingChanged = true;
  }

  if (somethingChanged) {
    const serializedDelta = deltaUpdateProto.serializeBinary(); // This is a Uint8Array
    io.emit("game-delta-update-proto", serializedDelta);
  }
  newProjectilesBuffer = [];
}, serverRefreshRate);

// Start the server
server.listen(serverPort, () => {
  console.log(`Server is running on port ${serverPort}`);
  console.log(
    `Serving static files from: ${path.join(__dirname, "../public/build")}`
  );
});
