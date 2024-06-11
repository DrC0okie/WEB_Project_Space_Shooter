import React from 'react';
import './ScoreBoard.css';
import PlayerInfo from './PlayerInfo';

/**
 * ScoreBoard component to display the scoreboard for a team.
 *
 * @param {object} props - The props for the component.
 * @param {string} props.team - The team ('red' or 'blue').
 * @param {array} props.players - The array of player objects.
 * @returns {JSX.Element} The rendered scoreboard component.
 */
const ScoreBoard = ({ team, players }) => {
  return (
    <div className={`scoreboard ${team}-team`}>
      <h2>{team.charAt(0).toUpperCase() + team.slice(1)} Team</h2>
      {players.map(player => (
        <PlayerInfo key={player.id} player={player} />
      ))}
    </div>
  );
};

export default ScoreBoard;