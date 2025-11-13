const express = require('express');
const router = express.Router();
const slotCtrl = require('../controllers/slot.controller');
const { auth, isAdmin } = require('../middleware/auth.middleware');

router.post('/generate', auth, isAdmin, slotCtrl.generateSlotsFromConfig);
router.post('/', auth, isAdmin, slotCtrl.createSlot);
router.get('/', auth, slotCtrl.getSlots);
router.put('/:id', auth, isAdmin, slotCtrl.updateSlot);
router.delete('/:id', auth, isAdmin, slotCtrl.deleteSlot);

module.exports = router;
