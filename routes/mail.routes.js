const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { 
    getRecipients, 
    sendBulkEmails, 
    testEmailConfiguration, 
    saveMailHistory 
} = require('../services/mail.service');
const { MailHistory } = require('../models/mailhistory.model');

const router = express.Router();

// Middleware de validation du token JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token d\'authentification manquant'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Token invalide ou expiré'
            });
        }
        req.user = user;
        next();
    });
};

// Middleware pour vérifier si l'utilisateur est admin
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Accès refusé - Permissions administrateur requises'
        });
    }
    next();
};

// Validation pour l'envoi de mail
const validateMailRequest = [
    body('subject')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Le sujet doit contenir entre 1 et 200 caractères'),
    body('content')
        .trim()
        .isLength({ min: 10, max: 10000 })
        .withMessage('Le contenu doit contenir entre 10 et 10 000 caractères'),
    body('recipients')
        .isIn(['all', 'admins', 'users'])
        .withMessage('Les destinataires doivent être: all, admins ou users')
];

// Route principale d'envoi de mail
router.post('/send-to-all', authenticateToken, requireAdmin, validateMailRequest, async (req, res) => {
    try {
        // Vérifier les erreurs de validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Erreurs de validation',
                errors: errors.array().map(err => err.msg)
            });
        }

        const { subject, content, recipients } = req.body;

        // Démarrer la réponse en streaming pour la progression
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked'
        });

        // Récupérer les destinataires
        const recipientsList = await getRecipients(recipients);
        
        if (recipientsList.length === 0) {
            res.end(JSON.stringify({
                success: false,
                message: 'Aucun destinataire trouvé pour ce type'
            }));
            return;
        }

        // Envoyer les emails avec suivi de progression
        const results = await sendBulkEmails(
            recipientsList, 
            subject, 
            content,
            (progress) => {
                // Envoyer la progression au client
                res.write(JSON.stringify({
                    progress: progress.progress,
                    message: `Envoi en cours... ${progress.progress}%`,
                    sentCount: progress.sentCount,
                    failedCount: progress.failedCount,
                    totalCount: progress.totalCount
                }) + '\n');
            }
        );

        // Sauvegarder l'historique
        await saveMailHistory(
            { subject, content, recipients },
            results,
            req.user.id
        );

        // Envoyer le résultat final
        const finalResponse = {
            success: results.failed === 0,
            message: results.failed === 0 ? 
                'Emails envoyés avec succès' : 
                `${results.sent} envoyés, ${results.failed} échecs`,
            sentCount: results.sent,
            failedCount: results.failed,
            totalCount: results.sent + results.failed,
            progress: 100
        };

        res.end(JSON.stringify(finalResponse));

    } catch (error) {
        console.error('Erreur lors de l\'envoi des emails:', error);
        
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Erreur serveur lors de l\'envoi des emails',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } else {
            res.end(JSON.stringify({
                success: false,
                message: 'Erreur lors de l\'envoi',
                progress: 0
            }));
        }
    }
});

// Route pour récupérer la liste des destinataires
router.get('/recipients/:type', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { type } = req.params;
        
        if (!['all', 'admins', 'users'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Type de destinataires invalide'
            });
        }

        const recipients = await getRecipients(type);
        
        res.json({
            success: true,
            data: recipients.map(r => ({
                id: r.id,
                email: r.email,
                name: r.name,
                role: r.role
            })),
            total: recipients.length
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des destinataires:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

// Route pour tester la configuration email
router.get('/test-config', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const testResult = await testEmailConfiguration();
        
        res.json(testResult);

    } catch (error) {
        console.error('Erreur lors du test de configuration:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du test de configuration'
        });
    }
});

// Route pour récupérer les statistiques d'envoi
router.get('/statistics', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const stats = await MailHistory.findAll({
            attributes: [
                [require('sequelize').fn('COUNT', '*'), 'totalSent'],
                [require('sequelize').fn('SUM', require('sequelize').col('failedCount')), 'totalFailed'],
                [require('sequelize').fn('MAX', require('sequelize').col('sentAt')), 'lastSentDate']
            ],
            where: {
                status: ['sent', 'partial']
            }
        });

        const result = stats[0];
        
        res.json({
            success: true,
            data: {
                totalSent: parseInt(result.dataValues.totalSent) || 0,
                totalFailed: parseInt(result.dataValues.totalFailed) || 0,
                lastSentDate: result.dataValues.lastSentDate
            }
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

// Route pour récupérer l'historique des envois
router.get('/history', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const { count, rows: mails } = await MailHistory.findAndCountAll({
            include: [{
                model: require('../models/user.model'),
                as: 'sender',
                attributes: ['id', 'nom', 'prenom', 'email'],
                required: false
            }],
            order: [['sentAt', 'DESC']],
            limit,
            offset
        });

        res.json({
            success: true,
            data: {
                mails: mails.map(mail => ({
                    id: mail.id,
                    subject: mail.subject,
                    recipients: mail.recipients,
                    sentCount: mail.sentCount,
                    failedCount: mail.failedCount,
                    totalCount: mail.totalCount,
                    status: mail.status,
                    sentDate: mail.sentAt,
                    sentBy: mail.sender ? {
                        id: mail.sender.id,
                        name: `${mail.sender.prenom} ${mail.sender.nom}`,
                        email: mail.sender.email
                    } : null
                })),
                total: count,
                page,
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Erreur lors de la récupération de l\'historique:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

module.exports = router;
