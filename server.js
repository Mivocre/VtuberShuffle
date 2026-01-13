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

  db.run(`CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    artist TEXT,
    url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add affiliation column if not exists
  db.run(`ALTER TABLE songs ADD COLUMN affiliation TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding affiliation column:', err);
    }
  });

  // Insert default admin user if not exists
  const saltRounds = 10;
  bcrypt.hash('admin123', saltRounds, (err, hash) => {
    if (err) console.error(err);
    db.run(`INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)`, ['admin', hash]);
  });

  // Insert sample songs if none exist
  db.get(`SELECT COUNT(*) as count FROM songs`, [], (err, row) => {
    if (err) console.error(err);
    if (row.count === 0) {
      const sampleSongs = [
        { title: 'Sample Song 1', artist: 'Vtuber Artist 1', url: 'https://www.youtube.com/watch?v=6sAQ1wuYzxk' },
        { title: 'Sample Song 2', artist: 'Vtuber Artist 2', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { title: 'Sample Song 3', artist: 'Vtuber Artist 3', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' }
      ];
      sampleSongs.forEach(song => {
        db.run(`INSERT INTO songs (title, artist, url) VALUES (?, ?, ?)`, [song.title, song.artist, song.url]);
      });
    }
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
app.get('/api/songs', (req, res) => {
  db.all(`SELECT * FROM songs`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
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

app.post('/api/songs', (req, res) => {
  const { title, artist, url, affiliation } = req.body;
  db.run(`INSERT INTO songs (title, artist, url, affiliation) VALUES (?, ?, ?, ?)`, [title, artist, url, affiliation], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.put('/api/songs/:id', (req, res) => {
  const { title, artist, url, affiliation } = req.body;
  db.run(`UPDATE songs SET title = ?, artist = ?, url = ?, affiliation = ? WHERE id = ?`, [title, artist, url, affiliation, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changes: this.changes });
  });
});

app.delete('/api/songs/:id', (req, res) => {
  db.run(`DELETE FROM songs WHERE id = ?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changes: this.changes });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});