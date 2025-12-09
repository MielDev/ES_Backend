const { Op } = require('sequelize');
const { Appointment } = require('../models');

// Vérifier et mettre à jour les rendez-vous manqués
const updateMissedAppointments = async () => {
    try {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 heure en arrière

        // Formater les dates et heures
        const today = now.toISOString().split('T')[0];
        const oneHourAgoTime = oneHourAgo.toTimeString().split(' ')[0];
        const nowTime = now.toTimeString().split(' ')[0];

        console.log('=== Début vérification RDV manqués ===');
        console.log('Date actuelle:', now);
        console.log('Date du jour (YYYY-MM-DD):', today);
        console.log('Heure actuelle (HH:MM:SS):', nowTime);
        console.log('Heure il y a 1h (HH:MM:SS):', oneHourAgoTime);

        // Construction de la requête pour le débogage
        const whereClause = {
            status: 'confirmé',
            valide_par_admin: false,
            [Op.or]: [
                // Cas 1: Date du RDV est avant aujourd'hui
                {
                    date_rdv: {
                        [Op.lt]: today
                    }
                },
                // Cas 2: C'est aujourd'hui ET l'heure de fin est passée depuis plus d'1h
                {
                    date_rdv: today,
                    heure_fin: {
                        [Op.lt]: oneHourAgoTime
                    }
                }
            ]
        };

        console.log('Requête de recherche des RDV manqués:', JSON.stringify(whereClause, null, 2));

        // Mettre à jour les rendez-vous manqués
        const [updatedCount] = await Appointment.update(
            { status: 'manqué' },
            { where: whereClause }
        );

        if (updatedCount > 0) {
            console.log(`✅ ${updatedCount} rendez-vous marqués comme manqués`);
        } else {
            console.log('ℹ️ Aucun rendez-vous à marquer comme manqué');
        }
        
        // Vérifier combien de RDV correspondent aux critères (pour débogage)
        const count = await Appointment.count({ where: whereClause });
        console.log(`ℹ️ ${count} RDV correspondent actuellement aux critères de recherche`);
        
        return updatedCount;
    } catch (error) {
        console.error('Erreur lors de la mise à jour des rendez-vous manqués:', error);
        throw error;
    }
};

// Planifier la vérification des rendez-vous manqués toutes les 30 minutes
const startMissedAppointmentsCheck = () => {
    console.log('🚀 Démarrage du service de vérification des RDV manqués...');
    
    // Exécuter immédiatement au démarrage
    updateMissedAppointments().catch(error => {
        console.error('❌ Erreur lors de la vérification initiale des RDV manqués:', error);
    });

    // Puis toutes les 30 minutes
    const interval = setInterval(() => {
        console.log('\n⏰ Vérification périodique des RDV manqués...');
        updateMissedAppointments().catch(error => {
            console.error('❌ Erreur lors de la vérification périodique des RDV manqués:', error);
        });
    }, 30 * 60 * 1000); // 30 minutes
    
    // Retourner la référence à l'intervalle pour pouvoir l'arrêter si nécessaire
    return interval;
};

module.exports = {
    updateMissedAppointments,
    startMissedAppointmentsCheck
};
