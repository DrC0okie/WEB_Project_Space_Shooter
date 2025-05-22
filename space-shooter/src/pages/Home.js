import { useState, useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { useNavigate } from "react-router-dom";
import AudioPlayer from "../components/AudioPlayer";
import homeMusicMP3 from "../assets/sounds/home.mp3";
import "./Home.css";

/**
 * The Home component renders the homepage where players can select their team
 * and enter their nickname before starting the game.
 */
const Home = () => {
  const [nickname, setNickname] = useState(""); // State to manage entered nickname
  const [error, setError] = useState(""); // State to manage form error message
  const navigate = useNavigate(); // Hook to programmatically navigate
  const { socket, isSocketConnected } = useSocket(); // Get socket instance

  const [playerCounts, setPlayerCounts] = useState({
    // State to hold player counts
    redCount: 0,
    blueCount: 0,
    totalCount: 0,
  });

  const NICKNAME_MAX_LENGTH = 8;
  const MAX_PLAYERS_OVERALL = 8;
  const MAX_PLAYERS_PER_TEAM = 4;

  // Apply custom CSS class for home page body
  useEffect(() => {
    document.body.classList.add("home-body");
    return () => {
      document.body.classList.remove("home-body");
    };
  }, []);

  useEffect(() => {
    if (isSocketConnected && socket) {
      // Listener for player counts
      const handlePlayerCounts = (counts) => {
        setPlayerCounts(counts);
      };
      socket.on("player-counts", handlePlayerCounts);

      // Listener for join errors (optional, for better UX)
      const handleJoinError = ({ message }) => {
        setError(message); // Display server-side validation errors
      };
      socket.on("join-error", handleJoinError);
      socket.emit("request-initial-player-counts");

      return () => {
        socket.off("player-counts", handlePlayerCounts);
        socket.off("join-error", handleJoinError);
      };
    }
  }, [isSocketConnected, socket]);

  // Handle form submission to start the game
  const handleStartGame = (selectedTeam) => {
    if (!isSocketConnected) {
      setError("Not connected to server. Please wait.");
      return;
    }

    if (nickname.length < 1 || nickname.length > 8) {
      setError(`Name must be between 1 and 8 characters.`);
      return;
    }
    setError("");
    if (playerCounts.totalCount >= MAX_PLAYERS_OVERALL) {
      setError("Game is full.");
      return;
    }
    if (
      selectedTeam === "red" &&
      playerCounts.redCount >= MAX_PLAYERS_PER_TEAM
    ) {
      setError("Red team is full.");
      return;
    }
    if (
      selectedTeam === "blue" &&
      playerCounts.blueCount >= MAX_PLAYERS_PER_TEAM
    ) {
      setError("Blue team is full.");
      return;
    }
    navigate(`/game?team=${selectedTeam}&nickname=${nickname}`);
  };

  const isGameFull = playerCounts.totalCount >= MAX_PLAYERS_OVERALL;
  const isRedTeamFull = playerCounts.redCount >= MAX_PLAYERS_PER_TEAM;
  const isBlueTeamFull = playerCounts.blueCount >= MAX_PLAYERS_PER_TEAM;

  return (
    <div className="home-container">
      <h1 className="title">Welcome to Space Shooter</h1>
      <div className="card">
        <label htmlFor="nickname-input" className="nickname-label">
          Enter your name:
        </label>
        <input
          id="nickname-input"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={NICKNAME_MAX_LENGTH}
          className="nickname-input"
        />
        {error && <p className="error">{error}</p>}
        {!isSocketConnected && <p className="error">Connecting to server...</p>}

        <p className="team-select-label">Choose your team:</p>
        <div className="team-buttons-container">
          <button
            type="button"
            onClick={() => handleStartGame("red")}
            className="team-button red-team-button"
            disabled={
              !isSocketConnected ||
              isGameFull ||
              isRedTeamFull ||
              !nickname.trim()
            }
          >
            Join Red Team ({playerCounts.redCount}/{MAX_PLAYERS_PER_TEAM})
          </button>
          <button
            type="button"
            onClick={() => handleStartGame("blue")}
            className="team-button blue-team-button"
            disabled={
              !isSocketConnected ||
              isGameFull ||
              isBlueTeamFull ||
              !nickname.trim()
            }
          >
            Join Blue Team ({playerCounts.blueCount}/{MAX_PLAYERS_PER_TEAM})
          </button>
        </div>
      </div>
      <div className="spaceships">
        <img
          src="assets/red_ship_rotated.png"
          alt="Red ship"
          className="spaceship spaceship1"
        />
        <img
          src="assets/blue_ship_rotated.png"
          alt="Blue ship"
          className="spaceship spaceship2"
        />
      </div>
      <footer className="footer">
        Developed by{" "}
        <a
          href="https://github.com/DrC0okie/WEB_Project_Space_Shooter"
          target="_blank"
          rel="noopener noreferrer"
        >
          DrCo0kie
        </a>
      </footer>
      <AudioPlayer mp3Src={homeMusicMP3} />
    </div>
  );
};

export default Home;
