-- Add missing columns to booking_requests table for full booking details
ALTER TABLE booking_requests
  ADD COLUMN occasion_type VARCHAR(100),
  ADD COLUMN utility_type VARCHAR(100),
  ADD COLUMN payment_mode VARCHAR(50);
