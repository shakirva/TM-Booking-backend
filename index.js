// Simple Express server setup
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/booking.js';
import dashboardRoutes from './routes/dashboard.js';
import usersRoutes from './routes/users.js';

const app = express();
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://tm-booking-frontend-lxqyq4kp6-shakirvas-projects.vercel.app",
    "https://tm-booking-frontend.vercel.app"
  ],
  credentials: true,
}));
app.use(express.json());


app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', usersRoutes);

app.get('/', (req, res) => {
  res.send('Marriage Hall Booking Backend Running');
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
