require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('./models');

const app = express();

// Configuration CORS
const corsOptions = {
    origin: ['https://app.episoletudiantedumans.fr', 'http://localhost:4200', 'http://192.168.1.148:4200'],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range', 'Content-Disposition', 'Content-Length'],
    optionsSuccessStatus: 200
};

// Middleware CORS (doit être **avant** toutes les routes)
app.use(cors(corsOptions));

// Gestion des requêtes OPTIONS (preflight)
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', req.headers.origin || corsOptions.origin);
        res.header('Access-Control-Allow-Methods', corsOptions.methods.join(','));
        res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || corsOptions.allowedHeaders.join(','));
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Expose-Headers', corsOptions.exposedHeaders.join(','));
        return res.sendStatus(200);
    }
    next();
});

// Servir les fichiers statiques du dossier uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
        const origin = res.req.headers.origin;
        
        // Set CORS headers
        if (corsOptions.origin.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
        
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        
        // Allow embedding in iframe and set permissions
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Content-Security-Policy', 
            `frame-ancestors https://app.episoletudiantedumans.fr http://localhost:4200; ` +
            `default-src 'self' data: blob:; ` +
            `script-src 'self' 'unsafe-inline' 'unsafe-eval'; ` +
            `style-src 'self' 'unsafe-inline';`
        );
        res.setHeader('Permissions-Policy', 
            'fullscreen=(self "https://app.episoletudiantedumans.fr" "http://localhost:4200"), ' +
            'display-capture=(self "https://app.episoletudiantedumans.fr" "http://localhost:4200")'
        );
        
        // Set PDF-specific headers
        if (filePath.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                `inline; filename="${path.basename(filePath)}"`
            );
        }
    }
}));

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
const statsRoutes = require('./routes/stats.routes');

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/auth/student', authStudentRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/appointments', apptRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', paymentRoutes);
app.use('/api/stats', statsRoutes);

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
