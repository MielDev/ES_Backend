require('dotenv').config();
const sequelize = require('../config/db');
const bcrypt = require('bcryptjs');
const { User, Slot, AdminConfig, Payment, Appointment } = require('../models');

async function seed() {
    await sequelize.sync({ force: true }); // attention: supprime les données existantes

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
        { jour_semaine: 'lundi', heure_debut: '08:00', heure_fin: '12:00', nombre_passages_max: 5, is_active: true },
        { jour_semaine: 'mardi', heure_debut: '09:00', heure_fin: '16:00', nombre_passages_max: 3, is_active: true },
        { jour_semaine: 'jeudi', heure_debut: '10:00', heure_fin: '15:00', nombre_passages_max: 4, is_active: true },
        { jour_semaine: 'vendredi', heure_debut: '08:30', heure_fin: '11:30', nombre_passages_max: 2, is_active: false }, // désactivé
    ];

    for (const config of configs) {
        await AdminConfig.create(config);
    }
    console.log('Configurations admin créées');

    // Exemple de quelques slots (dates)
    const slotsData = [
        { date: '2025-10-20', heure: '08:00:00', capacite_max: 5, places_restantes: 5 },
        { date: '2025-10-20', heure: '09:00:00', capacite_max: 5, places_restantes: 3 },
        { date: '2025-10-21', heure: '10:00:00', capacite_max: 3, places_restantes: 3 },
        { date: '2025-10-23', heure: '10:00:00', capacite_max: 4, places_restantes: 4 },
        { date: '2025-10-23', heure: '11:00:00', capacite_max: 4, places_restantes: 2 },
    ];

    for (const s of slotsData) {
        await Slot.create(s);
    }
    console.log('Slots créés');

    // Exemples de rendez-vous
    const appointments = [
        { userId: user1.id, slotId: 1, status: 'confirmé', note: 'Premier rendez-vous' },
        { userId: user2.id, slotId: 2, status: 'annulé', note: 'Annulé par l\'utilisateur' },
        { userId: user1.id, slotId: 3, status: 'annulé', note: 'Annulé définitivement' },
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
