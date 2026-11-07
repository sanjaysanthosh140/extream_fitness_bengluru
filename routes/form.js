const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/submit', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ success: false, message: 'Name, Email, Phone required' });
    }

    await db.execute(
      'INSERT INTO leads (name, email, phone, message) VALUES (?, ?, ?, ?)',
      [name, email, phone, message || null]
    );

    res.json({ success: true, message: 'Thank you! We will contact you soon.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;