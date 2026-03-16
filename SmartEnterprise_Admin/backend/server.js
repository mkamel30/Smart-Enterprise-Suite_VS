require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
const authRoutes = require('./src/routes/auth');
const branchRoutes = require('./src/routes/branches');
const parameterRoutes = require('./src/routes/parameters');

app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/parameters', parameterRoutes);

// Basic Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Central Admin Portal API is running' });
});

// Future: Admin Routes, Sync Routes, Release Routes, etc.

const logger = require('./utils/logger');
const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
    logger.info(`--- Central Admin Portal running on port ${PORT} ---`);
});
