const { validationResult } = require('express-validator');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const sumupConfig = require('../config/sumup.config');
const axios = require('axios');

// Créer une intention de paiement
const createPaymentIntent = async (req, res) => {
    console.log('Requête reçue pour créer une intention de paiement:', req.body);

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('Erreurs de validation:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { amount, description, userId } = req.body;

        console.log('Tentative de création de paiement pour l\'utilisateur:', userId, 'Montant:', amount);

        // Vérifier si l'utilisateur existe
        const user = await User.findByPk(userId);
        if (!user) {
            console.error('Utilisateur non trouvé avec l\'ID:', userId);
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé',
                error: { userId }
            });
        }

        // Créer une nouvelle transaction
        let transaction;
        try {
            transaction = await Transaction.create({
                userId: userId,
                amount: parseFloat(amount),
                description: description || 'Paiement Epicerie Solidaire',
                status: 'pending'
            });
            console.log('Transaction créée avec succès:', transaction.id);
        } catch (error) {
            console.error('Erreur lors de la communication avec SumUp:');
            console.error('- Statut de l\'erreur:', error.response?.status);
            console.error('- Données de l\'erreur:', error.response?.data);
            console.error('- Message d\'erreur:', error.message);

            // Mettre à jour le statut de la transaction en échec
            if (transaction) {
                try {
                    await transaction.update({ status: 'failed' });
                } catch (updateError) {
                    console.error('Erreur lors de la mise à jour du statut de la transaction:', updateError);
                }
            }

            return res.status(error.response?.status || 500).json({
                success: false,
                message: 'Erreur lors de la communication avec le processeur de paiement',
                error: process.env.NODE_ENV === 'development' ? {
                    status: error.response?.status,
                    data: error.response?.data,
                    message: error.message
                } : {}
            });
        }

        // Construction des URLs de retour
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/(\/)+$/, '');
        const returnUrl = new URL(`/payment/return?transactionId=${transaction.id}`, frontendUrl).toString();
        const cancelUrl = new URL(`/payment/cancel?transactionId=${transaction.id}`, frontendUrl).toString();

        console.log('URLs de retour configurées:');
        console.log('- URL de retour:', returnUrl);
        console.log('- URL d\'annulation:', cancelUrl);

        // Configuration de l'appel à l'API SumUp
        const paymentData = {
            checkout_reference: `PAYMENT_${Date.now()}_${transaction.id}`,
            amount: parseFloat(amount).toFixed(0), // Le montant est déjà en centimes
            currency: sumupConfig.defaultCurrency,
            merchant_code: sumupConfig.merchantCode,
            description: description || sumupConfig.defaultDescription,
            return_url: returnUrl,
            cancel_url: cancelUrl,
            country: sumupConfig.defaultCountry,
            pay_to_email: process.env.SUMUP_PAY_TO_EMAIL,
            payment_type: 'card',
            transaction_id: transaction.id.toString(),
            customer: {
                first_name: user.prenom || '',
                last_name: user.nom || '',
                email: user.email || ''
            },
            billing_address: {
                line1: user.adresse || 'Non spécifiée',
                city: user.ville || 'Non spécifiée',
                postal_code: user.code_postal || '00000',
                country: sumupConfig.defaultCountry
            }
        };

        console.log('Configuration SumUp:');
        console.log('- URL:', `${sumupConfig.apiUrl}/v0.1/checkouts`);
        console.log('- Clé API:', sumupConfig.apiKey ? 'PRÉSENTE' : 'MANQUANTE');
        console.log('Données du paiement:', JSON.stringify(paymentData, null, 2));

        try {
            if (!sumupConfig.apiKey) {
                throw new Error('Clé API SumUp non configurée');
            }

            console.log('Envoi de la requête à SumUp...');
            const response = await axios.post(
                `${sumupConfig.apiUrl}/v0.1/checkouts`,
                paymentData,
                {
                    headers: {
                        'Authorization': `Bearer ${sumupConfig.apiKey}`,
                        'Content-Type': 'application/json',
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 10000 // 10 secondes de timeout
                }
            );

            console.log('Réponse de SumUp:', JSON.stringify(response.data, null, 2));

            if (!response.data || !response.data.id) {
                throw new Error('Réponse invalide de l\'API SumUp');
            }

            // Mettre à jour la transaction avec la référence de paiement
            transaction.transactionId = response.data.id;
            transaction.status = 'pending';
            await transaction.save();


        } catch (error) {
            console.error('Erreur lors de l\'appel à l\'API SumUp:', {
                message: error.message,
                response: error.response?.data,
                stack: error.stack
            });

            // Marquer la transaction comme échouée
            transaction.status = 'failed';
            transaction.error = error.response?.data?.message || error.message;
            await transaction.save();

            // Relancer l'erreur pour le gestionnaire global
            throw new Error(`Échec de la création du paiement: ${error.message}`);
        }
    } catch (error) {
        console.error('Erreur lors de la création du paiement:', {
            message: error.message,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de la création du paiement',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
};

// Vérifier le statut d'une transaction
const verifyPayment = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const transaction = await Transaction.findByPk(transactionId, {
            include: [
                {
                    model: User,
                    attributes: ['id', 'nom', 'prenom', 'email']
                }
            ]
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction non trouvée'
            });
        }

        res.status(200).json({
            success: true,
            data: transaction
        });

    } catch (error) {
        console.error('Erreur lors de la vérification du paiement:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la vérification du paiement',
            error: error.message
        });
    }
};

// Gérer le retour de paiement
const handlePaymentReturn = async (req, res) => {
    // Code pour gérer le retour de paiement
};

// Gérer l'annulation de paiement
const handlePaymentCancel = async (req, res) => {
    // Code pour gérer l'annulation de paiement
};

module.exports = {
    createPaymentIntent,
    verifyPayment,
    handlePaymentReturn,
    handlePaymentCancel,
};
