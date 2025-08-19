import express from 'express';
import pool from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = 'your_jwt_secret';

function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}


// Get all users (admin only)
router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  try {
    const [rows] = await pool.query('SELECT id, username, role, created_at FROM users');
    res.json(rows);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new user (admin only)
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ message: 'All fields required' });
  try {
    const [exists] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (exists.length) return res.status(400).json({ message: 'Username already exists' });
    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hash, role]);
    res.json({ message: 'User created' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});


// Update user profile (name, profile image)
router.put('/profile', auth, async (req, res) => {
  const userId = req.user.id;
  const { name, profileImage } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });
  try {
    await pool.query('UPDATE users SET username = ?, profile_image = ? WHERE id = ?', [name, profileImage, userId]);
    res.json({ message: 'Profile updated' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// Change user password (bcrypt)
router.put('/password', auth, async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'All fields required' });
  try {
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    const user = rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ message: 'Current password incorrect' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, userId]);
    res.json({ message: 'Password updated' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
