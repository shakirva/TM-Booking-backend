-- Migration: MariaDB compatible - Add slot pricing table and required columns
-- Run this on the production server: mysql -u root -p bookingapp_db < this_file.sql

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

-- Insert default slot pricing (ignore if exists)
INSERT IGNORE INTO slot_pricing (slot_name, current_price, future_price, effective_from) VALUES
  ('Lunch', 40000.00, 45000.00, '2026-04-01'),
  ('Reception', 40000.00, 45000.00, '2026-04-01'),
  ('Night', 15000.00, 20000.00, '2026-04-01');

-- Add columns to booking_requests (MariaDB compatible - will error if exists, that's OK)
-- Run these one by one, ignore errors for existing columns

-- Check and add night column
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'bookingapp_db' AND TABLE_NAME = 'booking_requests' AND COLUMN_NAME = 'night');
SET @sql = IF(@col_exists = 0, "ALTER TABLE booking_requests ADD COLUMN night ENUM('Yes', 'No') DEFAULT 'No'", 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add utensil column
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'bookingapp_db' AND TABLE_NAME = 'booking_requests' AND COLUMN_NAME = 'utensil');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE booking_requests ADD COLUMN utensil VARCHAR(50) DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add final_payment column
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'bookingapp_db' AND TABLE_NAME = 'booking_requests' AND COLUMN_NAME = 'final_payment');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE booking_requests ADD COLUMN final_payment DECIMAL(10, 2) DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add remarks column
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'bookingapp_db' AND TABLE_NAME = 'booking_requests' AND COLUMN_NAME = 'remarks');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE booking_requests ADD COLUMN remarks TEXT DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add night column to deleted_bookings
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'bookingapp_db' AND TABLE_NAME = 'deleted_bookings' AND COLUMN_NAME = 'night');
SET @sql = IF(@col_exists = 0, "ALTER TABLE deleted_bookings ADD COLUMN night ENUM('Yes', 'No') DEFAULT 'No'", 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update booking_slots to have Lunch and Reception
UPDATE booking_slots SET time = 'Lunch' WHERE id = 1;
UPDATE booking_slots SET time = 'Reception' WHERE id = 2;

SELECT 'Migration completed successfully!' AS status;
