require('dotenv').config({ path: '../.env' });
const sequelize = require('../config/db');
const bcrypt = require('bcryptjs');
const { User, Slot, AdminConfig, Payment, Appointment, IntervalSlot, SystemSetting } = require('../models');

async function seed() {
    console.log('--- DÉBUT DU SEEDING ---');
    // Désactiver les vérifications de clés étrangères
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { raw: true });
    await sequelize.sync({ force: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { raw: true });

    // 1. Créer les paramètres système
    await SystemSetting.create({ key: 'default_passages_quota', value: '2', description: 'Nombre de passages gratuits par défaut' });
    console.log('Paramètres système créés');

    // 2. Créer l'Admin
    const hashedAdmin = await bcrypt.hash('Admin123!', 10);
    await User.create({
        nom: 'Admin',
        prenom: 'Root',
        email: 'admin@medibook.local',
        password: hashedAdmin,
        role: 'admin'
    });
    console.log('Admin créé');

    // 2b. Créer l'utilisateur spécifique demandé
    const hashedSpecific = await bcrypt.hash('mpompompo', 10);
    await User.create({
        nom: 'Moignon',
        prenom: 'User',
        email: 'moignon168@gmail.com',
        password: hashedSpecific,
        role: 'utilisateur',
        isActive: true,
        passages_utilises: 0,
        passages_max_autorises: 2,
        justificatif_status: 'validé',
        date_derniere_validation: new Date(),
        date_inscription: new Date()
    });
    console.log('Utilisateur moignon168@gmail.com créé');

    // 3. Créer beaucoup d'utilisateurs (30 étudiants)
    const users = [];
    const hashedUser = await bcrypt.hash('User123!', 10);
    const noms = ['Martin', 'Bernard', 'Thomas', 'Petit', 'Robert', 'Richard', 'Durand', 'Dubois', 'Moreau', 'Laurent', 'Simon', 'Michel', 'Lefebvre', 'Leroy', 'Roux', 'David', 'Bertrand', 'Morel', 'Fournier', 'Girard', 'Bonnet', 'Dupont', 'Lambert', 'Fontaine', 'Rousseau', 'Vincent', 'Muller', 'Lefevre', 'Faure', 'Andre'];
    const prenoms = ['Jean', 'Marie', 'Pierre', 'Anne', 'Michel', 'Catherine', 'Philippe', 'Isabelle', 'Françoise', 'Alain', 'Nicolas', 'Christophe', 'Benoit', 'Stéphane', 'David', 'Jérôme', 'Guillaume', 'Sébastien', 'Aurélie', 'Julie', 'Céline', 'Élodie', 'Sandrine', 'Émilie', 'Sophie', 'Mathieu', 'Romain', 'Julien', 'Anthony', 'Kévin'];
    const ecoles = ['Université du Mans', 'IUT du Mans', 'ISMANS', 'ESGT', 'ENSIM'];
    const specialites = ['Informatique', 'Gestion', 'Mécanique', 'Acoustique', 'Géomatique', 'Électronique'];

    for (let i = 0; i < 30; i++) {
        const user = await User.create({
            nom: noms[i % noms.length],
            prenom: prenoms[i % prenoms.length],
            email: `student${i + 1}@example.com`,
            password: hashedUser,
            role: 'utilisateur',
            isActive: i % 10 !== 0, // 90% actifs
            passages_utilises: Math.floor(Math.random() * 3),
            passages_max_autorises: 2,
            telephone: `06${Math.floor(10000000 + Math.random() * 90000000)}`,
            ecole_universite: ecoles[Math.floor(Math.random() * ecoles.length)],
            specialite: specialites[Math.floor(Math.random() * specialites.length)],
            justificatif_status: i % 5 === 0 ? 'en_attente' : 'validé',
            date_derniere_validation: new Date(),
            date_inscription: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000)
        });
        users.push(user);
    }
    console.log('30 Utilisateurs créés');

    // 3b. Créer des étudiants inactifs depuis plus d'un an (pour tester le nettoyage annuel)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    for (let i = 0; i < 10; i++) {
        await User.create({
            nom: noms[(i + 5) % noms.length],
            prenom: prenoms[(i + 5) % prenoms.length],
            email: `inactive${i + 1}@example.com`,
            password: hashedUser,
            role: 'utilisateur',
            isActive: true,
            passages_utilises: 0,
            passages_max_autorises: 2,
            telephone: `07${Math.floor(10000000 + Math.random() * 90000000)}`,
            ecole_universite: ecoles[Math.floor(Math.random() * ecoles.length)],
            specialite: specialites[Math.floor(Math.random() * specialites.length)],
            justificatif_status: 'en_attente',
            date_derniere_validation: null,
            createdAt: twoYearsAgo,
            updatedAt: twoYearsAgo,
            date_inscription: twoYearsAgo
        });
    }
    console.log('10 Étudiants inactifs (depuis 2 ans) créés');

    // 4. Créer des créneaux (Slots) sur 2 semaines
    const dates = [];
    const today = new Date();
    for (let i = -7; i < 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (d.getDay() !== 0 && d.getDay() !== 6) { // Pas le week-end
            dates.push(d.toISOString().split('T')[0]);
        }
    }

    const slots = [];
    for (const date of dates) {
        // Matin
        const slot = await Slot.create({
            date: date,
            heure_debut: '09:00:00',
            heure_fin: '12:00:00',
            interval_minutes: 20,
            capacite_par_interval: 3,
            isActive: true
        });
        slots.push(slot);

        // Créer les IntervalSlots associés (normalement fait par le contrôleur, mais on le simule ici)
        let startTime = 9 * 60; // 09:00 en minutes
        const endTime = 12 * 60; // 12:00 en minutes
        while (startTime < endTime) {
            const h = Math.floor(startTime / 60);
            const m = startTime % 60;
            const hStr = h.toString().padStart(2, '0');
            const mStr = m.toString().padStart(2, '0');
            
            await IntervalSlot.create({
                slot_parent_id: slot.id,
                date: date,
                heure_debut: `${hStr}:${mStr}:00`,
                heure_fin: `${hStr}:${(m + 20) % 60 === 0 ? (h + 1).toString().padStart(2, '0') : hStr}:${(m + 20) % 60 === 0 ? '00' : (m + 20).toString().padStart(2, '0')}:00`,
                capacite_max: 3,
                places_restantes: 3,
                isActive: true
            });
            startTime += 20;
        }
    }
    console.log(`${dates.length} Jours de créneaux créés`);

    // 5. Créer des rendez-vous (Appointments)
    const intervalSlots = await IntervalSlot.findAll();
    for (let i = 0; i < 50; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const randomInterval = intervalSlots[Math.floor(Math.random() * intervalSlots.length)];
        
        const statusOptions = ['confirmé', 'annulé', 'manqué', 'validé_admin'];
        const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];

        await Appointment.create({
            userId: randomUser.id,
            intervalSlotId: randomInterval.id,
            date_rdv: randomInterval.date,
            heure_debut: randomInterval.heure_debut,
            heure_fin: randomInterval.heure_fin,
            status: status,
            note: i % 5 === 0 ? 'Besoin de produits frais' : '',
            valide_par_admin: status === 'validé_admin'
        });

        if (status === 'confirmé' || status === 'validé_admin') {
            await randomInterval.decrement('places_restantes');
        }
    }
    console.log('50 Rendez-vous créés');

    // 6. Créer des paiements
    for (let i = 0; i < 15; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const kilos = Math.floor(Math.random() * 15) + 5;
        const status = Math.random() > 0.2 ? 'payé' : 'impayé';
        
        await Payment.create({
            userId: randomUser.id,
            nombre_kilos: kilos,
            prix_total: (kilos * 0.5).toFixed(2),
            status: status,
            note: 'Paiement mensuel'
        });

        // Simuler le fait que certains utilisateurs ont payé leur cotisation annuelle
        if (status === 'payé' && Math.random() > 0.5) {
            await randomUser.update({ paiement: true });
        }
    }
    console.log('15 Paiements créés');

    console.log('\n=== SEEDING TERMINÉ AVEC SUCCÈS ===');
    console.log('Admin: admin@medibook.local / Admin123!');
    console.log('Étudiants: student1@example.com à student30@example.com / User123!');
    
    process.exit(0);
}

seed().catch(err => {
    console.error('ERREUR LORS DU SEEDING:', err);
    process.exit(1);
});
