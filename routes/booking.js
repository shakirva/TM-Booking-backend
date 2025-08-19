import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = 'your_jwt_secret';

// Middleware to check JWT
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

// Create booking slot (staff)
router.post('/slots', auth, async (req, res) => {
  if (req.user.role !== 'staff') return res.status(403).json({ message: 'Forbidden' });
  const { date, time, hall_name, capacity } = req.body;
  try {
    await pool.query('INSERT INTO booking_slots (date, time, hall_name, capacity) VALUES (?, ?, ?, ?)', [date, time, hall_name, capacity]);
    res.json({ message: 'Slot created' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all slots (admin only)
router.get('/slots', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  try {
    const [rows] = await pool.query('SELECT * FROM booking_slots');
    res.json(rows);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create booking request (public)
router.post('/request', async (req, res) => {
  const { name, phone, slot_id, details, occasion_type, utility_type, payment_mode, customer_count } = req.body;
  try {
    await pool.query(
      'INSERT INTO booking_requests (name, phone, slot_id, details, status, occasion_type, utility_type, payment_mode, customer_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, phone, slot_id, details, 'pending', occasion_type, utility_type, payment_mode, customer_count]
    );
    res.json({ message: 'Request submitted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all booking requests (admin/staff)
router.get('/requests', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM booking_requests');
    res.json(rows);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update booking request status (admin/staff)
router.put('/requests/:id', auth, async (req, res) => {
  const { status } = req.body;
  try {
    await pool.query('UPDATE booking_requests SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Status updated' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
