import express from 'express';
import pool from '../db.js';
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

// Dashboard summary (admin only)
router.get('/summary', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  try {
    const [[{ total_bookings }]] = await pool.query('SELECT COUNT(*) as total_bookings FROM booking_requests');
    const [[{ total_slots }]] = await pool.query('SELECT COUNT(*) as total_slots FROM booking_slots');
    const [[{ total_users }]] = await pool.query('SELECT COUNT(*) as total_users FROM users');
    res.json({ total_bookings, total_slots, total_users });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
