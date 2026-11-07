const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

// Middleware - check login
function requireLogin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/admin/login');
}

// Redirect /admin to /admin/login or /admin/dashboard
router.get('/', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin/dashboard');
  }
  res.redirect('/admin/login');
});

// Login page
router.get('/login', (req, res) => {
  res.render('login');
});

// Login submit
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  }

  res.render('login', { error: 'Invalid username or password' });
});

// Dashboard
router.get('/dashboard', requireLogin, async (req, res) => {
  try {
    const [leads] = await db.execute('SELECT * FROM leads ORDER BY created_at DESC');
    res.render('dashboard', { leads, dbError: null });
  } catch (error) {
    console.error('Database query error in /admin/dashboard:', error.message || error);
    res.render('dashboard', {
      leads: [],
      dbError: error.message || 'Database connection error. Please ensure MySQL is running and the "emirates_first" database exists.'
    });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

//delete lead
router.delete('/leads/:id', requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.execute('DELETE FROM leads WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;