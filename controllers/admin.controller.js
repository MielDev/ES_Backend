const { sequelize, Op, AdminConfig, User, Appointment, Payment, Slot } = require('../models');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Marquer les rendez-vous non validés comme manqués
exports.markMissedAppointments = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // 1. Trouver les rendez-vous non validés dont la date est passée
        const appointments = await Appointment.findAll({
            where: {
                status: 'confirmé',
                valide_par_admin: false,
                date_rdv: {
                    [Op.lt]: today
                }
            },
            transaction
        });

        if (appointments.length === 0) {
            await transaction.commit();
            return res.json({
                success: true,
                message: 'Aucun rendez-vous à marquer comme manqué',
                count: 0
            });
        }

        // 2. Récupérer les IDs des créneaux à désactiver
        const slotIds = [...new Set(appointments.map(appt => appt.slot_id))];

        // 3. Mettre à jour les rendez-vous comme manqués
        await Appointment.update(
            { status: 'manqué' },
            { 
                where: { id: appointments.map(a => a.id) },
                transaction
            }
        );

        // 4. Désactiver les créneaux associés
        if (slotIds.length > 0) {
            await Slot.update(
                { is_active: false },
                { 
                    where: { id: slotIds },
                    transaction
                }
            );
        }

        await transaction.commit();
        
        res.json({
            success: true,
            message: `${appointments.length} rendez-vous ont été marqués comme manqués et leurs créneaux désactivés`,
            count: appointments.length,
            slotsUpdated: slotIds.length
        });
    } catch (err) {
        await transaction.rollback();
        console.error('Erreur lors du marquage des rendez-vous manqués:', err);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du marquage des rendez-vous manqués',
            error: err.message
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
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'justificatif-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|pdf/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const isImage = /jpeg|jpg|png|gif/.test(file.mimetype);
        const isPDF = file.mimetype === 'application/pdf';

        if ((isImage || isPDF) && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Seuls les fichiers images (JPEG, JPG, PNG, GIF) et PDF sont autorisés'));
        }
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

        await appointment.update({
            status,
            note_admin,
            valide_par_admin: status === 'validé_admin',
            date_validation_admin: new Date()
        });

        // Incrémenter les passages utilisés si validé
        if (status === 'validé_admin') {
            await appointment.User.update({
                passages_utilises: appointment.User.passages_utilises + 1
            });
        }

        res.json({ message: 'Rendez-vous validé', appointment });
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

        if (!['validé', 'refusé'].includes(status)) {
            return res.status(400).json({ message: 'Statut invalide' });
        }

        await user.update({
            justificatif_status: status,
            justificatif_commentaire: commentaire || null,
            isActive: status === 'validé' // Activer l'utilisateur si justificatif validé
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

        res.json({
            user: {
                ...user.toJSON(),
                justificatif_url: user.justificatif_path ? `/uploads/${user.justificatif_path}` : null
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur récupération infos justificatif' });
    }
};

// Récupérer les rendez-vous non validés
exports.getUnvalidatedAppointments = async (req, res) => {
    try {
        const { Op } = require('sequelize');
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
                    where: { is_active: true } // Seulement les utilisateurs actifs
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
