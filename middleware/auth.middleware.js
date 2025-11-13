require('dotenv').config();
const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Token manquant' });
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token invalide' });
    }
};

const isAdmin = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Accès refusé (admin seulement)' });
    next();
};

const isUtilisateur = (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
    if (req.user.role !== 'utilisateur' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès refusé (utilisateur seulement)' });
    }
    next();
};

const hasRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Non authentifié' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: `Accès refusé. Rôles autorisés: ${roles.join(', ')}` 
            });
        }
        next();
    };
};

module.exports = { 
    auth, 
    isAdmin, 
    isUtilisateur,
    hasRole 
};
