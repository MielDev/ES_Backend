const { Op } = require('sequelize');
const { Appointment } = require('../models');

// Vérifier et mettre à jour les rendez-vous manqués
const updateMissedAppointments = async () => {
    try {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 heure en arrière

        // Formater la date et l'heure pour la requête
        const dateStr = oneHourAgo.toISOString().split('T')[0];
        const timeStr = oneHourAgo.toTimeString().split(' ')[0];

        // Mettre à jour les rendez-vous non validés dont l'heure est passée de plus d'une heure
        const [updatedCount] = await Appointment.update(
            { status: 'manqué' },
            {
                where: {
                    status: 'confirmé',
                    date_rdv: {
                        [Op.lte]: dateStr
                    },
                    heure_fin: {
                        [Op.lt]: timeStr
                    },
                    valide_par_admin: false
                }
            }
        );

        console.log(`${updatedCount} rendez-vous marqués comme manqués`);
        return updatedCount;
    } catch (error) {
        console.error('Erreur lors de la mise à jour des rendez-vous manqués:', error);
        throw error;
    }
};

// Planifier la vérification des rendez-vous manqués toutes les 30 minutes
const startMissedAppointmentsCheck = () => {
    // Exécuter immédiatement au démarrage
    updateMissedAppointments().catch(console.error);

    // Puis toutes les 30 minutes
    return setInterval(() => {
        updateMissedAppointments().catch(console.error);
    }, 30 * 60 * 1000); // 30 minutes
};

module.exports = {
    updateMissedAppointments,
    startMissedAppointmentsCheck
};
