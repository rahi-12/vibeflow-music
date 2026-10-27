import { useState } from "react";

function SongCard({ song, isFavorite, onFavorite, onPlay }) {
  const [coverFailed, setCoverFailed] = useState(false);

  return (
    <article className="song-card">
      <div className="song-artwork">
        {song.cover_url && !coverFailed ? (
          <img
            src={song.cover_url}
            alt=""
            loading="lazy"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <span aria-hidden="true">♫</span>
        )}
        <button
          className="card-play-button"
          onClick={onPlay}
          aria-label={`Play ${song.title}`}
          disabled={!song.audio_url}
        >
          ▶
        </button>
      </div>
      <div className="song-card-details">
        <div className="song-card-copy">
          <strong title={song.title}>{song.title}</strong>
          <span title={song.artist}>{song.artist}</span>
          {Number.isFinite(song.play_count) && (
            <span className="song-play-count">{song.play_count} plays</span>
          )}
        </div>
        <button
          className={isFavorite ? "favorite-button is-favorite" : "favorite-button"}
          onClick={onFavorite}
          aria-label={isFavorite ? `Remove ${song.title} from My Fav` : `Add ${song.title} to My Fav`}
          aria-pressed={isFavorite}
          title={isFavorite ? "Remove from My Fav" : "Add to My Fav"}
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      </div>
    </article>
  );
}

export default SongCard;
