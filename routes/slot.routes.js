const express = require('express');
const router = express.Router();
const slotCtrl = require('../controllers/slot.controller');
const { auth, isAdmin } = require('../middleware/auth.middleware');

// Créer un créneau principal manuellement
router.post('/', auth, isAdmin, slotCtrl.createSlot);

// Générer les créneaux détaillés depuis un slot principal
router.post('/:slotId/generate-intervals', auth, isAdmin, slotCtrl.generateIntervalSlots);

// Lister tous les créneaux principaux
router.get('/', auth, slotCtrl.getSlots);

// Lister les créneaux disponibles pour les étudiants
router.get('/intervals', auth, slotCtrl.getIntervalSlots);

// Mettre à jour un créneau principal
router.put('/:id', auth, isAdmin, slotCtrl.updateSlot);

// Supprimer un créneau principal
router.delete('/:id', auth, isAdmin, slotCtrl.deleteSlot);

module.exports = router;
