const express = require('express');
const router = express.Router();
const adminCtrl = require('../controllers/admin.controller');
const { auth, isAdmin } = require('../middleware/auth.middleware');

// Configuration des créneaux
router.get('/config', auth, isAdmin, adminCtrl.getAdminConfig);
router.post('/config', auth, isAdmin, adminCtrl.createOrUpdateConfig);
router.delete('/config/:date_specifique', auth, isAdmin, adminCtrl.deleteConfig);

// Gestion des utilisateurs
router.get('/users', auth, isAdmin, adminCtrl.getAllUsers);
router.get('/users/:id', auth, isAdmin, adminCtrl.getUserById);
router.put('/users/:id', auth, isAdmin, adminCtrl.updateUser); // Mise à jour complète
router.patch('/users/:id/toggle-active', auth, isAdmin, adminCtrl.toggleUserActive);
router.patch('/users/:id/passages', auth, isAdmin, adminCtrl.updateUserPassages);

// Validation des rendez-vous
router.get('/appointments', auth, isAdmin, adminCtrl.getAllAppointmentsForAdmin);
router.get('/appointments/unvalidated', auth, isAdmin, adminCtrl.getUnvalidatedAppointments);
router.patch('/appointments/:id/validate', auth, isAdmin, adminCtrl.validateAppointment);

// Gestion des justificatifs étudiants
router.get('/users/pending-validation', auth, isAdmin, adminCtrl.getUsersPendingValidation);
router.get('/users/:id/justificatif', auth, isAdmin, adminCtrl.getStudentJustificatifInfo);
router.patch('/users/:id/justificatif', auth, isAdmin, adminCtrl.uploadJustificatif);
router.patch('/users/:id/validate-justificatif', auth, isAdmin, adminCtrl.validateStudentJustificatif);

module.exports = router;
