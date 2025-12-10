require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');

const app = express();
// Configuration CORS pour accepter les requêtes avec des identifiants
const corsOptions = {
    origin: 'https://app.epicoletudiantedumans.fr', // Suppression du slash final
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
};

// Gestion des requêtes OPTIONS pour CORS
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import des services
const { startMissedAppointmentsCheck } = require('./services/appointmentService');

// routes
const authRoutes = require('./routes/auth.routes');
const authStudentRoutes = require('./routes/auth.student.routes');
const slotRoutes = require('./routes/slot.routes');
const apptRoutes = require('./routes/appointment.routes');
const adminRoutes = require('./routes/admin.routes');
const paymentRoutes = require('./routes/payment.routes');

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/auth/student', authStudentRoutes); // Routes étudiant sur un sous-chemin
app.use('/api/slots', slotRoutes);
app.use('/api/appointments', apptRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', paymentRoutes); // Routes de paiement - Changé de '/api/payments' à '/api'

// Gestion des erreurs globales
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Une erreur est survenue sur le serveur',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

// Gestion des routes non trouvées
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route non trouvée',
        path: req.originalUrl
    });
});

// Configuration de synchronisation sécurisée
const syncDB = async () => {
    try {
        // Désactive la vérification des clés étrangères temporairement
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { raw: true });

        // Synchronise les modèles avec des options sécurisées
        await sequelize.sync({
            alter: {
                drop: false, // Ne supprime pas les colonnes ou tables
            },
            logging: console.log, // Affiche les requêtes SQL
            benchmark: true
        });

        // Réactive la vérification des clés étrangères
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { raw: true });

        console.log('✅ Base de données synchronisée avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de la synchronisation de la base de données:');
        console.error(error);
        process.exit(1); // Arrête le processus en cas d'erreur critique
    }
};

// Démarrage du serveur
const PORT = process.env.PORT || 3555;
syncDB().then(() => {
    // Démarrer la vérification périodique des rendez-vous manqués
    startMissedAppointmentsCheck();

    app.listen(PORT, () => {
        console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    });
});
