const { User } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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
        // Ne pas échouer sur des certificats invalides
        rejectUnauthorized: false
    }
});

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
            specialite,
            date_naissance,    // <-- conservé
            nationalite        // <-- conservé
            // paiement retiré
        } = req.body;

        // Validation des champs obligatoires
        if (!nom || !prenom || !email || !password) {
            return res.status(400).json({
                message: 'Les champs nom, prénom, email et mot de passe sont obligatoires'
            });
        }

        // (Optionnel) valider date_naissance et nationalite si vous voulez les rendre obligatoires
        // Exemple: si vous souhaitez les rendre obligatoires, décommentez la ligne suivante
        // if (!date_naissance || !nationalite) return res.status(400).json({ message: 'Date de naissance et nationalité obligatoires' });

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

        // Préparer date_naissance en tant que Date si fournie
        let parsedDateNaissance = null;
        if (date_naissance) {
            const d = new Date(date_naissance);
            if (!isNaN(d)) parsedDateNaissance = d;
            // else on peut ignorer ou renvoyer une erreur selon le besoin
        }

        // Créer l'utilisateur (ne plus inclure paiement)
        const user = await User.create({
            nom,
            prenom,
            email,
            password: hashedPassword,
            telephone,
            ecole_universite,
            specialite,
            date_naissance: parsedDateNaissance,
            nationalite,
            // paiement non défini ici : la colonne DB reste avec sa valeur par défaut (false)
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
                date_naissance: user.date_naissance,
                nationalite: user.nationalite,
                // paiement retiré de la réponse
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
                date_naissance: user.date_naissance,
                nationalite: user.nationalite,
                // paiement retiré de la réponse du profil
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
        const { nom, prenom, email, telephone, ecole_universite, specialite, date_naissance, nationalite } = req.body;
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

        // Mettre à jour les nouveaux champs (sauf paiement)
        if (nationalite) user.nationalite = nationalite;

        if (date_naissance) {
            const d = new Date(date_naissance);
            if (!isNaN(d)) {
                user.date_naissance = d;
            } else {
                return res.status(400).json({ message: 'Format de date_naissance invalide' });
            }
        }

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

        // Construire la réponse (sans paiement)
        const userResponse = {
            id: user.id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            telephone: user.telephone,
            ecole_universite: user.ecole_universite,
            specialite: user.specialite,
            date_naissance: user.date_naissance,
            nationalite: user.nationalite,
            // paiement retiré
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

// Demande de réinitialisation de mot de passe
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: "Aucun compte associé à cet email." });
        }

        // Générer un token de réinitialisation
        const resetToken = crypto.randomBytes(20).toString('hex');
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        // Définir la date d'expiration (1 heure)
        const resetPasswordExpire = new Date(Date.now() + 3600000);

        // Mettre à jour l'utilisateur avec le token et la date d'expiration
        await user.update({
            resetPasswordToken,
            resetPasswordExpire
        });

        // Créer l'URL de réinitialisation avec le bon préfixe de route
        const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/student/reset-password/${resetToken}`;

        const message = `Vous avez demandé une réinitialisation de mot de passe. Veuillez cliquer sur le lien suivant : \n\n${resetUrl}\n\nCe lien expirera dans 1 heure.`;

        try {
            await transporter.sendMail({
                to: user.email,
                subject: 'Réinitialisation de votre mot de passe',
                text: message
            });

            res.status(200).json({ 
                success: true, 
                message: 'Email de réinitialisation envoyé avec succès' 
            });
        } catch (err) {
            console.error('Erreur lors de l\'envoi de l\'email:', err);
            await user.update({
                resetPasswordToken: null,
                resetPasswordExpire: null
            });

            return res.status(500).json({ message: "L'email n'a pas pu être envoyé" });
        }
    } catch (error) {
        console.error('Erreur dans forgotPassword:', error);
        res.status(500).json({ message: 'Erreur lors du traitement de la demande' });
    }
};

// Afficher le formulaire de réinitialisation
exports.showResetPasswordForm = async (req, res) => {
    try {
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            where: {
                resetPasswordToken,
                resetPasswordExpire: { [Op.gt]: new Date() }
            }
        });

        if (!user) {
            return res.status(400).send('Lien de réinitialisation invalide ou expiré');
        }

        // Renvoyer une page HTML simple avec le formulaire
        res.send(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Réinitialisation du mot de passe - Épicerie Solidaire</title>
                <style>
                    :root {
                        --primary-green: #4E9667;
                        --primary-blue: #5C77B9;
                        --secondary-blue: #A0D2DB;
                        --warm-yellow: #D8B25E;
                        --warm-orange: #DF7841;
                        --light-bg: #F8F8F8;
                        --text-color: #333;
                        --error-color: #e74c3c;
                        --success-color: #27ae60;
                    }

                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }

                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: var(--text-color);
                        background-color: var(--light-bg);
                        padding: 20px;
                        min-height: 100vh;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                    }

                    .container {
                        max-width: 500px;
                        width: 100%;
                        margin: 0 auto;
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                        padding: 2.5rem;
                        position: relative;
                        overflow: hidden;
                    }

                    .container::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 6px;
                        background: linear-gradient(90deg, var(--primary-green), var(--primary-blue));
                    }

                    h2 {
                        color: var(--primary-green);
                        text-align: center;
                        margin-bottom: 1.8rem;
                        font-weight: 600;
                        font-size: 1.8rem;
                    }

                    .form-group {
                        margin-bottom: 1.5rem;
                    }

                    label {
                        display: block;
                        margin-bottom: 0.5rem;
                        font-weight: 500;
                        color: var(--primary-blue);
                    }

                    .password-input-container {
                        position: relative;
                        width: 100%;
                    }

                    .password-input-container input[type="password"],
                    .password-input-container input[type="text"] {
                        width: 100%;
                        padding: 0.8rem 2.5rem 0.8rem 1rem;
                        border: 2px solid #e1e1e1;
                        border-radius: 8px;
                        font-size: 1rem;
                        transition: all 0.3s ease;
                        background-color: #f9f9f9;
                    }

                    .toggle-password {
                        position: absolute;
                        right: 10px;
                        top: 50%;
                        transform: translateY(-50%);
                        cursor: pointer;
                        color: #666;
                        background: none;
                        border: none;
                        font-size: 1.2rem;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        transition: all 0.2s ease;
                    }

                    .toggle-password:hover {
                        background-color: rgba(0, 0, 0, 0.05);
                        color: var(--primary-blue);
                    }

                    input[type="password"]:focus {
                        border-color: var(--primary-green);
                        box-shadow: 0 0 0 3px rgba(78, 150, 103, 0.2);
                        outline: none;
                        background-color: white;
                    }

                    button[type="submit"] {
                        width: 100%;
                        padding: 0.9rem;
                        background: linear-gradient(135deg, var(--primary-green), var(--primary-blue));
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 1rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        margin-top: 0.5rem;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }

                    button[type="submit"]:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    }

                    button[type="submit"]:active {
                        transform: translateY(0);
                    }

                    .password-requirements {
                        font-size: 0.85rem;
                        color: #666;
                        margin-top: 0.5rem;
                        padding-left: 1rem;
                        border-left: 3px solid var(--warm-yellow);
                    }

                    .logo {
                        text-align: center;
                        margin-bottom: 1.5rem;
                    }

                    .logo h1 {
                        color: var(--primary-green);
                        font-size: 1.8rem;
                        margin-bottom: 0.5rem;
                    }

                    .logo p {
                        color: var(--primary-blue);
                        font-weight: 500;
                    }

                    @media (max-width: 576px) {
                        .container {
                            padding: 1.5rem;
                        }
                        
                        h2 {
                            font-size: 1.5rem;
                        }
                        
                        input[type="password"],
                        button[type="submit"] {
                            padding: 0.75rem;
                        }
                    }

                    .error-message {
                        color: var(--error-color);
                        font-size: 0.9rem;
                        margin-top: 0.3rem;
                        display: none;
                    }

                    .success-message {
                        color: var(--success-color);
                        text-align: center;
                        margin-bottom: 1.5rem;
                        font-weight: 500;
                        display: none;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="logo">
                        <h1>Épicerie Solidaire</h1>
                        <p>Réinitialisation du mot de passe</p>
                    </div>
                    
                    <div id="successMessage" class="success-message">
                        Votre mot de passe a été réinitialisé avec succès !
                    </div>
                    
                    <form id="resetForm" action="/api/auth/student/reset-password/${req.params.token}" method="POST">
                        <div class="form-group">
                            <label for="password">Nouveau mot de passe</label>
                            <div class="password-input-container">
                                <input 
                                    type="password" 
                                    id="password" 
                                    name="password" 
                                    required
                                    minlength="6"
                                    aria-describedby="passwordHelp"
                                >
                                <button type="button" class="toggle-password" aria-label="Afficher le mot de passe">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                            </div>
                            <div id="passwordHelp" class="password-requirements">
                                Le mot de passe doit contenir au moins 6 caractères
                            </div>
                            <div id="passwordError" class="error-message">
                                Les mots de passe ne correspondent pas ou ne respectent pas les critères de sécurité.
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="confirmPassword">Confirmer le mot de passe</label>
                            <div class="password-input-container">
                                <input 
                                    type="password" 
                                    id="confirmPassword" 
                                    name="confirmPassword" 
                                    required
                                    minlength="6"
                                >
                                <button type="button" class="toggle-password" aria-label="Afficher la confirmation du mot de passe">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        
                        <button type="submit">
                            <span class="button-text">Mettre à jour mon mot de passe</span>
                        </button>
                    </form>
                </div>

                <script>
                    document.addEventListener('DOMContentLoaded', function() {
                        const form = document.getElementById('resetForm');
                        const passwordInput = document.getElementById('password');
                        const confirmPasswordInput = document.getElementById('confirmPassword');
                        const passwordError = document.getElementById('passwordError');
                        const successMessage = document.getElementById('successMessage');
                        
                        // Fonction pour valider le mot de passe
                        function validatePassword(password) {
                            // Au moins 6 caractères
                            return password.length >= 6;
                        }
                        
                        // Gestion de l'affichage/masquage des mots de passe
                        document.querySelectorAll('.toggle-password').forEach(button => {
                            button.addEventListener('click', function() {
                                const input = this.previousElementSibling;
                                const isPassword = input.type === 'password';
                                
                                // Changer le type de l'input
                                input.type = isPassword ? 'text' : 'password';
                                
                                // Changer l'icône
                                const icon = this.querySelector('svg');
                                if (isPassword) {
                                    // Icône d'œil barré
                                    icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
                                } else {
                                    // Icône d'œil normal
                                    icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
                                }
                                
                                // Mettre à jour l'aria-label
                                const label = isPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe';
                                this.setAttribute('aria-label', label);
                            });
                        });
                        
                        // Validation en temps réel
                        [passwordInput, confirmPasswordInput].forEach(input => {
                            input.addEventListener('input', function() {
                                const password = passwordInput.value;
                                const confirmPassword = confirmPasswordInput.value;
                                
                                if (password && confirmPassword) {
                                    if (password !== confirmPassword) {
                                        passwordError.style.display = 'block';
                                        passwordError.textContent = 'Les mots de passe ne correspondent pas';
                                    } else if (!validatePassword(password)) {
                                        passwordError.style.display = 'block';
                                        passwordError.textContent = 'Le mot de passe ne respecte pas les critères de sécurité';
                                    } else {
                                        passwordError.style.display = 'none';
                                    }
                                } else {
                                    passwordError.style.display = 'none';
                                }
                            });
                        });
                        
                        // Gestion de la soumission du formulaire
                        form.addEventListener('submit', function(e) {
                            const password = passwordInput.value;
                            const confirmPassword = confirmPasswordInput.value;
                            
                            if (password !== confirmPassword) {
                                e.preventDefault();
                                passwordError.style.display = 'block';
                                passwordError.textContent = 'Les mots de passe ne correspondent pas';
                                passwordInput.focus();
                                return false;
                            }
                            
                            if (!validatePassword(password)) {
                                e.preventDefault();
                                passwordError.style.display = 'block';
                                passwordError.textContent = 'Le mot de passe ne respecte pas les critères de sécurité';
                                passwordInput.focus();
                                return false;
                            }
                            
                            // Si tout est valide, on peut soumettre le formulaire
                            // Ici, vous pourriez ajouter une animation de chargement si nécessaire
                            const button = form.querySelector('button[type="submit"]');
                            button.disabled = true;
                            button.innerHTML = '<span class="button-text">Traitement en cours...</span>';
                            
                            return true;
                        });
                        
                        // Vérification de l'URL pour un message de succès
                        const urlParams = new URLSearchParams(window.location.search);
                        if (urlParams.get('success') === 'true') {
                            successMessage.style.display = 'block';
                            form.style.display = 'none';
                        }
                    });
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Erreur dans showResetPasswordForm:', error);
        res.status(500).send('Erreur lors du chargement du formulaire de réinitialisation');
    }
};

// Réinitialisation du mot de passe
exports.resetPassword = async (req, res) => {
    try {
        // Hasher le token reçu
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            where: {
                resetPasswordToken,
                resetPasswordExpire: { [Op.gt]: new Date() }
            }
        });

        if (!user) {
            return res.status(400).json({ message: 'Token invalide ou expiré' });
        }

        // Mettre à jour le mot de passe
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        
        await user.update({
            password: hashedPassword,
            resetPasswordToken: null,
            resetPasswordExpire: null
        });

        // Afficher une page de confirmation HTML
        const successHtml = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Mot de passe réinitialisé - Épicerie Solidaire</title>
                <style>
                    :root {
                        --primary-green: #4E9667;
                        --primary-blue: #5C77B9;
                        --light-bg: #F8F8F8;
                        --text-color: #333;
                    }
                    
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background-color: var(--light-bg);
                        margin: 0;
                        padding: 0;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        color: var(--text-color);
                        line-height: 1.6;
                    }
                    
                    .success-container {
                        background: white;
                        padding: 2.5rem;
                        border-radius: 10px;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                        text-align: center;
                        max-width: 500px;
                        width: 90%;
                    }
                    
                    .success-icon {
                        color: var(--primary-green);
                        font-size: 4rem;
                        margin-bottom: 1.5rem;
                    }
                    
                    h1 {
                        color: var(--primary-blue);
                        margin: 0 0 1rem;
                    }
                    
                    p {
                        margin: 0 0 2rem;
                        color: #555;
                    }
                    
                    .btn {
                        display: inline-block;
                        background-color: var(--primary-blue);
                        color: white;
                        text-decoration: none;
                        padding: 0.8rem 1.5rem;
                        border-radius: 5px;
                        font-weight: 500;
                        transition: background-color 0.3s ease;
                        border: none;
                        cursor: pointer;
                        font-size: 1rem;
                    }
                    
                    .btn:hover {
                        background-color: #4a68b1;
                    }
                    
                    @media (max-width: 480px) {
                        .success-container {
                            padding: 1.5rem;
                        }
                        
                        h1 {
                            font-size: 1.5rem;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="success-container">
                    <div class="success-icon">
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>
                    <h1>Mot de passe réinitialisé avec succès !</h1>
                    <p>Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
                    <a href="localhost:4200/login" class="btn">Retour à la page de connexion</a>
                </div>
            </body>
            </html>
        `;
        
        res.status(200).send(successHtml);
    } catch (error) {
        console.error('Erreur dans resetPassword:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Erreur</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 50px; 
                        color: #721c24;
                        background-color: #f8d7da;
                    }
                    .container { 
                        max-width: 600px; 
                        margin: 0 auto; 
                        padding: 20px; 
                        background: white; 
                        border-radius: 5px; 
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    }
                    a { 
                        color: #0c5460; 
                        text-decoration: none;
                    }
                    a:hover { 
                        text-decoration: underline;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Erreur lors de la réinitialisation</h2>
                    <p>Une erreur est survenue lors de la réinitialisation de votre mot de passe.</p>
                    <p>Veuillez réessayer ou contacter l'administration si le problème persiste.</p>
                    <p><a href="/forgot-password">Essayer à nouveau</a></p>
                </div>
            </body>
            </html>
        `);
    }
};
// Exporter toutes les fonctions
const studentAuthController = {
    registerStudent: exports.registerStudent,
    getStudentProfile: exports.getStudentProfile,
    updateStudentProfile: exports.updateStudentProfile,
    downloadJustificatif: exports.downloadJustificatif,
    forgotPassword: exports.forgotPassword,
    resetPassword: exports.resetPassword,
    showResetPasswordForm: exports.showResetPasswordForm
};

module.exports = studentAuthController;
