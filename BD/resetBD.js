const mysql = require('mysql2/promise');

(async () => {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: ''
  });

  try {
    await connection.query('DROP DATABASE IF EXISTS es_db;');
    console.log('🗑️ Base de données supprimée avec succès !');
  } catch (err) {
    console.error('❌ Erreur lors de la suppression :', err.message);
  } finally {
    await connection.end();
  }
})();
