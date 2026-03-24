const { sequelize, AdminConfig, User, Appointment, Payment, Slot, IntervalSlot, Affiche, SystemSetting, AcademicYearStats } = require('../models');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Marquer les rendez-vous non validés comme manqués
exports.markMissedAppointments = async (req, res) => {
    console.log('=== DÉBUT CLÔTURE JOURNÉE ===');

    let transaction;
    try {
        transaction = await sequelize.transaction();

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayStr = today.toISOString().split('T')[0];

        console.log('Date actuelle:', now.toISOString());
        console.log('Date de comparaison:', todayStr);

        // 1. Trouver les rendez-vous non validés dont la date est passée
        // ✅ RETIRER deletedAt IS NULL
        const appointments = await sequelize.query(
            `SELECT 
                id,
                status,
                date_rdv,
                heure_debut,
                heure_fin,
                valide_par_admin,
                intervalSlotId,
                userId
             FROM Appointments 
             WHERE status = 'confirmé' 
             AND (valide_par_admin = 0 OR valide_par_admin = false OR valide_par_admin IS NULL)
             AND DATE(date_rdv) < :today`,
            {
                replacements: { today: todayStr },
                type: sequelize.QueryTypes.SELECT,
                transaction
            }
        );

        console.log(`Nombre de rendez-vous trouvés: ${appointments.length}`);

        if (appointments.length > 0) {
            console.log('Premiers rendez-vous:', appointments.slice(0, 3));
        }

        if (appointments.length === 0) {
            await transaction.commit();
            return res.json({
                success: true,
                message: 'Aucun rendez-vous à marquer comme manqué',
                count: 0,
                slotsUpdated: 0
            });
        }

        // 2. Récupérer les IDs
        const slotIds = [...new Set(
            appointments
                .map(appt => appt.intervalSlotId)
                .filter(Boolean)
        )];

        const appointmentIds = appointments.map(a => a.id);

        console.log('IDs rendez-vous à marquer:', appointmentIds);
        console.log('IDs slots à désactiver:', slotIds);

        // 3. Mettre à jour les rendez-vous comme manqués
        // ✅ RETIRER deletedAt IS NULL
        await sequelize.query(
            `UPDATE Appointments 
             SET status = 'manqué', 
                 updatedAt = NOW() 
             WHERE id IN (:appointmentIds)`,
            {
                replacements: { appointmentIds },
                type: sequelize.QueryTypes.UPDATE,
                transaction
            }
        );

        console.log(`${appointments.length} rendez-vous marqués comme manqués`);

        // 5. Envoyer des emails d'avertissement aux utilisateurs
        let emailsSent = 0;
        let emailErrors = 0;

        // Récupérer les informations des utilisateurs
        const userIds = [...new Set(appointments.map(a => a.userId).filter(Boolean))];
        const users = await User.findAll({
            where: { id: userIds },
            attributes: ['id', 'nom', 'prenom', 'email'],
            transaction
        });

        const userMap = users.reduce((map, user) => {
            map[user.id] = user;
            return map;
        }, {});

        // Envoyer les emails
        for (const appointment of appointments) {
            const user = userMap[appointment.userId];
            if (user && user.email) {
                try {
                    await transporter.sendMail({
                        from: process.env.SMTP_FROM,
                        to: user.email,
                        subject: 'Avertissement : Rendez-vous manqué - Épicerie Solidaire',
                        text: `Bonjour ${user.prenom} ${user.nom},\n\nNous vous informons que votre rendez-vous du ${new Date(appointment.date_rdv).toLocaleDateString('fr-FR')} à ${appointment.heure_debut} a été marqué comme manqué.\n\nIl est important de respecter vos rendez-vous pour permettre à tous les étudiants de bénéficier du service.\n\nSi vous avez une raison valable pour votre absence, merci de nous contacter.\n\nCordialement,\nL'équipe de l'Épicerie Solidaire`,
                        html: `
                            <!DOCTYPE html>
                            <html lang="fr">
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <title>Avertissement : Rendez-vous manqué</title>
                                <style>
                                    body {
                                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                        line-height: 1.6;
                                        color: #333;
                                        max-width: 600px;
                                        margin: 0 auto;
                                        padding: 20px;
                                        background-color: #f8f8f8;
                                    }
                                    .container {
                                        background: white;
                                        padding: 30px;
                                        border-radius: 10px;
                                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                                        border-top: 4px solid #DF7841;
                                    }
                                    h1 {
                                        color: #DF7841;
                                        text-align: center;
                                        margin-bottom: 20px;
                                    }
                                    .warning-box {
                                        background: #fff3cd;
                                        border-left: 4px solid #DF7841;
                                        padding: 15px;
                                        margin: 20px 0;
                                        border-radius: 5px;
                                    }
                                    .appointment-info {
                                        background: #f8f9fa;
                                        padding: 15px;
                                        border-radius: 5px;
                                        margin: 15px 0;
                                    }
                                    .footer {
                                        text-align: center;
                                        margin-top: 30px;
                                        color: #666;
                                        font-size: 14px;
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <h1><i class="icon-warning"></i> Avertissement : Rendez-vous manqué</h1>
                                    
                                    <p>Bonjour <strong>${user.prenom} ${user.nom}</strong>,</p>
                                    
                                    <div class="warning-box">
                                        <h3><i class="icon-calendar"></i> Rendez-vous manqué</h3>
                                        <p>Nous vous informons que votre rendez-vous a été marqué comme manqué.</p>
                                    </div>
                                    
                                    <div class="appointment-info">
                                        <h4><i class="icon-list"></i> Détails du rendez-vous :</h4>
                                        <ul>
                                            <li><i class="icon-date"></i><strong>Date :</strong> ${new Date(appointment.date_rdv).toLocaleDateString('fr-FR')}</li>
                                            <li><i class="icon-clock"></i><strong>Heure :</strong> ${appointment.heure_debut}</li>
                                            <li><i class="icon-location"></i><strong>Lieu :</strong> Épicerie Solidaire<br>
                                            <small>16 Boulevard Charles Nicolle<br>72000 Le Mans</small></li>
                                        </ul>
                                    </div>
                                    
                                    <p>Il est important de respecter vos rendez-vous pour permettre à tous les étudiants de bénéficier du service.</p>
                                    
                                    <p><strong>Que faire maintenant ?</strong></p>
                                    <ul>
                                        <li><i class="icon-contact"></i> Si vous avez une raison valable pour votre absence, merci de nous contacter</li>
                                        <li><i class="icon-calendar-new"></i> Vous pouvez prendre un nouveau rendez-vous via votre espace personnel</li>
                                        <li><i class="icon-cancel"></i> Pensez à annuler à l'avance si vous ne pouvez pas venir</li>
                                    </ul>
                                    
                                    <p>Merci de votre compréhension et de votre coopération.</p>
                                    
                                    <div class="footer">
                                        <p>Cordialement,<br>L'équipe de l'Épicerie Solidaire</p>
                                        <p><small>Pour toute question, contactez-nous à l'adresse indiquée sur notre site.</small></p>
                                    </div>
                                </div>
                            </body>
                            </html>
                        `
                    });
                    emailsSent++;
                    console.log(`Email d'avertissement envoyé à ${user.email}`);
                } catch (emailError) {
                    emailErrors++;
                    console.error(`Erreur email pour ${user.email}:`, emailError.message);
                }
            }
        }

        console.log(`${emailsSent} emails envoyés, ${emailErrors} erreurs`);

        // 4. Désactiver les créneaux associés
        let slotsUpdatedCount = 0;
        if (slotIds.length > 0) {
            // ✅ RETIRER deletedAt IS NULL
            await sequelize.query(
                `UPDATE Slots 
                 SET isActive = 0, 
                     updatedAt = NOW() 
                 WHERE id IN (:slotIds)`,
                {
                    replacements: { slotIds },
                    type: sequelize.QueryTypes.UPDATE,
                    transaction
                }
            );
            slotsUpdatedCount = slotIds.length;
            console.log(`${slotsUpdatedCount} créneaux désactivés`);
        }

        await transaction.commit();
        console.log('=== CLÔTURE RÉUSSIE ===');

        res.json({
            success: true,
            message: `${appointments.length} rendez-vous ont été marqués comme manqués`,
            count: appointments.length,
            slotsUpdated: slotsUpdatedCount,
            emailsSent: emailsSent,
            emailErrors: emailErrors
        });

    } catch (err) {
        if (transaction) await transaction.rollback();

        console.error('=== ERREUR CLÔTURE ===');
        console.error('Message:', err.message);
        console.error('Stack:', err.stack);

        res.status(500).json({
            success: false,
            message: 'Erreur lors du marquage des rendez-vous manqués',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Configuration des créneaux
exports.getAdminConfig = async (req, res) => {
    try {
        const config = await AdminConfig.findAll({ order: [['date_specifique', 'ASC']] });
        res.json(config);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur récupération configuration' });
    }
};

exports.createOrUpdateConfig = async (req, res) => {
    try {
        const { date_specifique, heure_debut, heure_fin, is_active } = req.body;

        const existing = await AdminConfig.findOne({ where: { date_specifique } });
        if (existing) {
            await existing.update({ heure_debut, heure_fin, is_active });
            return res.json(existing);
        } else {
            const config = await AdminConfig.create({
                date_specifique,
                heure_debut,
                heure_fin,
                is_active
            });
            return res.status(201).json(config);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur sauvegarde configuration' });
    }
};

exports.deleteConfig = async (req, res) => {
    try {
        const date_specifique = req.params.date_specifique;
        const config = await AdminConfig.findOne({ where: { date_specifique } });
        if (!config) return res.status(404).json({ message: 'Configuration non trouvée' });

        await config.destroy();
        res.json({ message: 'Configuration supprimée' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur suppression configuration' });
    }
};

// Gestion des utilisateurs
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: { exclude: ['password'] },
            include: [
                { model: Appointment, as: 'appointments' },
                { model: Payment, as: 'payments' }
            ]
        });

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        // Convertir l'instance Sequelize en objet JavaScript simple
        const userData = user.get({ plain: true });

        // Ajouter l'URL complète du justificatif si elle existe
        if (userData.justificatif_path) {
            userData.justificatif_url = `${req.protocol}://${req.get('host')}/uploads/${userData.justificatif_path}`;
        }

        res.json(userData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur lors de la récupération de l\'utilisateur' });
    }
};

// Configuration de Multer pour le stockage des fichiers
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'justificatif-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error('Type de fichier non supporté. Seuls les fichiers PDF, JPG et PNG sont autorisés.'), false);
    }
    
    if (req.file && req.file.size > maxSize) {
        return cb(new Error(`La taille du fichier dépasse la limite de ${maxSize / (1024 * 1024)}MB`), false);
    }
    
    cb(null, true);
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { 
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 1
    }
}).single('justificatif');

