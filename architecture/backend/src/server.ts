import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import orderRoutes from './routes/order.routes';
import adminRoutes from './routes/admin.routes';
import webhookRoutes from './routes/webhook.routes';

import settingsRoutes from './routes/settings.routes';
import restaurantRoutes from './routes/restaurant.routes';
import deliveryRoutes from './routes/delivery.routes';
import authRoutes from './routes/auth.routes';
import driverRoutes from './routes/driver.routes';
import settlementRoutes from './routes/settlement.routes';
import driverSettlementRoutes from './routes/driver-settlement.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/restaurants', restaurantRoutes);
app.use('/api/v1/delivery', deliveryRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/settlements', settlementRoutes);
app.use('/api/v1/drivers/:driverId/settlements', driverSettlementRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
