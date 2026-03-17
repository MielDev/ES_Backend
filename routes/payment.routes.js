// Dans payment.routes.js
const express = require('express');
const router = express.Router();
const paymentCtrl = require('../controllers/payment.controller');
const { auth } = require('../middleware/auth.middleware');
const { check, validationResult } = require('express-validator');

// Middleware de logging pour le débogage
const requestLogger = (req, res, next) => {
    console.log(`\n=== NOUVELLE REQUÊTE ${req.method} ${req.path} ===`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Query:', JSON.stringify(req.query, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    next();
};

// Middleware de validation pour la création de transaction
const validateTransaction = [
    check('amount', 'Le montant est requis et doit être un nombre positif')
        .isFloat({ min: 0.01 }),
    check('description', 'Description du paiement requise').optional().isString(),
    check('currency', 'Devise invalide').optional().isString().isLength({ min: 3, max: 3 }),
    check('paymentMethod', 'Méthode de paiement invalide')
        .optional()
        .isIn(['card', 'cash', 'transfer', 'other']),
    check('paymentDetails', 'Détails de paiement invalides').optional().isObject(),
    check('metadata', 'Métadonnées invalides').optional().isObject(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('Erreurs de validation:', errors.array());
            return res.status(400).json({ 
                success: false,
                message: 'Erreur de validation',
                errors: errors.array() 
            });
        }
        next();
    }
];

// Middleware de validation pour la mise à jour du statut
const validateStatusUpdate = [
    check('status', 'Statut de transaction invalide')
        .isIn(['pending', 'completed', 'failed', 'cancelled']),
    check('paymentDetails', 'Détails de paiement invalides').optional().isObject(),
    check('error', 'Message d\'erreur invalide').optional().isString(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false,
                message: 'Erreur de validation',
                errors: errors.array() 
            });
        }
        next();
    }
];

// Appliquer le middleware de logging à toutes les routes
router.use(requestLogger);

// ============================================
// ROUTES DES TRANSACTIONS
// ============================================

// Créer une nouvelle transaction
router.post('/transactions', 
    auth,
    validateTransaction,
    paymentCtrl.createTransaction
);

// Récupérer une transaction par son ID
router.get('/transactions/:transactionId', 
    auth,
    paymentCtrl.getTransaction
);

// Lister les transactions de l'utilisateur
router.get('/transactions', 
    auth,
    paymentCtrl.listUserTransactions
);

// Mettre à jour le statut d'une transaction
router.patch('/transactions/:transactionId/status',
    auth,
    validateStatusUpdate,
    paymentCtrl.updateTransactionStatus
);

// Annuler une transaction
router.post('/transactions/:transactionId/cancel',
    auth,
    paymentCtrl.cancelTransaction
);


// Middleware de gestion des erreurs
router.use((err, req, res, next) => {
    console.error('❌ ERREUR NON GÉRÉE:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method
    });
    
    // Réponse d'erreur formatée
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ 
        success: false, 
        message: err.message || 'Une erreur est survenue sur le serveur',
        error: process.env.NODE_ENV === 'development' ? {
            message: err.message,
            stack: err.stack,
            ...err
        } : undefined
    });
});

// Gestion des routes non trouvées
router.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route non trouvée',
        path: req.originalUrl
    });
});

module.exports = router;