import express from 'express';
import authRoutes from './authRoutes.js';
import graphRouter from "./graph.js";
import userRoutes from "./userRoutes.js";
import consentRoutes from "./consentRoutes.js";
import auditRoutes from "./auditRoutes.js";
import flProgressRouter from "./flProgress.js";

const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'API is healthy' });
});

// Authentication routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/consent', consentRoutes);
router.use('/audit', auditRoutes);
router.use("/", flProgressRouter);
router.use("/", graphRouter);
// Add your resource routes here

export default router;
