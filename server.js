require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');

const app = express();

// Configuration CORS
const corsOptions = {
    origin: ['https://app.episoletudiantedumans.fr', 'http://localhost:4200', 'http://192.168.1.148:4200'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range', 'Content-Disposition'],
    optionsSuccessStatus: 200
};

// Middleware CORS (doit être **avant** toutes les routes)
app.use(cors(corsOptions));

// Gestion des requêtes OPTIONS (preflight)
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        return res.sendStatus(200);
    }
    next();
});

// Middleware pour parser JSON et URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import des services

// Import des routes
const authRoutes = require('./routes/auth.routes');
const authStudentRoutes = require('./routes/auth.student.routes');
const slotRoutes = require('./routes/slot.routes');
const apptRoutes = require('./routes/appointment.routes');
const adminRoutes = require('./routes/admin.routes');
const paymentRoutes = require('./routes/payment.routes');

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/auth/student', authStudentRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/appointments', apptRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', paymentRoutes);

// Gestion des erreurs globales
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Une erreur est survenue sur le serveur',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

// Routes non trouvées
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route non trouvée',
        path: req.originalUrl
    });
});

// Synchronisation DB
const syncDB = async () => {
    try {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { raw: true });
        await sequelize.sync({
            alter: { drop: false },
            logging: console.log,
            benchmark: true
        });
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { raw: true });
        console.log('✅ Base de données synchronisée avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de la synchronisation de la base de données:');
        console.error(error);
        process.exit(1);
    }
};

// Démarrage serveur
const PORT = process.env.PORT || 3555;
syncDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    });
});
