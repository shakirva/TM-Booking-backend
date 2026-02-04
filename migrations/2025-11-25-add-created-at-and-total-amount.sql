-- Migration: add created_at (booked date) and total_amount columns
-- Run this after initial schema/migrations if created_at not present.

ALTER TABLE booking_requests
  ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE booking_requests
  ADD COLUMN total_amount VARCHAR(50) NULL;

-- Optional: backfill total_amount based on known slot pricing if you have a fixed price
-- UPDATE booking_requests SET total_amount = '40000' WHERE total_amount IS NULL;