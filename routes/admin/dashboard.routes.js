const express = require('express');
const router = express.Router();
const { getAdminDashboardStats } = require('../../controllers/stats.controller');
const { verifyToken, isAdmin } = require('../../middleware/auth.middleware');

// Route protégée pour le tableau de bord admin
router.get('/stats', verifyToken, isAdmin, getAdminDashboardStats);

module.exports = router;
