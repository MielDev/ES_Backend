const { sequelize, User, Appointment } = require('./models');

async function migrateMissedAppointments() {
    try {
        console.log('--- DÉBUT DE LA MIGRATION DES ABSENCES ---');

        // 1. Récupérer le nombre de rendez-vous manqués par utilisateur
        const [results] = await sequelize.query(`
            SELECT userId, COUNT(*) as missedCount 
            FROM Appointments 
            WHERE status = 'manqué' 
            GROUP BY userId
        `);

        console.log(`Données trouvées pour ${results.length} utilisateurs.`);

        for (const row of results) {
            const { userId, missedCount } = row;
            if (userId) {
                await User.update({
                    nb_absences_total: missedCount,
                    nb_absences_depuis_derniere_sanction: missedCount
                }, {
                    where: { id: userId }
                });
                console.log(`Utilisateur ID ${userId} : ${missedCount} absences enregistrées.`);
            }
        }

        console.log('--- MIGRATION TERMINÉE AVEC SUCCÈS ---');
        process.exit(0);
    } catch (error) {
        console.error('ERREUR LORS DE LA MIGRATION :', error);
        process.exit(1);
    }
}

migrateMissedAppointments();