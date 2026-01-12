# Vtuber Shuffle

A simple web application for discovering Vtuber songs with an admin panel.

## Running the Application

### Frontend Only (Static)
To run the static version, use Python's built-in HTTP server:

```bash
python3 -m http.server 8000
```

### Full Application (with Backend)
To run with the backend API and admin panel:

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

The application will be available at http://localhost:3000

### Admin Access
- Go to http://localhost:3000/login
- Default credentials: username `admin`, password `admin123`
- Admin panel allows managing songs in the database.

## Features
- Responsive web design
- YouTube video embed
- Admin login and song management via RESTful API
- SQLite database for data persistence