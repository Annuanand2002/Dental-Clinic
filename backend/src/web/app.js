const express = require('express');
const cors = require('cors');
const { errorHandler, notFoundHandler } = require('../web/middleware/errorHandlers');

// Routes
const authRoutes = require('../features/auth/infrastructure/routes/authRoutes');
const organisationRoutes = require('../features/organisation/infrastructure/routes/organisationRoutes');
const doctorRoutes = require('../features/doctor/infrastructure/routes/doctorRoutes');
const patientRoutes = require('../features/patient/infrastructure/routes/patientRoutes');
const appointmentRoutes = require('../features/appointment/infrastructure/routes/appointmentRoutes');
const staffRoutes = require('../features/staff/infrastructure/routes/staffRoutes');
const inventoryRoutes = require('../features/inventory/infrastructure/routes/inventoryRoutes');
const financialRoutes = require('../features/financial/infrastructure/routes/financialRoutes');
const attachmentRoutes = require('../features/attachment/infrastructure/routes/attachmentRoutes');
const usersRoutes = require('../features/users/infrastructure/routes/usersRoutes');

const app = express();

const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: corsOrigin || true
  })
);
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/organisation', organisationRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/users', usersRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

