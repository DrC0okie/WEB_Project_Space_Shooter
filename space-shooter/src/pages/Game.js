import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GameCanvas from '../components/GameCanvas';
import ScoreBoard from '../components/ScoreBoard';
import Modal from '../components/Modal';
import { useSocket } from '../context/SocketContext';
import useKeyPress from '../hooks/useKeyPress';
import usePlayerMovement from '../hooks/usePlayerMovement';
import usePlayerShooting from '../hooks/usePlayerShooting';
import useTeleportAbility from '../hooks/useTeleportAbility';
import useGameSocketEvents from '../hooks/useGameSocketEvents';
import gameMusicMP3 from '../assets/sounds/game.mp3';
import AudioPlayer from '../components/AudioPlayer';
import './Game.css';

/**
 * The Game component handles the main game logic and rendering.
 * It includes the game canvas, scoreboards, and game over modal.
 */
const Game = () => {
  const { socket, isSocketConnected } = useSocket();
  const [gameState, setGameState] = useState({ players: {}, projectiles: [] });
  const [allPlayerScores, setAllPlayerScores] = useState({});
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState('');
  const [teleportEffect, setTeleportEffect] = useState([]);
  const [explosions, setExplosions] = useState([]);
  const [respawnCountdown, setRespawnCountdown] = useState({});
  const { keysPressed, spacePressed } = useKeyPress();
  const playersRef = useRef(gameState.players);
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const team = queryParams.get('team');
  const nickname = queryParams.get('nickname');

  // Apply custom CSS class for game page body
  useEffect(() => {
    document.body.classList.add('game-body');
    return () => {
      document.body.classList.remove('game-body');
    };
  }, []);

  // Keep playersRef in sync with gameState.players
  useEffect(() => {
    playersRef.current = gameState.players;
  }, [gameState.players]);

  // Initialize player movement, shooting, and teleport abilities
  usePlayerMovement(socket, playersRef, isSocketConnected, keysPressed);
  usePlayerShooting(socket, playersRef, isSocketConnected, spacePressed);
  useTeleportAbility(socket, isSocketConnected);
  useGameSocketEvents(socket, isSocketConnected, team, nickname, setGameState,
    setAllPlayerScores, setIsGameOver, setWinner, setTeleportEffect,
    setExplosions, setRespawnCountdown);

  // Handle modal close action by navigating back to the home page
  const handleCloseModal = () => {
    setIsGameOver(false);
    navigate('/');
  };

  // Filter players by team
  const redTeamPlayers = Object.values(gameState.players).filter(player => player.team === 'red');
  const blueTeamPlayers = Object.values(gameState.players).filter(player => player.team === 'blue');

  return (
    <div className="game-container">
      <ScoreBoard team="red" players={redTeamPlayers} />
      <div className="canvas-container">
        <GameCanvas players={gameState.players} projectiles={gameState.projectiles} teleportEffect={teleportEffect} respawnCountdown={respawnCountdown} explosions={explosions} />
      </div>
      <ScoreBoard team="blue" players={blueTeamPlayers} />
      <Modal show={isGameOver} onClose={handleCloseModal} title="Game Over">
        <p>{winner} team wins!</p>
        <h3>Scores:</h3>
        <ul>
          {Object.entries(allPlayerScores).map(([nickname, score]) => (
            <li key={nickname}>
              {nickname} : {score} pts
            </li>
          ))}
          {Object.values(gameState.players).map((player) => (
            <li key={player.nickname}>
              {player.nickname} : {player.score} pts
            </li>
          ))}
        </ul>
      </Modal>
      <AudioPlayer mp3Src={gameMusicMP3} />
    </div>
  );
};

export default Game;
