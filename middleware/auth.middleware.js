require('dotenv').config();
const jwt = require('jsonwebtoken');

// Vérification générale du token
const auth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'Token manquant' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Token manquant' });
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token invalide', error: err.message });
    }
};

// Vérifie que l'utilisateur est admin
const isAdmin = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Accès refusé (admin seulement)' });
    next();
};

// Vérifie que l'utilisateur est utilisateur ou admin
const isUtilisateur = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
    if (!['utilisateur', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Accès refusé (utilisateur seulement)' });
    }
    next();
};

// Middleware générique pour plusieurs rôles
const hasRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: `Accès refusé. Rôles autorisés: ${roles.join(', ')}` });
        }
        next();
    };
};

module.exports = { auth, isAdmin, isUtilisateur, hasRole };