// Gestion du téléchargement de justificatif
exports.uploadJustificatif = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Aucun fichier téléchargé' });
        }

        try {
            const user = await User.findByPk(req.params.id);
            if (!user) {
                // Supprimer le fichier téléchargé si l'utilisateur n'existe pas
                fs.unlinkSync(req.file.path);
                return res.status(404).json({ message: 'Utilisateur non trouvé' });
            }

            // Supprimer l'ancien fichier s'il existe
            if (user.justificatif_path) {
                const oldFilePath = path.join(__dirname, '../uploads', user.justificatif_path);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }

            // Mettre à jour le chemin du fichier dans la base de données
            await user.update({
                justificatif_path: req.file.filename,
                justificatif_status: 'en_attente',
                justificatif_commentaire: null
            });

            res.json({
                message: 'Fichier téléchargé avec succès',
                filePath: req.file.filename,
                justificatif_url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
            });
        } catch (error) {
            console.error(error);
            // Supprimer le fichier en cas d'erreur
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).json({ message: 'Erreur lors du téléchargement du fichier' });
        }
    });
};

// Mettre à jour toutes les informations d'un utilisateur
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nom,
            prenom,
            email,
            telephone,
            ecole_universite,
            specialite,
            justificatif_status,
            justificatif_commentaire,
            passages_utilises,
            passages_max_autorises,
            isActive,
            isDeleted,
            date_naissance,
            nationalite,
            paiement
        } = req.body;

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        // Mise à jour des champs
        const updatedFields = {
            nom: nom !== undefined ? nom : user.nom,
            prenom: prenom !== undefined ? prenom : user.prenom,
            email: email !== undefined ? email : user.email,
            telephone: telephone !== undefined ? telephone : user.telephone,
            ecole_universite: ecole_universite !== undefined ? ecole_universite : user.ecole_universite,
            specialite: specialite !== undefined ? specialite : user.specialite,
            justificatif_status: justificatif_status !== undefined ? justificatif_status : user.justificatif_status,
            justificatif_commentaire: justificatif_commentaire !== undefined ? justificatif_commentaire : user.justificatif_commentaire,
            passages_utilises: passages_utilises !== undefined ? passages_utilises : user.passages_utilises,
            passages_max_autorises: passages_max_autorises !== undefined ? parseInt(passages_max_autorises) : user.passages_max_autorises,
            date_naissance: date_naissance !== undefined ? date_naissance : user.date_naissance,
            nationalite: nationalite !== undefined ? nationalite : user.nationalite,
            paiement: paiement !== undefined ? paiement : user.paiement,
            isActive: isActive !== undefined ? isActive : user.isActive,
            isDeleted: isDeleted !== undefined ? isDeleted : user.isDeleted
        };

        await user.update(updatedFields);

        // Retourner l'utilisateur mis à jour sans le mot de passe
        const updatedUser = await User.findByPk(id, {
            attributes: { exclude: ['password'] }
        });

        res.json(updatedUser);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'utilisateur' });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            where: { role: 'utilisateur' },
            attributes: { exclude: ['password'] },
            order: [['createdAt', 'DESC']]
        });

        // Convertir les instances Sequelize en objets JavaScript simples
        const usersData = users.map(user => {
            const userData = user.get({ plain: true });

            // Ajouter l'URL complète du justificatif si elle existe
            if (userData.justificatif_path) {
                userData.justificatif_url = `${req.protocol}://${req.get('host')}/uploads/${userData.justificatif_path}`;
            }

            return userData;
        });

        res.json(usersData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur récupération utilisateurs' });
    }
};

