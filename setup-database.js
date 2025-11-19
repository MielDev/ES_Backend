const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
    try {
        console.log('🔧 Configuration de la base de données...');

        // Connection sans spécifier de base de données pour pouvoir la créer
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || ''
        });

        console.log('✅ Connexion à MySQL établie');

        // Créer la base de données si elle n'existe pas
        await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log(`✅ Base de données '${process.env.DB_NAME}' créée avec succès`);

        await connection.end();

        // Maintenant lancer le script de seed
        console.log('🌱 Lancement du script d\'initialisation des données...');
        require('./seed-database.js');

    } catch (error) {
        console.error('❌ Erreur lors de la configuration:', error.message);
        process.exit(1);
    }
}

setupDatabase();
