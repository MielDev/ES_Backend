const nodemailer = require('nodemailer');
const { User } = require('../models');
const MailHistory = require('../models/mailhistory.model');

// Configuration du transporteur email
const createTransporter = () => {
    return nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            rejectUnauthorized: false // Pour les environnements de développement
        }
    });
};

// Récupérer les destinataires selon le type
const getRecipients = async (recipientsType) => {
    const whereClause = {
        isActive: true,
        isDeleted: false
    };

    switch (recipientsType) {
        case 'admins':
            whereClause.role = 'administrateur';
            break;
        case 'users':
            whereClause.role = 'utilisateur';
            break;
        case 'all':
        default:
            // Tous les utilisateurs actifs
            break;
    }

    const users = await User.findAll({
        where: whereClause,
        attributes: ['id', 'email', 'nom', 'prenom', 'role']
    });

    return users.map(user => ({
        id: user.id,
        email: user.email,
        name: `${user.prenom} ${user.nom}`,
        role: user.role
    }));
};

// Envoyer un email à un seul destinataire
const sendSingleEmail = async (transporter, recipient, subject, content) => {
    try {
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'Épicerie Solidaire'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to: recipient.email,
            subject: subject,
            html: content,
            text: content.replace(/<[^>]*>/g, '') // Version texte brut
        };

        const result = await transporter.sendMail(mailOptions);
        return {
            success: true,
            messageId: result.messageId,
            response: result.response
        };
    } catch (error) {
        console.error(`Erreur lors de l'envoi à ${recipient.email}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Envoyer des emails en lot avec progression
const sendBulkEmails = async (recipients, subject, content, onProgress) => {
    const transporter = createTransporter();
    const results = {
        sent: 0,
        failed: 0,
        errors: []
    };

    const totalRecipients = recipients.length;

    for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        
        try {
            const result = await sendSingleEmail(transporter, recipient, subject, content);
            
            if (result.success) {
                results.sent++;
            } else {
                results.failed++;
                results.errors.push({
                    email: recipient.email,
                    error: result.error
                });
            }

            // Notifier la progression
            if (onProgress) {
                const progress = Math.round(((i + 1) / totalRecipients) * 100);
                onProgress({
                    progress,
                    sentCount: results.sent,
                    failedCount: results.failed,
                    totalCount: totalRecipients,
                    currentRecipient: recipient.email
                });
            }

            // Pause pour éviter de surcharger le serveur SMTP
            if (i < recipients.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

        } catch (error) {
            results.failed++;
            results.errors.push({
                email: recipient.email,
                error: error.message
            });
        }
    }

    transporter.close();
    return results;
};

// Tester la configuration email
const testEmailConfiguration = async () => {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        transporter.close();
        
        return {
            success: true,
            message: 'Configuration SMTP valide'
        };
    } catch (error) {
        return {
            success: false,
            message: `Erreur de configuration: ${error.message}`
        };
    }
};

// Sauvegarder l'historique d'envoi
const saveMailHistory = async (mailData, results, userId) => {
    try {
        const status = results.failed === 0 ? 'sent' : 
                     results.sent === 0 ? 'failed' : 'partial';

        const history = await MailHistory.create({
            subject: mailData.subject,
            content: mailData.content,
            recipients: mailData.recipients,
            sentCount: results.sent,
            failedCount: results.failed,
            totalCount: results.sent + results.failed,
            status: status,
            sentBy: userId,
            sentAt: new Date(),
            completedAt: new Date(),
            errorMessage: results.errors.length > 0 ? 
                JSON.stringify(results.errors.slice(0, 5)) : null,
            metadata: {
                totalRecipients: results.sent + results.failed,
                errors: results.errors.length
            }
        });

        return history;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de l\'historique:', error);
        return null;
    }
};

module.exports = {
    createTransporter,
    getRecipients,
    sendSingleEmail,
    sendBulkEmails,
    testEmailConfiguration,
    saveMailHistory
};