exports.toggleUserActive = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

        await user.update({ isActive: !user.isActive });
        res.json({ message: `Utilisateur ${user.isActive ? 'désactivé' : 'activé'}`, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur modification utilisateur' });
    }
};

exports.updateUserPassages = async (req, res) => {
    try {
        const { id } = req.params;
        const { passages_max_autorises } = req.body;

        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

        await user.update({
            passages_max_autorises,
            date_derniere_validation: new Date()
        });

        res.json({ message: 'Limite de passages mise à jour', user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur mise à jour passages' });
    }
};

exports.validateAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, note_admin } = req.body;

        const appointment = await Appointment.findByPk(id, { include: [User] });
        if (!appointment) return res.status(404).json({ message: 'Rendez-vous non trouvé' });

        const oldStatus = appointment.status;

        await appointment.update({
            status,
            note_admin,
            valide_par_admin: status === 'validé_admin',
            date_validation_admin: new Date()
        });

        // Si le statut passe d'un état "confirmé" ou "validé_admin" à "annulé"
        // On rend le passage à l'utilisateur et on libère la place dans le créneau
        if ((oldStatus === 'confirmé' || oldStatus === 'validé_admin') && status === 'annulé') {
            if (appointment.User) {
                await appointment.User.decrement('passages_utilises');
                if (appointment.User.passages_utilises < 0) {
                    await appointment.User.update({ passages_utilises: 0 });
                }
            }
            
            if (appointment.intervalSlotId) {
                const { IntervalSlot } = require('../models');
                await IntervalSlot.update(
                    { places_restantes: require('sequelize').literal('places_restantes + 1') },
                    { where: { id: appointment.intervalSlotId } }
                );
            }
        }

        res.json({ message: 'Rendez-vous mis à jour avec succès', appointment });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur validation rendez-vous' });
    }
};

