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

module.exports = router;
