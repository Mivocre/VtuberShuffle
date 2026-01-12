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

// API routes (protected)
app.use('/api', (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.get('/api/songs', (req, res) => {
  db.all(`SELECT * FROM songs`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/songs', (req, res) => {
  const { title, artist, url } = req.body;
  db.run(`INSERT INTO songs (title, artist, url) VALUES (?, ?, ?)`, [title, artist, url], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.put('/api/songs/:id', (req, res) => {
  const { title, artist, url } = req.body;
  db.run(`UPDATE songs SET title = ?, artist = ?, url = ? WHERE id = ?`, [title, artist, url, req.params.id], function(err) {
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