exports.getAllAppointmentsForAdmin = async (req, res) => {
    try {
        const appointments = await Appointment.findAll({
            include: [
                { model: User, attributes: { exclude: ['password'] } },
                Slot
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(appointments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur récupération rendez-vous' });
    }
};

// Gestion des paiements
exports.createPayment = async (req, res) => {
    try {
        const { userId, nombre_kilos, note } = req.body;

        const user = await User.findByPk(userId);
        if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

        const prix_total = (nombre_kilos / 2).toFixed(2);

        const payment = await Payment.create({
            userId,
            nombre_kilos,
            prix_total,
            note
        });

        res.status(201).json(payment);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur création paiement' });
    }
};

exports.getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.findAll({
            include: [{ model: User, attributes: { exclude: ['password'] } }],
            order: [['createdAt', 'DESC']]
        });
        res.json(payments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur récupération paiements' });
    }
};

// Gestion des justificatifs étudiants
exports.getUsersPendingValidation = async (req, res) => {
    try {
        const users = await User.findAll({
            where: {
                justificatif_status: 'en_attente',
                role: 'utilisateur'
            },
            attributes: { exclude: ['password'] },
            order: [['date_inscription', 'DESC']]
        });
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur récupération utilisateurs en attente' });
    }
};

exports.validateStudentJustificatif = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, commentaire } = req.body;

        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

        if (!['validé', 'refusé', 'en_attente'].includes(status)) {
            return res.status(400).json({ message: 'Statut invalide. Doit être "validé", "refusé" ou "en attente"' });
        }

        await user.update({
            justificatif_status: status,
            justificatif_commentaire: commentaire || null,
            isActive: status === 'validé' // Activer l'utilisateur uniquement si le statut est 'validé'
        });

        res.json({
            message: `Justificatif ${status}`,
            user: {
                id: user.id,
                nom: user.nom,
                prenom: user.prenom,
                justificatif_status: user.justificatif_status,
                isActive: user.isActive
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur validation justificatif' });
    }
};

exports.getStudentJustificatifInfo = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByPk(id, {
            attributes: ['id', 'nom', 'prenom', 'email', 'telephone', 'ecole_universite', 'specialite',
                'justificatif_path', 'justificatif_status', 'justificatif_commentaire', 'date_inscription']
        });

        if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

        // Construire l'URL complète du justificatif
        let justificatif_url = null;
        if (user.justificatif_path) {
            const protocol = req.secure ? 'https' : 'http';
            justificatif_url = `${protocol}://${req.get('host')}/uploads/${user.justificatif_path}`;
            
            // Vérifier si le fichier existe physiquement
            const filePath = path.join(__dirname, '../uploads', user.justificatif_path);
            if (!fs.existsSync(filePath)) {
                console.warn(`Le fichier du justificatif n'existe pas: ${filePath}`);
                justificatif_url = null;
            }
        }

        res.json({
            user: {
                ...user.toJSON(),
                justificatif_url: justificatif_url
            }
        });
    } catch (err) {
        console.error('Erreur lors de la récupération des informations du justificatif:', err);
        res.status(500).json({ 
            message: 'Erreur lors de la récupération des informations du justificatif',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Suppression définitive d'un utilisateur
exports.deleteUser = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        
        // Vérifier si l'utilisateur existe
        const user = await User.findByPk(id, {
            include: [
                Appointment,
                Payment
            ],
            transaction
        });
        
        if (!user) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        
        // Empêcher la suppression d'un admin
        if (user.role === 'admin') {
            await transaction.rollback();
            return res.status(403).json({ message: 'Impossible de supprimer un compte administrateur' });
        }
        
        // Supprimer le fichier de justificatif s'il existe
        if (user.justificatif_path) {
            const filePath = path.join(__dirname, '../uploads', user.justificatif_path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        // Supprimer les rendez-vous associés
        await Appointment.destroy({
            where: { userId: id },
            force: true, // Suppression définitive
            transaction
        });
        
        // Supprimer les paiements associés
        await Payment.destroy({
            where: { userId: id },
            force: true, // Suppression définitive
            transaction
        });
        
        // Supprimer définitivement l'utilisateur
        await User.destroy({
            where: { id: id },
            force: true, // Suppression définitive (pas de soft delete)
            transaction
        });
        
        await transaction.commit();
        
        res.json({ 
            message: 'Utilisateur et toutes ses données ont été supprimés définitivement',
            userDeleted: {
                id: user.id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email
            }
        });
        
    } catch (err) {
        await transaction.rollback();
        console.error('Erreur lors de la suppression de l\'utilisateur:', err);
        res.status(500).json({ 
            message: 'Erreur lors de la suppression de l\'utilisateur',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Gestion des paramètres système
exports.getSystemSettings = async (req, res) => {
    try {
        const settings = await SystemSetting.findAll();
        const settingsMap = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        
        // S'assurer que le quota par défaut existe
        if (!settingsMap['default_passages_quota']) {
            settingsMap['default_passages_quota'] = "2";
        }
        
        res.json(settingsMap);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur lors de la récupération des paramètres' });
    }
};

exports.updateSystemSetting = async (req, res) => {
    try {
        const { key, value } = req.body;
        
        if (!key || value === undefined) {
            return res.status(400).json({ message: 'Clé et valeur sont obligatoires' });
        }
        
        const [setting, created] = await SystemSetting.findOrCreate({
            where: { key },
            defaults: { value: String(value) }
        });
        
        if (!created) {
            await setting.update({ value: String(value) });
        }
        
        res.json({ message: 'Paramètre mis à jour', setting });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du paramètre' });
    }
};

// --- Maintenance Annuelle ---

/**
 * Archive les statistiques de l'année en cours et réinitialise les justificatifs
 */
exports.archiveAndResetAcademicYear = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { academicYear } = req.body; // ex: "2025-2026"
        if (!academicYear) {
            await transaction.rollback();
            return res.status(400).json({ message: 'L\'année académique est obligatoire' });
        }

        // 1. Calculer les statistiques actuelles
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        // On compte uniquement les étudiants qui ne sont pas inactifs depuis plus d'un an
        const totalStudents = await User.count({ 
            where: { 
                role: 'utilisateur', 
                isDeleted: false,
                [Op.not]: {
                    justificatif_status: 'en_attente',
                    [Op.or]: [
                        { date_derniere_validation: { [Op.lt]: oneYearAgo } },
                        { date_derniere_validation: null, createdAt: { [Op.lt]: oneYearAgo } }
                    ]
                }
            }, 
            transaction 
        });
        
        // "Passages" = Rendez-vous qui ont effectivement eu lieu (validés ou terminés)
        const totalPassages = await Appointment.count({ 
            where: { 
                [Op.or]: [
                    { status: { [Op.in]: ['validé_admin', 'terminé'] } },
                    { valide_par_admin: true }
                ]
            }, 
            transaction 
        });
        
        // "Rdv Absents" = Rendez-vous marqués comme manqués
        const totalMissed = await Appointment.count({ 
            where: { status: 'manqué' }, 
            transaction 
        });
        
        // "Rdv Annulés" = Rendez-vous annulés
        const totalCancelled = await Appointment.count({ 
            where: { status: 'annulé' }, 
            transaction 
        });
        
        // "Payés" = Étudiants ayant payé leur cotisation (champ paiement à true)
        const totalPaid = await User.count({ 
            where: { 
                paiement: true, 
                role: 'utilisateur',
                isDeleted: false
            }, 
            transaction 
        });

        // "Créneaux" = Nombre total de créneaux créés durant l'année
        const totalSlots = await Slot.count({ transaction });

        // 2. Créer l'archive
        await AcademicYearStats.create({
            academic_year: academicYear,
            total_students: totalStudents,
            total_confirmed_passages: totalPassages,
            total_cancelled_appointments: totalCancelled,
            total_missed_appointments: totalMissed,
            total_students_paid: totalPaid,
            total_slots_created: totalSlots
        }, { transaction });

        // 3. Suppression des fichiers justificatifs physiques
        const usersWithDocs = await User.findAll({
            where: { justificatif_path: { [Op.ne]: null } },
            transaction
        });

        for (const user of usersWithDocs) {
            if (user.justificatif_path) {
                const filePath = path.join(__dirname, '../uploads', user.justificatif_path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }

        // 4. Réinitialiser les utilisateurs (paiement, justificatifs, passages)
        await User.update({
            justificatif_status: 'en_attente',
            justificatif_path: null,
            paiement: false,
            passages_utilises: 0,
            justificatif_commentaire: `Réinitialisation annuelle académique ${academicYear}. Veuillez fournir un nouveau justificatif.`
        }, { 
            where: { role: 'utilisateur' },
            transaction 
        });

        // 5. Supprimer tous les rendez-vous, paiements et créneaux
        await Appointment.destroy({ where: {}, transaction });
        await Payment.destroy({ where: {}, transaction });
        await IntervalSlot.destroy({ where: {}, transaction });
        await Slot.destroy({ where: {}, transaction });

        await transaction.commit();
        res.json({ 
            message: `Année académique ${academicYear} archivée. Données réinitialisées (Justificatifs, RDV, Créneaux, Paiements).`,
            stats: { 
                totalStudents, 
                totalPassages, 
                totalCancelled, 
                totalMissed, 
                totalPaid,
                totalSlots
            }
        });
    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error(err);
        res.status(500).json({ message: 'Erreur lors de la maintenance annuelle' });
    }
};

/**
 * Supprime manuellement les étudiants qui n'ont pas mis à jour leur justificatif depuis plus d'un an
 */
exports.cleanupInactiveStudents = async (req, res) => {
    try {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        // Trouver les utilisateurs qui n'ont pas été validés depuis plus d'un an 
        // ET qui sont toujours "en attente" (donc n'ont pas agi suite à la réinitialisation)
        const studentsToDelete = await User.findAll({
            where: {
                role: 'utilisateur',
                justificatif_status: 'en_attente',
                [Op.or]: [
                    { date_derniere_validation: { [Op.lt]: oneYearAgo } },
                    { date_derniere_validation: null, createdAt: { [Op.lt]: oneYearAgo } }
                ]
            }
        });

        const count = studentsToDelete.length;
        
        for (const student of studentsToDelete) {
            // Supprimer les fichiers
            if (student.justificatif_path) {
                const filePath = path.join(__dirname, '../uploads', student.justificatif_path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            // Suppression définitive (on ne fait pas de soft delete ici pour le nettoyage annuel)
            await student.destroy({ force: true });
        }

        res.json({ 
            message: `${count} étudiants inactifs depuis plus d'un an ont été supprimés.`,
            count 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur lors du nettoyage des étudiants' });
    }
};

/**
 * Récupère l'historique des statistiques par année
 */
exports.getAcademicHistory = async (req, res) => {
    try {
        const history = await AcademicYearStats.findAll({ order: [['academic_year', 'DESC']] });
        res.json(history);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur récupération historique' });
    }
};

// --- Fin Maintenance Annuelle ---

// Récupérer les rendez-vous non validés
exports.getUnvalidatedAppointments = async (req, res) => {
    try {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        // D'abord, marquer les rendez-vous manqués
        await require('../services/appointmentService').updateMissedAppointments();

        // Puis récupérer les rendez-vous non validés (sauf ceux marqués comme manqués)
        const appointments = await Appointment.findAll({
            where: {
                status: {
                    [Op.notIn]: ['annulé', 'terminé', 'refusé_admin', 'manqué']
                },
                [Op.or]: [
                    { valide_par_admin: false },
                    { valide_par_admin: null }
                ]
            },
            include: [
                {
                    model: User,
                    attributes: { exclude: ['password'] },
                    where: { isActive: true } // Seulement les utilisateurs actifs
                },
                {
                    model: Slot,
                    where: {
                        date: { [Op.lte]: now } // Seulement les créneaux passés ou actuels
                    }
                }
            ],
            order: [
                ['date_rdv', 'ASC'],
                ['heure_debut', 'ASC']
            ]
        });

        res.json(appointments);
    } catch (err) {
        console.error('Erreur lors de la récupération des rendez-vous non validés :', err);
        res.status(500).json({ message: 'Erreur lors de la récupération des rendez-vous non validés' });
    }
};

// Gestion des affiches
exports.getAllAffiches = async (req, res) => {
    try {
        const affiches = await Affiche.findAll({
            order: [['priorite', 'DESC'], ['createdAt', 'DESC']]
        });
        res.json(affiches);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur récupération affiches' });
    }
};

exports.getAfficheById = async (req, res) => {
    try {
        const affiche = await Affiche.findByPk(req.params.id);
        if (!affiche) {
            return res.status(404).json({ message: 'Affiche non trouvée' });
        }
        res.json(affiche);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur récupération affiche' });
    }
};

exports.createAffiche = async (req, res) => {
    try {
        const { titre, contenu, image_url, date_debut, date_fin, priorite } = req.body;
        
        const affiche = await Affiche.create({
            titre,
            contenu,
            image_url,
            date_debut,
            date_fin,
            priorite: priorite || 0
        });
        
        res.status(201).json(affiche);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur création affiche' });
    }
};

exports.updateAffiche = async (req, res) => {
    try {
        const { id } = req.params;
        const { titre, contenu, image_url, date_debut, date_fin, priorite, is_active } = req.body;
        
        const affiche = await Affiche.findByPk(id);
        if (!affiche) {
            return res.status(404).json({ message: 'Affiche non trouvée' });
        }
        
        await affiche.update({
            titre: titre !== undefined ? titre : affiche.titre,
            contenu: contenu !== undefined ? contenu : affiche.contenu,
            image_url: image_url !== undefined ? image_url : affiche.image_url,
            date_debut: date_debut !== undefined ? date_debut : affiche.date_debut,
            date_fin: date_fin !== undefined ? date_fin : affiche.date_fin,
            priorite: priorite !== undefined ? priorite : affiche.priorite,
            is_active: is_active !== undefined ? is_active : affiche.is_active
        });
        
        res.json(affiche);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur mise à jour affiche' });
    }
};

exports.deleteAffiche = async (req, res) => {
    try {
        const { id } = req.params;
        
        const affiche = await Affiche.findByPk(id);
        if (!affiche) {
            return res.status(404).json({ message: 'Affiche non trouvée' });
        }
        
        await affiche.destroy();
        res.json({ message: 'Affiche supprimée avec succès' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur suppression affiche' });
    }
};

exports.toggleAfficheActive = async (req, res) => {
    try {
        const { id } = req.params;
        
        const affiche = await Affiche.findByPk(id);
        if (!affiche) {
            return res.status(404).json({ message: 'Affiche non trouvée' });
        }
        
        await affiche.update({ is_active: !affiche.is_active });
        res.json({ 
            message: `Affiche ${affiche.is_active ? 'activée' : 'désactivée'}`, 
            affiche 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur modification statut affiche' });
    }
};


// Upload d'image pour affiche
exports.uploadAfficheImage = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Aucun fichier téléchargé' });
    }

    try {
        // Construire l'URL relative du fichier
        const imageUrl = `affiches/${req.file.filename}`;
        
        // Créer l'entrée dans la base de données
        const affiche = await Affiche.create({
            titre: req.body.titre || 'Affiche sans titre',
            contenu: req.body.contenu || '',
            image_url: imageUrl,
            is_active: req.body.is_active !== undefined ? req.body.is_active : true,
            date_debut: req.body.date_debut || null,
            date_fin: req.body.date_fin || null,
            priorite: req.body.priorite || 0
        });
        
        res.status(201).json({
            message: 'Affiche créée avec succès',
            affiche: affiche,
            imageUrl: imageUrl,
            fullUrl: `${req.protocol}://${req.get('host')}/uploads/${imageUrl}`
        });
    } catch (error) {
        console.error(error);
        // Supprimer le fichier en cas d'erreur
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: 'Erreur lors de la création de l\'affiche' });
    }
};

// Récupérer les affiches actives pour les utilisateurs
exports.getActiveAffiches = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const affiches = await Affiche.findAll({
            where: {
                is_active: true,
                [Op.or]: [
                    { date_debut: null },
                    { date_debut: { [Op.lte]: today } }
                ],
                [Op.or]: [
                    { date_fin: null },
                    { date_fin: { [Op.gte]: today } }
                ]
            },
            order: [['priorite', 'DESC'], ['createdAt', 'DESC']]
        });
        
        res.json(affiches);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur récupération affiches actives' });
    }
};
