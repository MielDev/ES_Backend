require('dotenv').config({ path: '../.env' });
const sequelize = require('../config/db');
const bcrypt = require('bcryptjs');
const { User, Slot, AdminConfig, Payment, Appointment } = require('../models');

async function seed() {
    // Désactiver les vérifications de clés étrangères pour pouvoir supprimer les tables
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { raw: true });
    
    await sequelize.sync({ force: true }); // attention: supprime les données existantes
    
    // Réactiver les vérifications de clés étrangères
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { raw: true });

    const hashed = await bcrypt.hash('Admin123!', 10);
    const admin = await User.create({ nom: 'Admin', prenom: 'Root', email: 'admin@medibook.local', password: hashed, role: 'admin' });
    console.log('Admin créé:', admin.email);

    // Créer des utilisateurs normaux
    const hashedUser1 = await bcrypt.hash('User123!', 10);
    const hashedUser2 = await bcrypt.hash('User456!', 10);

    const user1 = await User.create({
        nom: 'Martin',
        prenom: 'Jean',
        email: 'jean.martin@email.com',
        password: hashedUser1,
        role: 'utilisateur',
        isActive: true,
        passages_utilises: 0,
        passages_max_autorises: 2,
        telephone: '06.12.34.56.78',
        ecole_universite: 'Université du Mans',
        specialite: 'Informatique',
        justificatif_status: 'validé',
        date_derniere_validation: new Date(),
        date_inscription: new Date()
    });

    const user2 = await User.create({
        nom: 'Dubois',
        prenom: 'Marie',
        email: 'marie.dubois@email.com',
        password: hashedUser2,
        role: 'utilisateur',
        isActive: false, // utilisateur désactivé
        passages_utilises: 1,
        passages_max_autorises: 1,
        telephone: '06.98.76.54.32',
        ecole_universite: 'IUT du Mans',
        specialite: 'Gestion',
        justificatif_status: 'en_attente',
        date_derniere_validation: new Date(),
        date_inscription: new Date()
    });

    console.log('Utilisateurs créés');

    // Configuration admin pour les créneaux
    const configs = [
        { date_specifique: '2025-01-06', heure_debut: '08:00', heure_fin: '12:00' }, // lundi
        { date_specifique: '2025-01-07', heure_debut: '09:00', heure_fin: '16:00' }, // mardi
        { date_specifique: '2025-01-09', heure_debut: '10:00', heure_fin: '15:00' }, // jeudi
        { date_specifique: '2025-01-10', heure_debut: '08:30', heure_fin: '11:30' }, // vendredi
    ];

    for (const config of configs) {
        await AdminConfig.create(config);
    }
    console.log('Configurations admin créées');

    // Exemple de quelques slots (dates)
    const slotsData = [
        { date: '2025-01-06', heure_debut: '08:00:00', heure_fin: '12:00:00', interval_minutes: 15, capacite_par_interval: 5 },
        { date: '2025-01-06', heure_debut: '09:00:00', heure_fin: '10:00:00', interval_minutes: 15, capacite_par_interval: 3 },
        { date: '2025-01-07', heure_debut: '10:00:00', heure_fin: '11:00:00', interval_minutes: 15, capacite_par_interval: 3 },
        { date: '2025-01-09', heure_debut: '10:00:00', heure_fin: '12:00:00', interval_minutes: 15, capacite_par_interval: 4 },
        { date: '2025-01-09', heure_debut: '11:00:00', heure_fin: '12:00:00', interval_minutes: 15, capacite_par_interval: 2 },
    ];

    for (const s of slotsData) {
        await Slot.create(s);
    }
    console.log('Slots créés');

    // Exemples de rendez-vous
    const appointments = [
        { userId: user1.id, date_rdv: '2025-01-06', heure_debut: '08:00:00', heure_fin: '08:15:00', status: 'confirmé', note: 'Premier rendez-vous' },
        { userId: user2.id, date_rdv: '2025-01-06', heure_debut: '09:00:00', heure_fin: '09:15:00', status: 'annulé', note: 'Annulé par l\'utilisateur' },
        { userId: user1.id, date_rdv: '2025-01-07', heure_debut: '10:00:00', heure_fin: '10:15:00', status: 'annulé', note: 'Annulé définitivement' },
    ];

    for (const appt of appointments) {
        await Appointment.create(appt);
    }
    console.log('Rendez-vous créés');

    // Exemples de paiements
    const payments = [
        { userId: user1.id, nombre_kilos: 10, prix_total: 5.00, status: 'payé', note: 'Achat du 15/12/2024' },
        { userId: user2.id, nombre_kilos: 6, prix_total: 3.00, status: 'payé', note: 'Achat du 10/12/2024' },
        { userId: user1.id, nombre_kilos: 8, prix_total: 4.00, status: 'impayé', note: 'En attente de paiement' },
    ];

    for (const payment of payments) {
        await Payment.create(payment);
    }
    console.log('Paiements créés');

    console.log('\n=== DONNÉES DE TEST CRÉÉES ===');
    console.log('Admin: admin@medibook.local / Admin123!');
    console.log('User1: jean.martin@email.com / User123! (actif, Université du Mans - Informatique - justificatif validé)');
    console.log('User2: marie.dubois@email.com / User456! (inactif, IUT du Mans - Gestion - justificatif en attente)');
    console.log('Configurations: lundi, mardi, jeudi actifs');
    console.log('Rendez-vous: 3 exemples (confirmé, annulé, annulé)');
    console.log('Paiements: 3 exemples créés');

    process.exit(0);
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
