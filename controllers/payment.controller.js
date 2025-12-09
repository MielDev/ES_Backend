const { validationResult } = require('express-validator');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/db');
const { Op } = require('sequelize');

// ============================================
// 1️⃣ CRÉER UNE TRANSACTION
// ============================================
const createTransaction = async (req, res) => {
    console.log('=== DÉBUT createTransaction ===');
    
    try {
        // Validation des données
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('❌ Erreurs de validation:', errors.array());
            return res.status(400).json({
                success: false,
                message: 'Données de transaction invalides',
                errors: errors.array()
            });
        }

        const { 
            amount, 
            description, 
            status,
            currency = 'EUR',
            paymentMethod = 'card',
            paymentDetails = {},
            metadata = {}
        } = req.body;

        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Utilisateur non authentifié'
            });
        }

        // Vérification que l'utilisateur existe
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        // Validation du montant
        const amountValue = parseFloat(amount);
        if (isNaN(amountValue) || amountValue <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Le montant doit être un nombre positif'
            });
        }

        // Création de la transaction avec statut initial
        const transaction = await Transaction.create({
            userId,
            amount: amountValue,
            currency,
            description: description || 'Paiement Epicerie Solidaire',
            status: 'completed', // Le statut est forcé à 'completed' car le paiement a réussi
            paymentMethod,
            paymentDetails: {
                ...paymentDetails,
              
                updatedAt: new Date().toISOString()
            },
            reference: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            metadata: {
                ...metadata,
                createdAt: new Date().toISOString()
            }
        });

        console.log(`✅ Transaction créée: ${transaction.id}`);

        // Mettre à jour la méthode de paiement de l'utilisateur
        await user.update({
            paiement: true,
            paymentMethod: paymentMethod,
            lastPaymentDate: new Date()
        });
        console.log(`✅ Méthode de paiement mise à jour pour l'utilisateur ${user.id}`);

        // Réponse au client
        return res.status(201).json({
            success: true,
            transaction: {
                id: transaction.id,
                reference: transaction.reference,
                amount: transaction.amount,
                currency: transaction.currency,
                status: transaction.status, 
                paymentMethod: transaction.paymentMethod,
                createdAt: transaction.createdAt,
                updatedAt: transaction.updatedAt
            }
        });

    } catch (error) {
        console.error('❌ Erreur lors de la création de la transaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de la création de la transaction',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        console.log('=== FIN createTransaction ===\n');
    }
};

