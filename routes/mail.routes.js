const express = require('express');
const mailController = require('../controllers/mail.controller');

const router = express.Router();

// Route principale d'envoi de mail
router.post('/send-to-all',
    mailController.authenticateToken,
    mailController.requireAdmin,
    mailController.validateMailRequest,
    mailController.sendToAll
);

// Route pour récupérer la liste des destinataires
router.get('/recipients/:type',
    mailController.authenticateToken,
    mailController.requireAdmin,
    mailController.getRecipients
);

// Route pour tester la configuration email
router.get('/test-config',
    mailController.authenticateToken,
    mailController.requireAdmin,
    mailController.testConfig
);

// Route pour récupérer les statistiques d'envoi
router.get('/statistics',
    mailController.authenticateToken,
    mailController.requireAdmin,
    mailController.getStatistics
);

// Route pour récupérer l'historique des envois
router.get('/history',
    mailController.authenticateToken,
    mailController.requireAdmin,
    mailController.getHistory
);

module.exports = router;
