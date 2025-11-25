const express = require('express');
const router = express.Router();
const apptCtrl = require('../controllers/appointment.controller');
const { auth, isAdmin } = require('../middleware/auth.middleware');

router.post('/', auth, apptCtrl.bookAppointment);
router.get('/me', auth, apptCtrl.getUserAppointments);
router.delete('/:id', auth, apptCtrl.cancelAppointment);
router.get('/', auth, isAdmin, apptCtrl.getAllAppointments);
router.get('/manques', auth, isAdmin, apptCtrl.getMissedAppointments);

module.exports = router;
