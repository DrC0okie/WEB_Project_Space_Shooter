const canvasWidth = 1280;
const canvasHeight = 720;
const projectileRadius = 4;
const projectileSpeed = 8;
const playerHealth = 100;
const respawnTimeSeconds = 3;

const shipHeight = 32;
const shipWidth = 32;
const shipAngularSpeed = 0.2;
const shipAcceleration = 0.4;
const shipMaxSpeed = 12;
const shipMomentum = 0.95;

const teleportEffectDistance = 200;
const teleportRenderWidth = 8;
const teleportEffectDuration = 200;

const serverPort = 3001;
const serverAddress = "http://localhost:" + serverPort;
const serverRefreshRate = 1000 / 60;

const healthReduction = 10;
const enemyHitScore = 10;
const teammateHitPenalty = 10;
const killScore = 50;
const maxDeaths = 3;

const blackHole = {
  x: 640,
  y: 360,
  radius: 50,
  gravitationalConstant: 10000,
  maxForce: 10,
  attractionRadiusFactor: 4,
};

module.exports = {
  canvasWidth,
  canvasHeight,
  playerHeight: shipHeight,
  playerWidth: shipWidth,
  projectileRadius,
  projectileSpeed,
  playerHealth,
  respawnTimeSeconds,
  shipAngularSpeed,
  shipAcceleration,
  shipMaxSpeed,
  shipMomentum,
  teleportEffectDistance,
  teleportEffectDuration,
  teleportRenderWidth,
  serverPort,
  serverAddress,
  serverRefreshRate,
  healthReduction,
  enemyHitScore,
  teammateHitPenalty,
  killScore,
  maxDeaths,
  blackHole,
};
