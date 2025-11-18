const bcrypt = require('bcryptjs');
const { sequelize, User, Slot, IntervalSlot } = require('./models');
require('dotenv').config();

async function seedDatabase() {
    try {
        console.log('🌱 Initialisation des données de base...');

        await sequelize.sync({ force: false });

        // 1. Créer un admin par défaut
        console.log('1. Création de l\'admin...');
        const adminPassword = await bcrypt.hash('admin123', 10);
        const admin = await User.findOrCreate({
            where: { email: 'admin@epicerie.fr' },
            defaults: {
                nom: 'Admin',
                prenom: 'System',
                email: 'admin@epicerie.fr',
                password: adminPassword,
                role: 'admin',
                isActive: true,
                passages_max_autorises: 100
            }
        });

        // 2. Créer quelques étudiants de test
        console.log('2. Création des étudiants de test...');
        const studentPassword = await bcrypt.hash('student123', 10);

        const students = [
            {
                nom: 'Martin',
                prenom: 'Jean',
                email: 'jean.martin@univ.fr',
                telephone: '0612345678',
                ecole_universite: 'Université du Mans',
                specialite: 'Informatique',
                justificatif_status: 'validé'
            },
            {
                nom: 'Durand',
                prenom: 'Marie',
                email: 'marie.durand@univ.fr',
                telephone: '0623456789',
                ecole_universite: 'ENSIM',
                specialite: 'Génie Civil',
                justificatif_status: 'validé'
            },
            {
                nom: 'Petit',
                prenom: 'Lucas',
                email: 'lucas.petit@univ.fr',
                telephone: '0634567890',
                ecole_universite: 'UTC',
                specialite: 'Mécanique',
                justificatif_status: 'en_attente'
            }
        ];

        for (const student of students) {
            await User.findOrCreate({
                where: { email: student.email },
                defaults: {
                    ...student,
                    password: studentPassword,
                    role: 'student',
                    isActive: true,
                    passages_max_autorises: 10,
                    passages_utilises: 0,
                    date_inscription: new Date()
                }
            });
        }

        // 3. Créer des créneaux principaux pour la semaine prochaine
        console.log('3. Création des créneaux principaux...');
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        // Créer des créneaux pour lundi, mercredi, vendredi de la semaine prochaine
        const slotDays = [
            { dayOffset: 1, dayName: 'Lundi' },    // Lundi prochain
            { dayOffset: 3, dayName: 'Mercredi' },  // Mercredi prochain  
            { dayOffset: 5, dayName: 'Vendredi' }   // Vendredi prochain
        ];

        const createdSlots = [];

        for (const day of slotDays) {
            const slotDate = new Date(nextWeek);
            slotDate.setDate(nextWeek.getDate() + (day.dayOffset - nextWeek.getDay()));

            // Créer un créneau matin (8h-12h)
            const morningSlot = await Slot.findOrCreate({
                where: {
                    date: slotDate.toISOString().split('T')[0],
                    heure_debut: '08:00:00',
                    heure_fin: '12:00:00'
                },
                defaults: {
                    date: slotDate.toISOString().split('T')[0],
                    heure_debut: '08:00:00',
                    heure_fin: '12:00:00',
                    interval_minutes: 15,
                    capacite_par_interval: 3,
                    isActive: true
                }
            });

            // Créer un créneau après-midi (14h-18h)
            const afternoonSlot = await Slot.findOrCreate({
                where: {
                    date: slotDate.toISOString().split('T')[0],
                    heure_debut: '14:00:00',
                    heure_fin: '18:00:00'
                },
                defaults: {
                    date: slotDate.toISOString().split('T')[0],
                    heure_debut: '14:00:00',
                    heure_fin: '18:00:00',
                    interval_minutes: 15,
                    capacite_par_interval: 3,
                    isActive: true
                }
            });

            createdSlots.push(morningSlot[0], afternoonSlot[0]);
        }

        // 4. Générer automatiquement les intervalles pour chaque slot
        console.log('4. Génération des intervalles...');
        let totalIntervals = 0;

        for (const slot of createdSlots) {
            if (slot[0]) slot = slot[0]; // Récupérer l'objet si c'est un tableau [instance, created]

            // Supprimer les anciens intervalles pour ce slot
            await IntervalSlot.destroy({ where: { slot_parent_id: slot.id } });

            const [startHour, startMin] = slot.heure_debut.split(':').map(Number);
            const [endHour, endMin] = slot.heure_fin.split(':').map(Number);

            const startTime = startHour * 60 + startMin;
            const endTime = endHour * 60 + endMin;

            // Générer tous les intervalles
            for (let currentTime = startTime; currentTime < endTime; currentTime += slot.interval_minutes) {
                const hour = Math.floor(currentTime / 60);
                const minute = currentTime % 60;

                const heure_debut_interval = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
                const heure_fin_interval = `${hour.toString().padStart(2, '0')}:${(minute + slot.interval_minutes).toString().padStart(2, '0')}:00`;

                await IntervalSlot.create({
                    date: slot.date,
                    heure_debut: heure_debut_interval,
                    heure_fin: heure_fin_interval,
                    capacite_max: slot.capacite_par_interval,
                    places_restantes: slot.capacite_par_interval,
                    slot_parent_id: slot.id,
                    isActive: true
                });

                totalIntervals++;
            }
        }

        // 5. Afficher le résumé
        console.log('\n✅ Base de données initialisée avec succès !');
        console.log('\n📊 Résumé :');
        console.log(`👤 Admin: admin@epicerie.fr / admin123`);
        console.log(`🎓 Étudiants créés: ${students.length}`);
        console.log(`📅 Créneaux principaux: ${createdSlots.length}`);
        console.log(`⏰ Intervalles générés: ${totalIntervals}`);

        console.log('\n🔐 Comptes étudiants de test :');
        for (const student of students) {
            console.log(`   ${student.email} / student123 (${student.justificatif_status})`);
        }

        console.log('\n🚀 Vous pouvez maintenant tester l\'application !');

        process.exit(0);

    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation :', error);
        process.exit(1);
    }
}

seedDatabase();
