import React, { useEffect, useRef, useState } from 'react';
import './AudioPlayer.css';

const AudioPlayer = ({mp3Src}) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
  
    useEffect(() => {
      const currentAudioRef = audioRef.current;
      if (isPlaying) {
        currentAudioRef.play();
      } else {
        currentAudioRef.pause();
      }
      return () => {
        if (currentAudioRef) {
          currentAudioRef.pause();
          currentAudioRef.currentTime = 0;
        }
      };
    }, [isPlaying]);
  
    const togglePlayPause = (e) => {
      setIsPlaying((prev) => !prev);
      e.target.blur(); // Remove focus from the button
    };
  
    return (
      <div>
        <button onClick={togglePlayPause} className="play-pause-button">
          {isPlaying ? 'Pause Music' : 'Play Music'}
        </button>
        <audio ref={audioRef} loop>
          <source src={mp3Src} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  };
  
  export default AudioPlayer;