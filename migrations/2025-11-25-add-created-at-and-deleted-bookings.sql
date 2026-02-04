-- Add created_at column to booking_requests if not exists
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create deleted_bookings table to log deletions
CREATE TABLE IF NOT EXISTS deleted_bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  original_booking_id INT NOT NULL,
  name VARCHAR(100),
  phone VARCHAR(20),
  slot_id INT,
  details TEXT,
  status VARCHAR(50),
  occasion_type VARCHAR(100),
  utility_type VARCHAR(100),
  payment_mode VARCHAR(50),
  advance_amount VARCHAR(50),
  date DATE,
  time VARCHAR(20),
  created_at TIMESTAMP NULL, -- original created_at from booking_requests
  deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (slot_id) REFERENCES booking_slots(id)
);