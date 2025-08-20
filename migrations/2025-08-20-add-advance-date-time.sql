-- Add advance_amount, date, and time columns to booking_requests table
ALTER TABLE booking_requests
  ADD COLUMN advance_amount VARCHAR(50),
  ADD COLUMN date DATE,
  ADD COLUMN time VARCHAR(20);
