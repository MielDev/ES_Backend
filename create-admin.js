const bcrypt = require('bcryptjs');
const { sequelize, User } = require('./models');
require('dotenv').config();

async function createAdmin() {
    try {
        console.log('🔑 Création du compte administrateur...');

        // Synchroniser les modèles avec la base de données
        await sequelize.sync({ force: false });

        // Créer un administrateur par défaut
        const adminPassword = await bcrypt.hash('admin321', 10);
        const [admin, created] = await User.findOrCreate({
            where: { email: 'admin@epicerie.fr' },
            defaults: {
                nom: 'Admin',
                prenom: 'System',
                email: 'admin@epicerie.fr',
                password: adminPassword,
                role: 'admin',
                isActive: true,
                passages_max_autorises: 100,
                date_inscription: new Date()
            }
        });

        if (created) {
            console.log('✅ Compte administrateur créé avec succès !');
            console.log('📋 Informations de connexion :');
            console.log(`   Email: admin@epicerie.fr`);
            console.log(`   Mot de passe: admin123`);
        } else {
            console.log('ℹ️ Un compte administrateur existe déjà avec cet email.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors de la création du compte administrateur :', error);
        process.exit(1);
    }
}

// Exécuter la fonction
createAdmin();
