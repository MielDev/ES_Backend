const { User } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    try {
        const { nom, prenom, email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'email et password requis' });

        const exists = await User.findOne({ where: { email } });
        if (exists) return res.status(400).json({ message: 'Email déjà utilisé' });

        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ nom, prenom, email, password: hashed });
        user.password = undefined;
        return res.status(201).json(user);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

        // Vérification du statut actif et gestion des sanctions pour absences
        if (!user.isActive) {
            if (user.sanction_until) {
                if (!user.isSanctionOver) {
                    return res.status(403).json({ 
                        message: `Votre compte est temporairement suspendu en raison d'absences répétées. Il sera réactivé dans ${user.remainingSanctionDays} jour(s) (le ${new Date(user.sanction_until).toLocaleDateString('fr-FR')}).` 
                    });
                } else {
                    // La sanction est terminée, on réactive le compte lors de la tentative de connexion
                    user.isActive = true;
                    user.nb_absences_depuis_derniere_sanction = 0;
                    user.sanction_until = null;
                    await user.save();
                }
            } else {
                return res.status(403).json({ message: 'Votre compte est désactivé. Veuillez contacter un administrateur.' });
            }
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ message: 'Mot de passe incorrect' });

        const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '1d' });
        user.password = undefined;
        return res.json({ token, user });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password'] }
        });
        if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

        res.json(user);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
};
