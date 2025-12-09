const express = require('express');
const router = express.Router();
const studentCtrl = require('../controllers/auth.student.controller');
const { auth, isAdmin } = require('../middleware/auth.middleware');
const { handleUpload } = require('../middleware/upload.middleware');

// Inscription étudiant avec formulaire complet et upload
router.post('/register-student', handleUpload, studentCtrl.registerStudent);

// Profil étudiant
router.get('/student-profile', auth, studentCtrl.getStudentProfile);

// Mettre à jour le profil étudiant avec gestion du fichier justificatif
router.put('/student-profile', auth, handleUpload, studentCtrl.updateStudentProfile);

// Télécharger justificatif (admin ou propriétaire)
router.get('/download-justificatif/:userId', auth, studentCtrl.downloadJustificatif);

// Mot de passe oublié
router.post('/forgot-password', studentCtrl.forgotPassword);

// Afficher le formulaire de réinitialisation (GET)
router.get('/reset-password/:token', studentCtrl.showResetPasswordForm);

// Traiter la soumission du formulaire (POST)
router.post('/reset-password/:token', studentCtrl.resetPassword);

module.exports = router;
