import { useState } from "react";
import {
  Search,
  Music2,
  Play,
  Home,
  Library,
} from "lucide-react";
import "./App.css";

const demoSongs = [
  { id: 1, title: "Afterglow", artist: "Demo Artist" },
  { id: 2, title: "Midnight Drive", artist: "Demo Artist" },
  { id: 3, title: "Ocean Lights", artist: "Demo Artist" },
];

function App() {
  const [search, setSearch] = useState("");

  const songs = demoSongs
    .filter((song) =>
      song.title.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="logo">
          <Music2 size={28} /> VibeFlow
        </h2>

        <nav>
          <p><Home size={19} /> Home</p>
          <p><Search size={19} /> Search</p>
          <p><Library size={19} /> Your Library</p>
        </nav>
      </aside>

      <main className="content">
        <h1>Your music. Your vibe.</h1>
        <p className="subtitle">
          Discover your favorite sounds.
        </p>

        <div className="search-box">
          <Search size={20} />
          <input
            placeholder="Search songs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <h2>All Songs</h2>

        <div className="song-list">
          {songs.map((song) => (
            <div className="song" key={song.id}>
              <div className="song-icon">
                <Music2 size={22} />
              </div>

              <div className="song-info">
                <strong>{song.title}</strong>
                <span>{song.artist}</span>
              </div>

              <button
                className="play-button"
                aria-label={`Play ${song.title}`}
                disabled
                title="Playback will be added in Step 5"
              >
                <Play size={19} />
              </button>
            </div>
          ))}
          {songs.length === 0 && <p>No songs found.</p>}
        </div>
      </main>
    </div>
  );
}

export default App;
