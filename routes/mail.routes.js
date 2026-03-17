const express = require('express');
const mailController = require('../controllers/mail.controller');
const { auth, isAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// Route principale d'envoi de mail
router.post('/send-to-all',
    auth,
    isAdmin,
    mailController.validateMailRequest,
    mailController.sendToAll
);

// Route pour récupérer la liste des destinataires
router.get('/recipients/:type',
    auth,
    isAdmin,
    mailController.getRecipients
);

// Route pour tester la configuration email
router.get('/test-config',
    auth,
    isAdmin,
    mailController.testConfig
);

// Route pour récupérer les statistiques d'envoi
router.get('/statistics',
    auth,
    isAdmin,
    mailController.getStatistics
);

// Route pour récupérer l'historique des envois
router.get('/history',
    auth,
    isAdmin,
    mailController.getHistory
);

module.exports = router;
