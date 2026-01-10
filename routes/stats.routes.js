const express = require('express');
const router = express.Router();
const statsController = require('../controllers/stats.controller');

// Récupérer les statistiques du tableau de bord admin
router.get('/', statsController.getAdminDashboardStats);

// Récupérer les statistiques mensuelles
router.get('/monthly', statsController.getMonthlyStats);

// Récupérer les statistiques par pays
router.get('/by-country', statsController.getStatsByCountry);

module.exports = router;
