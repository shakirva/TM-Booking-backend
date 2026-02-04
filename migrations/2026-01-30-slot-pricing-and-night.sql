-- Migration: Add slot pricing table with dynamic pricing and Night option
-- Run this migration to add dynamic slot pricing with effective dates and Night support

-- Create slot_pricing table for dynamic pricing
CREATE TABLE IF NOT EXISTS slot_pricing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slot_name ENUM('Lunch', 'Reception', 'Night') NOT NULL,
  current_price DECIMAL(10, 2) NOT NULL DEFAULT 40000.00,
  future_price DECIMAL(10, 2) NULL,
  effective_from DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_slot (slot_name)
);

-- Insert default slot pricing
INSERT INTO slot_pricing (slot_name, current_price, future_price, effective_from) VALUES
  ('Lunch', 40000.00, 45000.00, '2026-04-01'),
  ('Reception', 40000.00, 45000.00, '2026-04-01'),
  ('Night', 15000.00, 20000.00, '2026-04-01')
ON DUPLICATE KEY UPDATE id = id;

-- Add Night column to booking_requests if not exists
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS night ENUM('Yes', 'No') DEFAULT 'No';

-- Add Night column to deleted_bookings if not exists
ALTER TABLE deleted_bookings
  ADD COLUMN IF NOT EXISTS night ENUM('Yes', 'No') DEFAULT 'No';

-- Add utensil column for reports
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS utensil VARCHAR(50) DEFAULT NULL;

-- Add final_payment column for reports
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS final_payment DECIMAL(10, 2) DEFAULT NULL;

-- Add remarks column for reports (if not exists)
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS remarks TEXT DEFAULT NULL;

-- Update booking_slots to have only Lunch and Reception
UPDATE booking_slots SET time = 'Lunch' WHERE time LIKE '%Lunch%' OR time LIKE '%Morning%' OR id = 1;
UPDATE booking_slots SET time = 'Reception' WHERE time LIKE '%Dinner%' OR time LIKE '%Evening%' OR time LIKE '%Reception%' OR id = 2;

-- Insert Lunch and Reception slots if not already present
INSERT INTO booking_slots (date, time, hall_name, capacity)
SELECT CURDATE(), 'Lunch', 'Main Hall', 500
WHERE NOT EXISTS (SELECT 1 FROM booking_slots WHERE time = 'Lunch');

INSERT INTO booking_slots (date, time, hall_name, capacity)
SELECT CURDATE(), 'Reception', 'Main Hall', 500
WHERE NOT EXISTS (SELECT 1 FROM booking_slots WHERE time = 'Reception');