// ============================================
// 2️⃣ METTRE À JOUR LE STATUT D'UNE TRANSACTION
// ============================================
const updateTransactionStatus = async (req, res) => {
    console.log('=== DÉBUT updateTransactionStatus ===');
    console.log('Paramètres reçus:', { params: req.params, body: req.body });
    
    // Démarrer une transaction manuelle
    const t = await sequelize.transaction();
    
    try {
        const { transactionId } = req.params;
        let { status, paymentDetails = {}, error } = req.body;
        
        // Si le statut n'est pas fourni directement, essayer de le récupérer depuis paymentDetails
        if (!status && paymentDetails && paymentDetails.status) {
            status = paymentDetails.status;
            console.log('Statut extrait de paymentDetails:', status);
        }

        // Validation du statut
        const validStatuses = ['pending', 'completed', 'failed', 'cancelled', 'refunded'];
        const normalizedStatus = status ? status.trim().toLowerCase() : '';
        
        if (!validStatuses.includes(normalizedStatus)) {
            console.error('❌ Statut invalide:', status);
            return res.status(400).json({
                success: false,
                message: `Statut invalide. Doit être l'un des suivants: ${validStatuses.join(', ')}`
            });
        }

        // Récupération de la transaction avec verrouillage
        const transaction = await Transaction.findOne({
            where: { id: transactionId },
            lock: t.LOCK.UPDATE,
            transaction: t
        });

        if (!transaction) {
            console.error('❌ Transaction non trouvée:', transactionId);
            await t.rollback();
            return res.status(404).json({
                success: false,
                message: 'Transaction non trouvée'
            });
        }

        console.log('Transaction actuelle:', {
            id: transaction.id,
            currentStatus: transaction.status,
            requestedStatus: normalizedStatus
        });

        // Vérification des autorisations
        if (transaction.userId !== req.user?.id && !req.user?.isAdmin) {
            console.error('❌ Accès non autorisé à la transaction:', { 
                userId: req.user?.id, 
                isAdmin: req.user?.isAdmin 
            });
            await t.rollback();
            return res.status(403).json({
                success: false,
                message: 'Non autorisé à mettre à jour cette transaction'
            });
        }

        // Préparer les données de mise à jour
        const updateData = { 
            status: normalizedStatus,
            updatedAt: new Date()
        };
        
        // Gestion des statuts spéciaux
        if (normalizedStatus === 'completed') {
            updateData.completedAt = new Date();
            if (paymentDetails) {
                updateData.paymentDetails = { 
                    ...(transaction.paymentDetails || {}), 
                    ...paymentDetails 
                };
            }
        } else if (normalizedStatus === 'cancelled') {
            updateData.cancelledAt = new Date();
        } else if (normalizedStatus === 'refunded') {
            updateData.refundedAt = new Date();
        }
        
        if (error) {
            updateData.error = typeof error === 'string' ? error : JSON.stringify(error);
        }

        // Mise à jour de la transaction avec les données préparées
        console.log('Données de mise à jour:', updateData);
        
        // Utiliser la méthode update de l'instance pour s'assurer que les hooks sont déclenchés
        await transaction.update(updateData, { 
            transaction: t,
            fields: Object.keys(updateData)
        });
        
        // Rafraîchir l'objet transaction depuis la base de données
        await transaction.reload({ transaction: t });
        console.log('Transaction après mise à jour:', {
            id: transaction.id,
            status: transaction.status,
            updatedAt: transaction.updatedAt
        });
        
        // Valider la transaction
        await t.commit();

        console.log(`✅ Statut de la transaction ${transactionId} mis à jour: ${transaction.status} → ${normalizedStatus}`);

        return res.status(200).json({
            success: true,
            transaction: {
                id: transaction.id,
                reference: transaction.reference,
                status: transaction.status,
                updatedAt: transaction.updatedAt,
                previousStatus: transaction._previousDataValues.status
            }
        });

    } catch (error) {
        // Annuler la transaction en cas d'erreur
        if (t && !t.finished) {
            await t.rollback();
        }
        
        console.error('❌ Erreur lors de la mise à jour du statut:', error);
        return res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de la mise à jour du statut',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        console.log('=== FIN updateTransactionStatus ===\n');
    }
};

