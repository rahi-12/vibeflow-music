import { useEffect, useMemo, useState } from "react";
import MusicPlayer from "./components/MusicPlayer";
import SongCard from "./components/SongCard";
import { supabase } from "./services/supabase";
import "./App.css";

const SONG_FIELDS = "id, title, artist, album, audio_url, cover_url";
const alphabetical = (first, second) =>
  first.localeCompare(second, undefined, { sensitivity: "base" });

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [songs, setSongs] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [songsError, setSongsError] = useState("");
  const [playError, setPlayError] = useState("");
  const [favoritesError, setFavoritesError] = useState("");
  const [popularityReady, setPopularityReady] = useState(true);
  const [view, setView] = useState("home");
  const [selectedArtist, setSelectedArtist] = useState("");
  const [search, setSearch] = useState("");
  const [authMode, setAuthMode] = useState("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [selectedSong, setSelectedSong] = useState(null);

  useEffect(() => {
    let active = true;

    async function readSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) setAuthError(error.message);
      setSession(data?.session ?? null);
      setAuthLoading(false);
    }

    readSession();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthError("");
      setAuthMessage("");
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSongs() {
      setLoading(true);
      setSongsError("");

      const withCounts = await supabase
        .from("songs")
        .select(`${SONG_FIELDS}, play_count`)
        .order("title", { ascending: true });

      if (!active) return;
      if (!withCounts.error) {
        setSongs(withCounts.data ?? []);
        setPopularityReady(true);
        setLoading(false);
        return;
      }

      if (withCounts.error.code === "42703") {
        const withoutCounts = await supabase
          .from("songs")
          .select(SONG_FIELDS)
          .order("title", { ascending: true });

        if (!active) return;
        if (withoutCounts.error) {
          setSongsError(withoutCounts.error.message);
        } else {
          setSongs((withoutCounts.data ?? []).map((song) => ({
            ...song,
            play_count: null
          })));
          setPopularityReady(false);
        }
      } else {
        setSongsError(withCounts.error.message);
      }

      setLoading(false);
    }

    loadSongs();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadFavorites() {
      setFavoritesError("");
      setFavoriteIds(new Set());
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from("favorites")
        .select("song_id")
        .eq("user_id", session.user.id);

      if (!active) return;
      if (error) {
        setFavoritesError(
          error.code === "42P01" || error.code === "PGRST205"
            ? "Run the Supabase migration to enable My Fav."
            : error.message
        );
        return;
      }
      setFavoriteIds(new Set((data ?? []).map((favorite) => String(favorite.song_id))));
    }

    loadFavorites();
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const artists = useMemo(() => {
    const distinctArtists = new Map();
    songs.forEach((song) => {
      const name = song.artist?.trim();
      if (name && !distinctArtists.has(name.toLocaleLowerCase())) {
        distinctArtists.set(name.toLocaleLowerCase(), name);
      }
    });
    return [...distinctArtists.values()].sort(alphabetical);
  }, [songs]);

  const popularSongs = useMemo(
    () =>
      songs
        .filter((song) => Number.isFinite(song.play_count) && song.play_count > 0)
        .sort((first, second) => second.play_count - first.play_count)
        .slice(0, 8),
    [songs]
  );

  const artistSongs = useMemo(
    () =>
      songs
        .filter(
          (song) =>
            song.artist?.trim().toLocaleLowerCase() ===
            selectedArtist.toLocaleLowerCase()
        )
        .sort((first, second) => alphabetical(first.title, second.title)),
    [songs, selectedArtist]
  );

  const favoriteSongs = useMemo(
    () =>
      songs
        .filter((song) => favoriteIds.has(String(song.id)))
        .sort((first, second) => alphabetical(first.title, second.title)),
    [songs, favoriteIds]
  );

  const matchingSongs = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return songs;
    return songs.filter((song) =>
      `${song.title} ${song.artist}`.toLocaleLowerCase().includes(query)
    );
  }, [search, songs]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");

    const result =
      authMode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setAuthError(result.error.message);
    } else if (authMode === "sign-up" && !result.data.session) {
      setAuthMessage("Check your email to confirm your account, then sign in.");
    } else {
      setAuthMessage("");
      setPassword("");
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
    else {
      setView("home");
      setSelectedArtist("");
      setSelectedSong(null);
    }
  }

  async function toggleFavorite(song) {
    if (!session?.user?.id) return;
    const songId = String(song.id);
    const isFavorite = favoriteIds.has(songId);
    setFavoritesError("");

    if (isFavorite) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", session.user.id)
        .eq("song_id", song.id);
      if (error) {
        setFavoritesError(error.message);
        return;
      }
      setFavoriteIds((current) => {
        const next = new Set(current);
        next.delete(songId);
        return next;
      });
      return;
    }

    const { error } = await supabase.from("favorites").insert({
      user_id: session.user.id,
      song_id: song.id
    });
    if (error) {
      setFavoritesError(error.message);
      return;
    }
    setFavoriteIds((current) => new Set(current).add(songId));
  }

  async function recordPlay(song) {
    setPlayError("");
    const { data: recorded, error } = await supabase.rpc("record_song_play", {
      p_song_id: String(song.id)
    });
    if (error) {
      setPlayError(`Could not record this play: ${error.message}`);
      return;
    }

    if (!recorded) return;

    setSongs((current) =>
      current.map((item) =>
        String(item.id) === String(song.id)
          ? { ...item, play_count: (item.play_count ?? 0) + 1 }
          : item
      )
    );
  }

  function showArtist(artist) {
    setSelectedArtist(artist);
    setView("artist");
  }

  function renderSongCards(songList, emptyMessage) {
    if (!songList.length) return <p className="empty-state">{emptyMessage}</p>;
    return (
      <div className="song-grid">
        {songList.map((song) => (
          <SongCard
            key={song.id}
            song={song}
            isFavorite={favoriteIds.has(String(song.id))}
            onFavorite={() => toggleFavorite(song)}
            onPlay={() => setSelectedSong({ ...song })}
          />
        ))}
      </div>
    );
  }

  if (authLoading) {
    return <main className="auth-page"><p>Connecting to xin&apos;s audio...</p></main>;
  }

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark" aria-hidden="true">♫</div>
          <p className="eyebrow">YOUR MUSIC, YOUR WAY</p>
          <h1>xin&apos;s audio</h1>
          <p className="auth-description">
            Sign in to listen and keep your favorites with you.
          </p>
          <form onSubmit={handleAuthSubmit}>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={authMode === "sign-in" ? "current-password" : "new-password"}
              minLength="6"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button className="primary-button auth-submit" type="submit">
              {authMode === "sign-in" ? "Sign in" : "Create account"}
            </button>
          </form>
          {authError && <p className="message error-message">{authError}</p>}
          {authMessage && <p className="message">{authMessage}</p>}
          <button
            className="text-button auth-switch"
            onClick={() => {
              setAuthMode(authMode === "sign-in" ? "sign-up" : "sign-in");
              setAuthError("");
              setAuthMessage("");
            }}
          >
            {authMode === "sign-in"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand-button" onClick={() => setView("home")}>
          <span className="brand-mark" aria-hidden="true">♫</span>
          <span>xin&apos;s audio</span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={view === "home" ? "nav-link active" : "nav-link"}
            onClick={() => setView("home")}
          >
            <span aria-hidden="true">⌂</span> Home
          </button>
          <button
            className={view === "artists" || view === "artist" ? "nav-link active" : "nav-link"}
            onClick={() => setView("artists")}
          >
            <span aria-hidden="true">♫</span> Singers
          </button>
          <button
            className={view === "favorites" ? "nav-link active" : "nav-link"}
            onClick={() => setView("favorites")}
          >
            <span aria-hidden="true">♥</span> My Fav
          </button>
        </nav>
        <div className="sidebar-account">
          <span className="account-label">SIGNED IN</span>
          <span className="account-email">{session.user.email}</span>
          <button className="text-button sign-out" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search songs"
              placeholder="Search songs or singers"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <span className="topbar-greeting">Good music, good mood.</span>
        </header>

        {songsError && <p className="message error-message">{songsError}</p>}
        {playError && <p className="message error-message">{playError}</p>}
        {favoritesError && <p className="message error-message">{favoritesError}</p>}
        {!popularityReady && (
          <p className="message migration-message">
            Popularity tracking is waiting for the Supabase migration. No play counts are being invented.
          </p>
        )}

        {search.trim() ? (
          <section className="content-section">
            <SectionHeading title="Search results" subtitle={`${matchingSongs.length} songs`} />
            {loading
              ? <p className="empty-state">Loading your music...</p>
              : renderSongCards(matchingSongs, "No songs match that search.")}
          </section>
        ) : view === "home" && (
          <>
            <section className="welcome-panel">
              <p className="eyebrow">A LITTLE SPACE FOR YOUR SOUND</p>
              <h1>Your music.<br />Your moment.</h1>
              <p>Find a singer, press play, and make the day yours.</p>
            </section>

            {loading ? (
              <p className="empty-state">Loading your music...</p>
            ) : songsError ? null : (
              <>
                <section className="content-section">
                  <SectionHeading title="Most Popular Songs" subtitle="Played and loved by listeners" />
                  {popularityReady && popularSongs.length
                    ? renderSongCards(popularSongs, "Recently added songs will show here as play counts are recorded.")
                    : (
                      <p className="empty-state">
                        {popularityReady
                          ? "No play counts yet. Songs will appear here after they have been played."
                          : "Popularity will appear here after the database migration records plays."}
                      </p>
                    )}
                </section>

                <section className="content-section">
                  <SectionHeading title="Music by Singers" subtitle="Explore singers from A to Z" />
                  {artists.length ? (
                    <div className="artist-grid">
                      {artists.map((artist) => (
                        <button className="artist-card" key={artist} onClick={() => showArtist(artist)}>
                          <span className="artist-avatar">{artist.charAt(0).toLocaleUpperCase()}</span>
                          <span>{artist}</span>
                          <span className="artist-arrow" aria-hidden="true">↗</span>
                        </button>
                      ))}
                    </div>
                  ) : <p className="empty-state">Singers will appear when songs are available.</p>}
                </section>

                <section className="content-section">
                  <SectionHeading title="My Fav" subtitle="Songs you have saved" actionLabel="View all" onAction={() => setView("favorites")} />
                  {renderSongCards(
                    favoriteSongs.slice(0, 4),
                    favoritesError
                      ? "Favorites need the Supabase migration before they can be loaded."
                      : "Your favorite songs will be waiting here when you save them."
                  )}
                </section>
              </>
            )}
          </>
        )}

        {!search.trim() && view === "artists" && (
          <section className="content-section page-section">
            <SectionHeading title="Music by Singers" subtitle="Choose a singer to explore their songs" />
            <div className="artist-grid">
              {artists.map((artist) => (
                <button className="artist-card" key={artist} onClick={() => showArtist(artist)}>
                  <span className="artist-avatar">{artist.charAt(0).toLocaleUpperCase()}</span>
                  <span>{artist}</span>
                  <span className="artist-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
            {!artists.length && <p className="empty-state">No singers are available yet.</p>}
          </section>
        )}

        {!search.trim() && view === "artist" && (
          <section className="content-section page-section">
            <button className="text-button back-button" onClick={() => setView("artists")}>
              ← All singers
            </button>
            <SectionHeading title={selectedArtist} subtitle="Songs sorted alphabetically" />
            {renderSongCards(artistSongs, "No songs found for this singer.")}
          </section>
        )}

        {!search.trim() && view === "favorites" && (
          <section className="content-section page-section">
            <SectionHeading title="My Fav" subtitle="Your saved songs, wherever you sign in" />
            {renderSongCards(favoriteSongs, "Tap the heart on any song to add it to My Fav.")}
          </section>
        )}
      </main>

      <MusicPlayer
        song={selectedSong}
        isFavorite={selectedSong ? favoriteIds.has(String(selectedSong.id)) : false}
        onFavorite={selectedSong ? () => toggleFavorite(selectedSong) : undefined}
        onPlay={selectedSong ? () => recordPlay(selectedSong) : undefined}
      />
    </div>
  );
}

function SectionHeading({ title, subtitle, actionLabel, onAction }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actionLabel && (
        <button className="text-button" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}

export default App;
