// setupDatabase.js
const mysql = require('mysql2/promise');

const config = {
    host: 'localhost', // ou 127.0.0.1
    user: 'root',      // ton utilisateur MySQL
    password: '',      // ton mot de passe MySQL
    port: 3307,

};

const databaseName = 'es_db';

// Removed scriptSQL variable as we're using separate queries now

(async () => {
    let connection;
    try {
        // Connect without database first
        connection = await mysql.createConnection(config);
        console.log('✅ Connexion MySQL réussie !');

        // Create database first
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${databaseName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        console.log(`📦 Base de données '${databaseName}' créée ou déjà existante`);

        // Switch to the database
        await connection.query(`USE ${databaseName};`);
        console.log(`🔄 Utilisation de la base de données '${databaseName}'`);

        // Execute each SQL statement separately
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
              id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              nom VARCHAR(100) NOT NULL,
              prenom VARCHAR(100) NOT NULL,
              email VARCHAR(150) NOT NULL UNIQUE,
              mot_de_passe VARCHAR(255) NOT NULL,
              role ENUM('admin', 'utilisateur') DEFAULT 'utilisateur',
              telephone VARCHAR(20),
              date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS time_slots (
              id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              jour ENUM('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi') NOT NULL,
              heure TIME NOT NULL,
              capacite_totale INT DEFAULT 10,
              capacite_restante INT DEFAULT 10,
              statut ENUM('disponible', 'complet', 'fermé') DEFAULT 'disponible',
              date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS appointments (
              id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              user_id INT UNSIGNED NOT NULL,
              time_slot_id INT UNSIGNED NOT NULL,
              date_rdv DATE NOT NULL,
              statut ENUM('confirmé', 'annulé', 'en_attente') DEFAULT 'en_attente',
              date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (time_slot_id) REFERENCES time_slots(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        

        await connection.query(`
            INSERT INTO users (nom, prenom, email, mot_de_passe, role)
            VALUES ('Admin', 'Principal', 'admin@medibook.fr', SHA2('admin123', 256), 'admin')
            ON DUPLICATE KEY UPDATE email=email;
        `);

        await connection.query(`
            INSERT INTO time_slots (jour, heure, capacite_totale, capacite_restante)
            VALUES
            ('Mardi', '08:00:00', 10, 10),
            ('Jeudi', '09:00:00', 10, 10),
            ('Jeudi', '10:00:00', 10, 10)
            ON DUPLICATE KEY UPDATE jour=jour;
        `);
        console.log('🎉 Tables créées et données insérées avec succès !');

        await connection.end();
    } catch (err) {
        console.error('❌ Erreur lors de la création de la base de données :', err.message);
        if (connection) await connection.end();
    }
})();
