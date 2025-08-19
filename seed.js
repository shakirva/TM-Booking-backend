// Utility to seed initial users (admin/staff)
import pool from './db.js';
import bcrypt from 'bcryptjs';

async function seed() {
  const adminPass = await bcrypt.hash('admin123', 10);
  const staffPass = await bcrypt.hash('staff123', 10);
  await pool.query("INSERT IGNORE INTO users (username, password, role) VALUES (?, ?, 'admin')", ['admin', adminPass]);
  await pool.query("INSERT IGNORE INTO users (username, password, role) VALUES (?, ?, 'staff')", ['staff', staffPass]);
  console.log('Seeded admin/staff users.');
  process.exit();
}
seed();
