const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const prisma = require('./lib/prisma');
const config = require('./config');
const { startAutoAttendanceCron, startCleanupCron } = require('./utils/cron');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leave');
const activityRoutes = require('./routes/activity');
const exportRoutes = require('./routes/export');
const settingsRoutes = require('./routes/settings');
const finesRoutes = require('./routes/fines');

const app = express();


app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too Many Requests',
    message: 'มีการเรียกใช้งาน API บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
  },
});
app.use(globalLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/leave', leaveRoutes);
app.use('/activity', activityRoutes);
app.use('/export', exportRoutes);
app.use('/settings', settingsRoutes);
app.use('/fines', finesRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'Route not found' });
});

app.use((err, req, res, _next) => {
  console.error(err);

  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Conflict', message: 'Duplicate record' });
  }

  if (err.message?.includes('Only JPEG')) {
    return res.status(400).json({ error: 'Bad Request', message: err.message });
  }

  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong',
  });
});

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Server running on port ${config.port} (${config.nodeEnv})`);
  startAutoAttendanceCron();
  startCleanupCron();
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  server.close();
});

module.exports = app;
