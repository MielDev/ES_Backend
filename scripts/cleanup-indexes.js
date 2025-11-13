const { sequelize } = require('../models');
const fs = require('fs');
const path = require('path');

// Créer le dossier logs s'il n'existe pas
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logStream = fs.createWriteStream(path.join(logDir, 'db-cleanup.log'), { flags: 'a' });

const log = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    process.stdout.write(logMessage);
    logStream.write(logMessage);
};

const cleanupIndexes = async () => {
    try {
        log('Début du nettoyage des index...');
        
        // Désactiver temporairement les vérifications de clés étrangères
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { raw: true });
        
        // Obtenir la liste des index de la table Users
        const [results] = await sequelize.query(`
            SHOW INDEX FROM Users
            WHERE Key_name != 'PRIMARY' 
            AND Non_unique = 1
            AND Column_name NOT IN ('email', 'role', 'isActive', 'isDeleted', 'date_inscription')
        `);
        
        log(`Trouvés ${results.length} index à supprimer`);
        
        // Supprimer chaque index inutile
        for (const index of results) {
            const dropQuery = `ALTER TABLE Users DROP INDEX ${index.Key_name}`;
            log(`Exécution: ${dropQuery}`);
            await sequelize.query(dropQuery, { raw: true });
            log(`✓ Index ${index.Key_name} supprimé`);
        }
        
        // Réactiver les vérifications de clés étrangères
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { raw: true });
        
        log('✅ Nettoyage des index terminé avec succès');
    } catch (error) {
        log('❌ Erreur lors du nettoyage des index:');
        log(error.stack);
        throw error;
    } finally {
        // Fermer le flux de log
        logStream.end();
    }
};

// Exécuter le nettoyage
cleanupIndexes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