// ============================================
// 3️⃣ OBTENIR LES DÉTAILS D'UNE TRANSACTION
// ============================================
const getTransaction = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const transaction = await Transaction.findByPk(transactionId, {
            include: [
                { 
                    model: User, 
                    attributes: ['id', 'nom', 'prenom', 'email'],
                    as: 'user'
                }
            ]
        });

        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction non trouvée" });
        }

        // Vérification des autorisations
        if (transaction.userId !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Non autorisé à voir cette transaction'
            });
        }

        // Formatage de la réponse
        const response = {
            id: transaction.id,
            reference: transaction.reference,
            amount: transaction.amount,
            currency: transaction.currency,
            description: transaction.description,
            status: transaction.status,
            paymentMethod: transaction.paymentMethod,
            paymentDetails: transaction.paymentDetails,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt,
            user: {
                id: transaction.user.id,
                nom: transaction.user.nom,
                prenom: transaction.user.prenom,
                email: transaction.user.email
            }
        };

        return res.status(200).json({
            success: true,
            transaction: response
        });

    } catch (error) {
        console.error("Erreur lors de la récupération de la transaction:", error);
        return res.status(500).json({ 
            success: false, 
            message: 'Une erreur est survenue lors de la récupération de la transaction',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// 4️⃣ LISTER LES TRANSACTIONS D'UN UTILISATEUR
// ============================================
const listUserTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 10, offset = 0, status } = req.query;

        // Options de la requête
        const options = {
            where: { userId },
            order: [['createdAt', 'DESC']],
            limit: Math.min(parseInt(limit), 100),
            offset: parseInt(offset)
        };

        // Filtre par statut si fourni
        if (status) {
            options.where.status = status;
        }

        const { count, rows: transactions } = await Transaction.findAndCountAll(options);

        // Formatage de la réponse
        const formattedTransactions = transactions.map(transaction => ({
            id: transaction.id,
            reference: transaction.reference,
            amount: transaction.amount,
            currency: transaction.currency,
            description: transaction.description,
            status: transaction.status,
            paymentMethod: transaction.paymentMethod,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt
        }));

        return res.status(200).json({
            success: true,
            data: formattedTransactions,
            pagination: {
                total: count,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        console.error("Erreur lors de la récupération des transactions:", error);
        return res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de la récupération des transactions',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// 5️⃣ ANNULER UNE TRANSACTION
// ============================================
const cancelTransaction = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const userId = req.user.id;

        // Récupération de la transaction
        const transaction = await Transaction.findByPk(transactionId);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction non trouvée'
            });
        }

        // Vérification des autorisations
        if (transaction.userId !== userId && !req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Non autorisé à annuler cette transaction'
            });
        }

        // Vérification que la transaction peut être annulée
        if (transaction.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Seules les transactions en attente peuvent être annulées'
            });
        }

        // Mise à jour du statut
        await transaction.update({ 
            status: 'cancelled',
            cancelledAt: new Date()
        });

        return res.status(200).json({
            success: true,
            message: 'Transaction annulée avec succès',
            transaction: {
                id: transaction.id,
                status: 'cancelled',
                updatedAt: transaction.updatedAt
            }
        });

    } catch (error) {
        console.error("Erreur lors de l'annulation de la transaction:", error);
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de l'annulation de la transaction",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// 6️⃣ WEBHOOK POUR LES PAIEMENTS EXTERNES (optionnel)
// ============================================
const handlePaymentWebhook = async (req, res) => {
    try {
        const { event, data } = req.body;
        
        // Log pour le débogage
        console.log('Webhook reçu:', { event, data });
        
        // Vérification du format de la requête
        if (!event || !data || !data.reference) {
            return res.status(400).json({
                success: false,
                message: 'Format de requête invalide'
            });
        }

        // Recherche de la transaction par référence
        const transaction = await Transaction.findOne({
            where: { reference: data.reference }
        });

        if (!transaction) {
            console.error('Transaction non trouvée pour la référence:', data.reference);
            return res.status(404).json({
                success: false,
                message: 'Transaction non trouvée'
            });
        }

        // Traitement en fonction du type d'événement
        let status;
        switch (event) {
            case 'payment.succeeded':
                status = 'completed';
                break;
            case 'payment.failed':
                status = 'failed';
                break;
            case 'payment.refunded':
                status = 'refunded';
                break;
            default:
                return res.status(200).json({
                    success: true,
                    message: 'Événement non traité',
                    event
                });
        }

        // Mise à jour de la transaction
        await transaction.update({
            status,
            paymentDetails: {
                ...transaction.paymentDetails,
                lastWebhookEvent: {
                    event,
                    receivedAt: new Date(),
                    data
                }
            }
        });

        // Réponse de succès
        return res.status(200).json({
            success: true,
            message: `Transaction mise à jour: ${status}`
        });

    } catch (error) {
        console.error('Erreur lors du traitement du webhook:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur lors du traitement du webhook',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// EXPORT DES FONCTIONS
// ============================================
module.exports = {
    // Création et gestion des transactions
    createTransaction,
    getTransaction,
    listUserTransactions,
    updateTransactionStatus,
    cancelTransaction,
    
    // Webhook pour les paiements externes
    handlePaymentWebhook
};

// ============================================
// 4️⃣ RETURN / CANCEL
// ============================================
const handlePaymentReturn = async (req, res) => {
    const { transactionId } = req.query;
    const frontend = (process.env.FRONTEND_URL || "http://localhost:4200").replace(/\/$/, "");

    return res.redirect(`${frontend}/payment/success?transactionId=${transactionId}`);
};

const handlePaymentCancel = async (req, res) => {
    const { transactionId } = req.query;

    if (transactionId) {
        await Transaction.update({ status: "cancelled" }, { where: { id: transactionId } });
    }

    const frontend = (process.env.FRONTEND_URL || "http://localhost:4200").replace(/\/$/, "");
    return res.redirect(`${frontend}/payment/cancelled`);
};


// EXPORTS
module.exports = {
    createTransaction,
    updateTransactionStatus,
    getTransaction,
    listUserTransactions,
    cancelTransaction,
    handlePaymentWebhook
};
