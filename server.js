const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } 
}));

app.use(passport.initialize());
app.use(passport.session());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '2104',
  database: 'productapi'
});

db.connect((err) => {
  if (err) throw err;
  console.log('MySQL Connected...');
});

passport.use(new LocalStrategy((username, password, done) => {
  const sql = 'SELECT * FROM users WHERE username = ?';
  db.query(sql, [username], (err, results) => {
    if (err) return done(err);
    if (results.length === 0) {
      console.log('User not found');
      return done(null, false, { message: 'User not found' });
    }
    const user = results[0];
    if (password === user.password) {
      console.log('User authenticated');
      return done(null, user);
    } else {
      console.log('Invalid password');
      return done(null, false, { message: 'Invalid password' });
    }
  });
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const sql = 'SELECT * FROM users WHERE id = ?';
  db.query(sql, [id], (err, results) => {
    if (err) return done(err);
    done(null, results[0]);
  });
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/index.html');
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  const sql = 'INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)';
  db.query(sql, [username, password, false], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.redirect('/index.html');
  });
});

app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error('Authentication error:', err);
      return next(err);
    }
    if (!user) {
      console.log('Authentication failed:', info.message);
      return res.status(401).json({ error: info.message }); 
    }
    req.logIn(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }
      res.json({ redirect: '/productapi.html' }); 
    });
  })(req, res, next);
});


// Handle user logout
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/index.html');
  });
});

// Serve authenticated page
app.get('/productapi.html', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'productapi.html'));
});

// API endpoints for products
app.get('/products', (req, res) => {
  let sql = 'SELECT * FROM products';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/products/:id', (req, res) => {
  let sql = 'SELECT * FROM products WHERE id = ?';
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.length > 0) {
      res.json(result[0]);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  });
});

app.post('/products', (req, res) => {
  let product = req.body;
  let sql = 'INSERT INTO products SET ?';
  db.query(sql, product, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({
      message: 'Product added successfully',
      product: { id: result.insertId, ...product }
    });
  });
});

app.put('/products/:id', (req, res) => {
  let updatedProduct = req.body;
  let sql = 'UPDATE products SET ? WHERE id = ?';
  db.query(sql, [updatedProduct, req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows > 0) {
      res.json({ message: 'Product updated successfully' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  });
});

app.delete('/products/:id', (req, res) => {
  let sql = 'DELETE FROM products WHERE id = ?';
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows > 0) {
      res.json({ message: 'Product deleted successfully' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
