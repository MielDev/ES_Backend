const { User } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// Inscription étudiant avec formulaire complet
exports.registerStudent = async (req, res) => {
    try {
        const {
            nom,
            prenom,
            email,
            password,
            telephone,
            ecole_universite,
            specialite
        } = req.body;

        // Validation des champs obligatoires
        if (!nom || !prenom || !email || !password) {
            return res.status(400).json({
                message: 'Les champs nom, prénom, email et mot de passe sont obligatoires'
            });
        }

        // Vérifier si l'email existe déjà
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'Cet email est déjà utilisé' });
        }

        // Vérifier si un fichier justificatif a été uploadé
        if (!req.file) {
            return res.status(400).json({
                message: 'Un justificatif étudiant est obligatoire (carte étudiant ou certificat de scolarité)'
            });
        }

        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Créer l'utilisateur
        const user = await User.create({
            nom,
            prenom,
            email,
            password: hashedPassword,
            telephone,
            ecole_universite,
            specialite,
            justificatif_path: req.file.filename,
            justificatif_status: 'en_attente',
            date_inscription: new Date()
        });

        // Générer le token JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Inscription réussie. Votre justificatif est en cours de validation.',
            user: {
                id: user.id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                ecole_universite: user.ecole_universite,
                specialite: user.specialite,
                justificatif_status: user.justificatif_status,
                date_inscription: user.date_inscription
            },
            token
        });

    } catch (error) {
        console.error('Erreur inscription étudiant:', error);
        res.status(500).json({
            message: 'Erreur lors de l\'inscription',
            error: error.message
        });
    }
};

// Obtenir le profil complet de l'utilisateur
exports.getStudentProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: {
                exclude: ['password'] // Ne pas renvoyer le mot de passe
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        res.json({
            user: {
                id: user.id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                ecole_universite: user.ecole_universite,
                specialite: user.specialite,
                justificatif_path: user.justificatif_path,
                justificatif_status: user.justificatif_status,
                justificatif_commentaire: user.justificatif_commentaire,
                isActive: user.isActive,
                passages_utilises: user.passages_utilises,
                passages_max_autorises: user.passages_max_autorises,
                date_inscription: user.date_inscription,
                date_derniere_validation: user.date_derniere_validation
            }
        });

    } catch (error) {
        console.error('Erreur récupération profil:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération du profil' });
    }
};

// Mettre à jour le profil étudiant
exports.updateStudentProfile = async (req, res) => {
    try {
        const { nom, prenom, email, telephone, ecole_universite, specialite } = req.body;
        const userId = req.user.id;

        console.log('Requête reçue avec body:', req.body);
        console.log('Fichier reçu:', req.file);

        // Trouver l'utilisateur d'abord
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        // Vérifier l'email uniquement s'il est fourni et différent de l'actuel
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser) {
                return res.status(400).json({
                    message: 'Cet email est déjà utilisé par un autre compte',
                    field: 'email'
                });
            }
            user.email = email;
        }

        // Mettre à jour les champs fournis
        if (nom) user.nom = nom;
        if (prenom) user.prenom = prenom;
        if (telephone) user.telephone = telephone;
        if (ecole_universite) user.ecole_universite = ecole_universite;
        if (specialite) user.specialite = specialite;

        // Gestion du téléchargement du nouveau justificatif
        if (req.file) {
            try {
                // Supprimer l'ancien fichier s'il existe
                if (user.justificatif_path) {
                    const oldFilePath = path.join(__dirname, '../uploads', user.justificatif_path);
                    if (fs.existsSync(oldFilePath)) {
                        fs.unlinkSync(oldFilePath);
                    }
                }
                // Mettre à jour avec le nouveau fichier
                user.justificatif_path = req.file.filename;
                user.justificatif_status = 'en_attente';
                user.justificatif_commentaire = null;
            } catch (fileError) {
                console.error('Erreur lors de la gestion du fichier:', fileError);
                return res.status(500).json({
                    message: 'Erreur lors du traitement du fichier',
                    error: process.env.NODE_ENV === 'development' ? fileError.message : undefined
                });
            }
        }

        await user.save();

        // Construire la réponse
        const userResponse = {
            id: user.id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            telephone: user.telephone,
            ecole_universite: user.ecole_universite,
            specialite: user.specialite,
            justificatif_path: user.justificatif_path,
            justificatif_status: user.justificatif_status,
            date_inscription: user.date_inscription
        };

        res.json({
            message: 'Profil mis à jour avec succès',
            user: userResponse
        });

    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour du profil',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Télécharger le justificatif (pour l'admin)
exports.downloadJustificatif = async (req, res) => {
    try {
        const userId = req.params.userId;
        const currentUser = req.user; // L'utilisateur connecté

        // Vérifier si l'utilisateur est admin ou le propriétaire du compte
        if (currentUser.role !== 'admin' && currentUser.id.toString() !== userId) {
            return res.status(403).json({ message: 'Accès non autorisé' });
        }

        const user = await User.findByPk(userId);
        if (!user || !user.justificatif_path) {
            return res.status(404).json({ message: 'Justificatif non trouvé' });
        }

        const filePath = path.join(__dirname, '../uploads', user.justificatif_path);

        // Vérifier que le fichier existe
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Fichier justificatif introuvable' });
        }

        // Envoyer le fichier
        res.download(filePath);

    } catch (error) {
        console.error('Erreur téléchargement justificatif:', error);
        res.status(500).json({ message: 'Erreur lors du téléchargement' });
    }
};
