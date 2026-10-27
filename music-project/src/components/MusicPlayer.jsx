
import { useEffect, useRef, useState } from "react";
import "./MusicPlayer.css";

function MusicPlayer({ song, isFavorite = false, onFavorite, onPlay }) {
  const audioRef = useRef(null);
  const recordedSongIdRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    recordedSongIdRef.current = null;
  }, [song?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError("");

    if (!song?.audio_url) {
      audio.removeAttribute("src");
      audio.load();
      return;
    }

    audio.src = song.audio_url;
    audio.load();

    // A browser may block automatic playback.
    audio.play().catch(() => {
      setError("Press Play to start the song.");
    });
  }, [song]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !song?.audio_url) return;

    if (audio.paused) {
      try {
        setError("");
        await audio.play();
      } catch {
        setError("Unable to play this song.");
      }
    } else {
      audio.pause();
    }
  }

  function seek(event) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;

    audio.currentTime = Number(event.target.value);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";

    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);

    return `${minutes}:${String(remaining).padStart(2, "0")}`;
  }

  return (
    <div className="music-player">
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => {
          setIsPlaying(true);
          const songId = song ? String(song.id) : null;
          if (songId && recordedSongIdRef.current !== songId) {
            recordedSongIdRef.current = songId;
            onPlay?.();
          }
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={(e) =>
          setCurrentTime(e.currentTarget.currentTime)
        }
        onLoadedMetadata={(e) =>
          setDuration(e.currentTarget.duration)
        }
        onError={() => setError("Audio failed to load.")}
      />

      <div className="player-song">
        <div className="player-cover">
          {song?.cover_url
            ? <img src={song.cover_url} alt="" />
            : <span aria-hidden="true">♫</span>}
        </div>

        <div>
          <strong>{song?.title || "No song selected"}</strong>
          <span>{song?.artist || "Choose a song"}</span>
        </div>
        <button
          className={isFavorite ? "player-favorite is-favorite" : "player-favorite"}
          onClick={onFavorite}
          aria-label={isFavorite ? "Remove from My Fav" : "Add to My Fav"}
          aria-pressed={isFavorite}
          disabled={!song}
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      </div>

      <div className="player-controls">
        <button
          onClick={togglePlay}
          disabled={!song?.audio_url}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        <div className="player-progress">
          <span>{formatTime(currentTime)}</span>

          <input
            type="range"
            min="0"
            max={duration || 0}
            value={Math.min(currentTime, duration || 0)}
            onChange={seek}
            disabled={!duration}
          />

          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {error && <small className="player-error">{error}</small>}
    </div>
  );
}

export default MusicPlayer;
