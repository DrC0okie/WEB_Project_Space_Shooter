import { useEffect, useRef } from 'react';

/**
 * Custom hook to track the state of keys pressed on the keyboard.
 * 
 * @returns {object} - An object containing references to keysPressed and spacePressed states.
 */
const useKeyPress = () => {
  // useRef to keep track of the state of keys pressed
  const keysPressed = useRef({});
  // useRef to keep track of the space key pressed state
  const spacePressed = useRef(false);
  const spacePressedState = useRef(false);

  useEffect(() => {
    // Function to handle keydown event
    const handleKeyDown = (e) => {
      keysPressed.current[e.key] = true;
      if (e.key === ' ' && !spacePressed.current) {
        spacePressed.current = true;
        spacePressedState.current = true;
      }
    };

    // Function to handle keyup event
    const handleKeyUp = (e) => {
      keysPressed.current[e.key] = false;
      if (e.key === ' ') {
        spacePressed.current = false;
      }
    };

    // Adding event listeners for keydown and keyup
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Cleanup event listeners on component unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Returning references to the keysPressed and spacePressed states
  return { keysPressed, spacePressed: spacePressedState };
};

export default useKeyPress;
