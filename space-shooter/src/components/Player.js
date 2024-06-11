import React from 'react';
import { playerHeight, playerWidth } from '../constants';

/**
 * Player component to render a player on the game canvas.
 *
 * @param {object} props - The props for the component.
 * @param {object} props.position - The position of the player.
 * @param {number} props.position.x - The x-coordinate of the player.
 * @param {number} props.position.y - The y-coordinate of the player.
 * @param {string} props.team - The team of the player ('red' or 'blue').
 * @returns {JSX.Element} The rendered player component.
 */
const Player = ({ position, team }) => {

  // Define the style for the player based on its position and team color
  const style = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    width: playerWidth + 'px',
    height: playerHeight + 'px',
    backgroundColor: team === 'red' ? 'red' : 'blue',
  };

  return <div style={style}></div>;
};

export default Player;
