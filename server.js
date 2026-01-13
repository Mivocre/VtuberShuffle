const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const db = new sqlite3.Database('./vtuber.db');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    affiliation TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    url TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS song_artists (
    song_id INTEGER,
    artist_id INTEGER,
    FOREIGN KEY (song_id) REFERENCES songs(id),
    FOREIGN KEY (artist_id) REFERENCES artists(id),
    PRIMARY KEY (song_id, artist_id)
  )`);

  // Insert default admin user if not exists
  const saltRounds = 10;
  bcrypt.hash('admin123', saltRounds, (err, hash) => {
    if (err) console.error(err);
    db.run(`INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)`, ['admin', hash]);
  });
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'vtuber-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/admin', (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, 'admin.html'));
  } else {
    res.redirect('/login');
  }
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    bcrypt.compare(password, user.password_hash, (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result) {
        req.session.user = user;
        res.json({ success: true });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Public API routes
app.get('/api/artists', (req, res) => {
  db.all(`SELECT * FROM artists`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/songs', (req, res) => {
  db.all(`SELECT s.id, s.title, s.url, a.name as artist, a.affiliation as artist_affiliation FROM songs s LEFT JOIN song_artists sa ON s.id = sa.song_id LEFT JOIN artists a ON sa.artist_id = a.id`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // Group by song
    const songs = {};
    rows.forEach(row => {
      if (!songs[row.id]) {
        songs[row.id] = { id: row.id, title: row.title, url: row.url, artists: [] };
      }
      if (row.artist) {
        songs[row.id].artists.push({ name: row.artist, affiliation: row.artist_affiliation });
      }
    });
    res.json(Object.values(songs));
  });
});

// Protected API routes
app.use('/api', (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.post('/api/artists', (req, res) => {
  const { name, affiliation } = req.body;
  db.run(`INSERT INTO artists (name, affiliation) VALUES (?, ?)`, [name, affiliation], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.put('/api/artists/:id', (req, res) => {
  const { name, affiliation } = req.body;
  db.run(`UPDATE artists SET name = ?, affiliation = ? WHERE id = ?`, [name, affiliation, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changes: this.changes });
  });
});

app.delete('/api/artists/:id', (req, res) => {
  db.run(`DELETE FROM artists WHERE id = ?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changes: this.changes });
  });
});

app.post('/api/songs', (req, res) => {
  const { title, url, artists } = req.body;
  db.run(`INSERT INTO songs (title, url) VALUES (?, ?)`, [title, url], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const songId = this.lastID;
    // Insert song_artists
    if (artists && artists.length > 0) {
      artists.forEach(artistId => {
        db.run(`INSERT INTO song_artists (song_id, artist_id) VALUES (?, ?)`, [songId, artistId]);
      });
    }
    res.json({ id: songId });
  });
});

app.put('/api/songs/:id', (req, res) => {
  const { title, url, artists } = req.body;
  db.run(`UPDATE songs SET title = ?, url = ? WHERE id = ?`, [title, url, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    // Delete existing song_artists
    db.run(`DELETE FROM song_artists WHERE song_id = ?`, [req.params.id], () => {
      // Insert new
      if (artists && artists.length > 0) {
        artists.forEach(artistId => {
          db.run(`INSERT INTO song_artists (song_id, artist_id) VALUES (?, ?)`, [req.params.id, artistId]);
        });
      }
      res.json({ changes: this.changes });
    });
  });
});

app.delete('/api/songs/:id', (req, res) => {
  db.run(`DELETE FROM song_artists WHERE song_id = ?`, [req.params.id], () => {
    db.run(`DELETE FROM songs WHERE id = ?`, [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ changes: this.changes });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});