-- Migration: Add remarks column to booking_requests table
-- Run this if remarks column is missing

-- Add remarks column to booking_requests if not exists
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS remarks TEXT DEFAULT NULL;

-- Add remarks column to deleted_bookings if not exists  
ALTER TABLE deleted_bookings
  ADD COLUMN IF NOT EXISTS remarks TEXT DEFAULT NULL;
