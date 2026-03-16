import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';
import { getSlotPrice, getAllSlotPricing, updateSlotPricing, calculateTotalAmount } from '../slotPricing.js';

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

// ================== SLOT PRICING ROUTES ==================

// Get all slot pricing (public for booking form)
router.get('/pricing', async (req, res) => {
  try {
    const pricing = await getAllSlotPricing();
    res.json(pricing);
  } catch (err) {
    console.error('Error fetching slot pricing:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get price for a specific slot and event date
router.get('/pricing/:slotName', async (req, res) => {
  try {
    const { slotName } = req.params;
    const { eventDate } = req.query;
    
    if (!eventDate) {
      return res.status(400).json({ message: 'Event date is required' });
    }
    
    const price = await getSlotPrice(slotName, eventDate);
    res.json({ slotName, eventDate, price });
  } catch (err) {
    console.error('Error fetching slot price:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Calculate total amount including night
router.post('/calculate-total', async (req, res) => {
  try {
    const { slotName, eventDate, includeNight } = req.body;
    
    if (!slotName || !eventDate) {
      return res.status(400).json({ message: 'Slot name and event date are required' });
    }
    
    const result = await calculateTotalAmount(slotName, eventDate, includeNight);
    res.json(result);
  } catch (err) {
    console.error('Error calculating total:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update slot pricing (admin only)
router.put('/pricing/:slotName', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  
  try {
    const { slotName } = req.params;
    const { current_price, future_price, effective_from } = req.body;
    
    if (!['Lunch', 'Reception', 'Night'].includes(slotName)) {
      return res.status(400).json({ message: 'Invalid slot name. Must be Lunch, Reception, or Night.' });
    }
    
    if (!current_price || current_price <= 0) {
      return res.status(400).json({ message: 'Valid current price is required.' });
    }
    
    const success = await updateSlotPricing(slotName, { current_price, future_price, effective_from });
    
    if (success) {
      res.json({ message: 'Pricing updated successfully' });
    } else {
      res.status(500).json({ message: 'Failed to update pricing' });
    }
  } catch (err) {
    console.error('Error updating slot pricing:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ================== BOOKING SLOTS ROUTES ==================

// Create booking slot (staff/admin)
router.post('/slots', auth, async (req, res) => {
  if (req.user.role !== 'staff' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const { date, time, hall_name, capacity } = req.body;
  
  // Validate slot time - only Lunch or Reception allowed
  if (!['Lunch', 'Reception'].includes(time)) {
    return res.status(400).json({ message: 'Slot time must be either Lunch or Reception' });
  }
  
  try {
    await pool.query('INSERT INTO booking_slots (date, time, hall_name, capacity) VALUES (?, ?, ?, ?)', [date, time, hall_name, capacity]);
    res.json({ message: 'Slot created' });
  } catch (err) {
    console.error('Error creating slot:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all slots (public - no auth required for booking page)
router.get('/slots', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM booking_slots WHERE time IN (\'Lunch\', \'Reception\') ORDER BY id');
    // Transform to frontend format
    const slots = rows.map(row => ({
      id: row.id,
      label: row.time === 'Lunch' ? 'Lunch' : 'Reception',
      time: row.time,
      price: 40000 // Default, actual price is fetched from pricing endpoint
    }));
    res.json(slots);
  } catch (err) {
    console.error('Error fetching slots:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ================== BOOKING REQUEST ROUTES ==================

// Create booking request (public)
router.post('/request', async (req, res) => {
  try {
    const {
      name, phone, slot_id, details, payment_mode, advance_amount,
      date, time, payment_type, groom_name, bride_name, address, night,
      utensil, remarks
    } = req.body;
    
    // Accept either `phone2` or `customer_phone2` from client payloads
    const phone2 = req.body.phone2 ?? req.body.customer_phone2 ?? null;

    // ================== VALIDATIONS ==================
    
    // Required fields validation
    if (!name || !phone || !slot_id || !date || !time) {
      return res.status(400).json({ message: 'Missing required fields: name, phone, slot_id, date, and time are required.' });
    }
    
    // Payment mode validation - MANDATORY
    if (!payment_mode || !['bank', 'cash', 'upi'].includes(payment_mode)) {
      return res.status(400).json({ message: 'Payment mode is required. Please select Bank, Cash, or UPI.' });
    }
    
    // Address validation - max 140 characters
    if (address && address.length > 140) {
      return res.status(400).json({ message: 'Address must be 140 characters or less.' });
    }
    
    // Advance amount validation - prevent direct entry bug
    if (advance_amount) {
      const advanceNum = parseFloat(advance_amount);
      if (isNaN(advanceNum) || advanceNum < 0) {
        return res.status(400).json({ message: 'Invalid advance amount.' });
      }
    }

    // Check for existing booking for the same date and slot
    const [existing] = await pool.query(
      'SELECT * FROM booking_requests WHERE date = ? AND slot_id = ?',
      [date, slot_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'This date and slot are already booked.' });
    }

    // Get slot name from booking_slots
    const [slotRows] = await pool.query('SELECT time FROM booking_slots WHERE id = ?', [slot_id]);
    if (!slotRows.length) {
      return res.status(400).json({ message: 'Invalid slot selected.' });
    }
    
    const slotName = slotRows[0].time;
    
    // Only allow Lunch or Reception
    if (!['Lunch', 'Reception'].includes(slotName)) {
      return res.status(400).json({ message: 'Invalid slot. Only Lunch or Reception allowed.' });
    }

    // ================== PRICE CALCULATION WITH NIGHT ==================
    
    const nightValue = (night === true || night === 'Yes' || night === 'yes' || night === 1) ? 'Yes' : 'No';
    const includeNight = nightValue === 'Yes';
    
    const { slotPrice, nightPrice, totalAmount } = await calculateTotalAmount(slotName, date, includeNight);

    // ================== INSERT BOOKING ==================

    await pool.query(
      `INSERT INTO booking_requests (
        name, phone, slot_id, details, status, payment_mode, advance_amount, 
        date, time, total_amount, payment_type, customer_name, customer_phone, 
        customer_phone2, groom_name, bride_name, address, night, utensil, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, phone, slot_id, details, 'pending', payment_mode, advance_amount || 0,
        date, time, totalAmount, payment_type || (advance_amount ? 'advance' : 'full'),
        name, phone, phone2 || null, groom_name || null, bride_name || null,
        address || null, nightValue, utensil || null, remarks || null
      ]
    );
    
    res.json({ 
      message: 'Request submitted',
      totalAmount,
      slotPrice,
      nightPrice: includeNight ? nightPrice : 0
    });
  } catch (err) {
    console.error('Booking request error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all booking requests (admin/staff) - for reports, order by event date
router.get('/requests', auth, async (req, res) => {
  try {
    const { fromDate, toDate, bookingDate, orderBy } = req.query;
    
    // First, check which columns exist in the table
    let query = `SELECT * FROM booking_requests WHERE 1=1`;
    const params = [];
    
    // Date range filter (Event Date)
    if (fromDate) {
      query += ' AND date >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      query += ' AND date <= ?';
      params.push(toDate);
    }
    
    // Booking date filter - only if created_at column exists
    if (bookingDate) {
      query += ' AND DATE(created_at) = ?';
      params.push(bookingDate);
    }
    
    // Order by Event Date by default for reports
    if (orderBy === 'event_date') {
      query += ' ORDER BY date ASC';
    } else if (orderBy === 'event_date_desc') {
      query += ' ORDER BY date DESC';
    } else {
      query += ' ORDER BY id DESC';
    }
    
    const [rows] = await pool.query(query, params);
    
    // Calculate balance amount for each booking
    const enrichedRows = rows.map(row => ({
      ...row,
      balance_amount: Math.max(0, (parseFloat(row.total_amount) || 0) - (parseFloat(row.advance_amount) || 0) - (parseFloat(row.final_payment) || 0))
    }));
    
    res.json(enrichedRows);
  } catch (err) {
    console.error('Fetch requests error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get reports data with charts aggregation
router.get('/reports', auth, async (req, res) => {
  try {
    const { fromDate, toDate, bookingDate } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    // Event date range filter
    if (fromDate) {
      dateFilter += ' AND date >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      dateFilter += ' AND date <= ?';
      params.push(toDate);
    }
    
    // Booking creation date filter
    if (bookingDate) {
      dateFilter += ' AND DATE(created_at) = ?';
      params.push(bookingDate);
    }
    
    // Get booking data ordered by event date
    const [bookings] = await pool.query(`
      SELECT id, name, phone, customer_phone2, slot_id, details, status, 
             payment_mode, advance_amount, date, time, created_at, total_amount, 
             payment_type, customer_name, customer_phone, groom_name, bride_name, 
             address, night, utensil, remarks, final_payment
      FROM booking_requests
      WHERE 1=1 ${dateFilter}
      ORDER BY date ASC
    `, params);
    
    // Aggregate data for charts
    const [monthlyStats] = await pool.query(`
      SELECT 
        DATE_FORMAT(date, '%Y-%m') as month,
        COUNT(*) as count,
        SUM(CAST(total_amount AS DECIMAL(10,2))) as revenue
      FROM booking_requests
      WHERE 1=1 ${dateFilter}
      GROUP BY DATE_FORMAT(date, '%Y-%m')
      ORDER BY month ASC
    `, params);
    
    const [slotStats] = await pool.query(`
      SELECT 
        time as slot_name,
        COUNT(*) as count
      FROM booking_requests
      WHERE 1=1 ${dateFilter}
      GROUP BY time
    `, params);
    
    const [nightStats] = await pool.query(`
      SELECT 
        night,
        COUNT(*) as count
      FROM booking_requests
      WHERE 1=1 ${dateFilter}
      GROUP BY night
    `, params);
    
    // Summary stats
    const [summary] = await pool.query(`
      SELECT 
        COUNT(*) as total_bookings,
        SUM(CAST(total_amount AS DECIMAL(10,2))) as total_revenue,
        SUM(CAST(advance_amount AS DECIMAL(10,2))) as total_advance,
        AVG(CAST(total_amount AS DECIMAL(10,2))) as avg_booking_value
      FROM booking_requests
      WHERE 1=1 ${dateFilter}
    `, params);
    
    res.json({
      bookings: bookings.map(row => ({
        ...row,
        balance_amount: Math.max(0, (parseFloat(row.total_amount) || 0) - (parseFloat(row.advance_amount) || 0) - (parseFloat(row.final_payment) || 0))
      })),
      charts: {
        monthly: monthlyStats,
        slots: slotStats,
        night: nightStats
      },
      summary: summary[0] || { total_bookings: 0, total_revenue: 0, total_advance: 0, avg_booking_value: 0 }
    });
  } catch (err) {
    console.error('Fetch reports error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update booking request (admin/staff)
router.put('/requests/:id', auth, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const payload = { ...req.body };
    
    // Map incoming `notes` to `details` for compatibility
    if (payload.notes !== undefined && payload.details === undefined) {
      payload.details = payload.notes;
      delete payload.notes;
    }

    const allowedFields = [
      'status', 'details', 'payment_mode', 'advance_amount',
      'date', 'time', 'total_amount', 'payment_type', 'customer_name', 'customer_phone', 'customer_phone2',
      'groom_name', 'bride_name', 'address', 'name', 'phone', 'night', 'utensil', 'remarks', 'final_payment'
    ];

    const updates = [];
    const values = [];
    
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        // Validate specific fields
        if (key === 'address' && payload[key] && payload[key].length > 140) {
          return res.status(400).json({ message: 'Address must be 140 characters or less.' });
        }
        if (key === 'payment_mode' && payload[key] && !['bank', 'cash', 'upi'].includes(payload[key])) {
          return res.status(400).json({ message: 'Invalid payment mode.' });
        }
        
        updates.push(`${key} = ?`);
        values.push(payload[key]);
      }
    }

    // Recalculate total if night value changes
    if (payload.night !== undefined && payload.date) {
      const [existingBooking] = await pool.query('SELECT slot_id, date FROM booking_requests WHERE id = ?', [bookingId]);
      if (existingBooking.length > 0) {
        const [slotRows] = await pool.query('SELECT time FROM booking_slots WHERE id = ?', [existingBooking[0].slot_id]);
        if (slotRows.length > 0) {
          const slotName = slotRows[0].time;
          const nightValue = (payload.night === true || payload.night === 'Yes' || payload.night === 'yes') ? 'Yes' : 'No';
          const { totalAmount } = await calculateTotalAmount(slotName, payload.date || existingBooking[0].date, nightValue === 'Yes');
          
          updates.push('total_amount = ?');
          values.push(totalAmount);
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No valid fields provided to update' });
    }

    values.push(bookingId);
    const sql = `UPDATE booking_requests SET ${updates.join(', ')} WHERE id = ?`;
    await pool.query(sql, values);
    res.json({ message: 'Booking updated' });
  } catch (err) {
    console.error('Update booking error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete booking request (admin/staff)
router.delete('/requests/:id', auth, async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    // Fetch the booking before deletion
    const [rows] = await pool.query('SELECT * FROM booking_requests WHERE id = ?', [bookingId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    const b = rows[0];
    
    // Log into deleted_bookings
    await pool.query(
      `INSERT INTO deleted_bookings (
        original_booking_id, name, phone, customer_phone2, slot_id, details, status, 
        payment_mode, advance_amount, date, time, created_at, groom_name, bride_name, address, night
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.id, b.name, b.phone, b.customer_phone2 || null, b.slot_id, b.details, b.status,
        b.payment_mode, b.advance_amount, b.date, b.time, b.created_at,
        b.groom_name || null, b.bride_name || null, b.address || null, b.night || 'No'
      ]
    );
    
    // Delete original booking
    await pool.query('DELETE FROM booking_requests WHERE id = ?', [bookingId]);
    res.json({ message: 'Booking deleted and logged' });
  } catch (err) {
    console.error('Delete booking error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Retrieve deleted bookings log (admin/staff)
router.get('/deleted', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM deleted_bookings ORDER BY deleted_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Fetch deleted bookings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Permanently delete from deleted_bookings log (admin only)
router.delete('/deleted/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM deleted_bookings WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Deleted booking not found' });
    }
    res.json({ message: 'Booking permanently deleted from log' });
  } catch (err) {
    console.error('Permanent delete error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
