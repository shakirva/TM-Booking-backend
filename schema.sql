-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','staff') NOT NULL
);

-- Booking slots table
CREATE TABLE IF NOT EXISTS booking_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  time VARCHAR(20) NOT NULL,
  hall_name VARCHAR(100) NOT NULL,
  capacity INT NOT NULL
);

-- Booking requests table
CREATE TABLE IF NOT EXISTS booking_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  slot_id INT,
  details TEXT,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  FOREIGN KEY (slot_id) REFERENCES booking_slots(id)
);
