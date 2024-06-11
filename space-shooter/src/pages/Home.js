import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AudioPlayer from '../components/AudioPlayer';
import homeMusicMP3 from '../assets/sounds/home.mp3';
import './Home.css';

/**
 * The Home component renders the homepage where players can select their team
 * and enter their nickname before starting the game.
 */
const Home = () => {
  const [team, setTeam] = useState('red'); // State to manage selected team
  const [nickname, setNickname] = useState(''); // State to manage entered nickname
  const [error, setError] = useState(''); // State to manage form error message
  const navigate = useNavigate(); // Hook to programmatically navigate

  // Apply custom CSS class for home page body
  useEffect(() => {
    document.body.classList.add('home-body');
    return () => {
      document.body.classList.remove('home-body');
    };
  }, []);

  // Handle form submission to start the game
  const handleSubmit = (e) => {
    e.preventDefault();
    if (nickname.length < 1 || nickname.length > 12) {
      setError('Name must be between 1 and 12 characters.');
      return;
    }
    setError('');
    navigate(`/game?team=${team}&nickname=${nickname}`);
  };

  return (
    <div className="home-container">
      <h1 className="title">Welcome to Space Shooter</h1>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <label>
            Choose your team:
            <select value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="red">Red</option>
              <option value="blue">Blue</option>
            </select>
          </label>
          <label>
            Enter your name:
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit">Start Game</button>
        </form>
      </div>
      <div className="spaceships">
        <img src="assets/red_ship_rotated.png" alt="Red ship" className="spaceship spaceship1" />
        <img src="assets/blue_ship_rotated.png" alt="Blue ship" className="spaceship spaceship2" />
      </div>
      <footer className="footer">
        Developed by <a href="https://github.com/DrC0okie/WEB_Project_Space_Shooter" target="_blank" rel="noopener noreferrer">DrCo0kie</a>
      </footer>
      <AudioPlayer mp3Src={homeMusicMP3} />
    </div>
  );
};

export default Home;
