const express = require('express');
const router = express.Router();
const paymentCtrl = require('../controllers/payment.controller');
const { auth } = require('../middleware/auth.middleware');
const { check, validationResult } = require('express-validator');

// Middleware de validation
const validateRequest = [
    check('amount', 'Le montant est requis et doit être un nombre positif')
        .isFloat({ min: 0.01 }),
    check('userId', 'ID utilisateur requis').notEmpty(),
    check('description', 'Description du paiement requise').optional().isString(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

// Créer une intention de paiement
router.post('/create-payment-intent', 
    auth,
    validateRequest,
    paymentCtrl.createPaymentIntent
);

// Vérifier le statut d'un paiement
router.get('/verify-payment/:transactionId', 
    auth,
    paymentCtrl.verifyPayment
);

// Routes pour les retours de paiement (sans authentification car appelées par SumUp)
router.get('/payment/return', paymentCtrl.handlePaymentReturn);
router.get('/payment/cancel', paymentCtrl.handlePaymentCancel);

// Note: La route webhook est commentée car la fonction handleWebhook n'existe pas encore dans le contrôleur
// Décommentez et implémentez-la quand vous serez prêt
/*
router.post('/webhook/sumup', 
    express.raw({ type: 'application/json' }),
    paymentCtrl.handleWebhook
);
*/

module.exports = router;
