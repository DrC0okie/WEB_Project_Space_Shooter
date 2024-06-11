import React from 'react';
import './PlayerInfo.css';

/**
 * PlayerInfo component to display player information in the scoreboard.
 *
 * @param {object} props - The props for the component.
 * @param {object} props.player - The player object.
 * @param {string} props.player.nickname - The nickname of the player.
 * @param {string} props.player.team - The team of the player ('red' or 'blue').
 * @param {number} props.player.health - The health of the player (0-100).
 * @param {number} props.player.score - The score of the player.
 * @returns {JSX.Element} The rendered player info component.
 */
const PlayerInfo = ({ player }) => {
  // Calculate the width of the health bar as a percentage
  const healthPercentage = (player.health / 100) * 100;

  return (
    <div className="player-info">
      <p className={`nickname ${player.team}`}>{player.nickname}</p>
      <div className="health-bar-container">
        <div className="health-bar" style={{ width: `${healthPercentage}%` }}></div>
      </div>
      <p>Score: {player.score}</p>
    </div>
  );
};

export default PlayerInfo;
