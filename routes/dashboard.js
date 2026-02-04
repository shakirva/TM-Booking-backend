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
    // Count distinct customer names as total_customers
    const [[{ total_customers }]] = await pool.query('SELECT COUNT(DISTINCT name) as total_customers FROM booking_requests');
    res.json({ total_bookings, total_slots, total_users, total_customers });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get upcoming events for dashboard - ordered by Event Date ascending
// Fields: Event Date, Customer Name, Primary Phone, Remarks
router.get('/upcoming-events', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.query(`
      SELECT 
        id,
        date as event_date,
        customer_name,
        name,
        phone as primary_phone,
        customer_phone,
        remarks
      FROM booking_requests
      WHERE date >= ?
      ORDER BY date ASC
      LIMIT 10
    `, [today]);
    
    // Normalize field names
    const events = rows.map(row => ({
      id: row.id,
      event_date: row.event_date,
      customer_name: row.customer_name || row.name || '-',
      primary_phone: row.primary_phone || row.customer_phone || '-',
      remarks: row.remarks || ''
    }));
    
    res.json(events);
  } catch (err) {
    console.error('Fetch upcoming events error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
