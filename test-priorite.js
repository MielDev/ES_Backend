const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Données de test
const USER_CREDENTIALS = {
    email: 'jean.martin@email.com',
    password: 'User123!'
};

async function testAnnulationAvecPriorite() {
    try {
        console.log('🔐 Connexion...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, USER_CREDENTIALS);
        const token = loginResponse.data.token;
        const headers = { Authorization: `Bearer ${token}` };

        console.log('👤 Utilisateur connecté:', loginResponse.data.user.email);
        console.log('📊 Passages:', loginResponse.data.user.passages_utilises, '/', loginResponse.data.user.passages_max_autorises);

        // 1. Voir les créneaux disponibles
        console.log('\n📅 Créneaux disponibles:');
        const slotsResponse = await axios.get(`${BASE_URL}/slots`, { headers });
        slotsResponse.data.forEach(slot => {
            console.log(`   Slot ${slot.id}: ${slot.places_restantes}/${slot.capacite_max} places (${slot.date} ${slot.heure})`);
        });

        // 2. Voir mes rendez-vous
        console.log('\n📋 Mes rendez-vous:');
        const appointmentsResponse = await axios.get(`${BASE_URL}/appointments/me`, { headers });
        appointmentsResponse.data.forEach(appt => {
            console.log(`   RDV ${appt.id}: ${appt.status} - Slot ${appt.slotId} (${appt.slot?.date} ${appt.slot?.heure})`);
            if (appt.date_expiration_priorite) {
                console.log(`      ⏰ Priorité expire: ${new Date(appt.date_expiration_priorite).toLocaleTimeString()}`);
            }
        });

        // 3. Si pas de rendez-vous, en créer un pour tester
        if (appointmentsResponse.data.length === 0) {
            console.log('\n➕ Création d\'un rendez-vous pour tester...');
            const availableSlot = slotsResponse.data.find(slot => slot.places_restantes > 0);
            if (availableSlot) {
                await axios.post(`${BASE_URL}/appointments`, {
                    slotId: availableSlot.id,
                    note: 'Rendez-vous de test'
                }, { headers });

                // Recharger les rendez-vous
                const newAppointments = await axios.get(`${BASE_URL}/appointments/me`, { headers });
                appointmentsResponse.data = newAppointments.data;
            }
        }

        // 4. Annuler le premier rendez-vous
        if (appointmentsResponse.data.length > 0) {
            const firstAppt = appointmentsResponse.data[0];
            console.log(`\n❌ Annulation du RDV ${firstAppt.id}...`);

            const cancelResponse = await axios.delete(`${BASE_URL}/appointments/${firstAppt.id}`, { headers });
            console.log('📝 Réponse:', cancelResponse.data.message);

            // 5. Vérifier que la place n'est pas libérée
            console.log('\n📅 Créneaux après annulation:');
            const slotsAfterResponse = await axios.get(`${BASE_URL}/slots`, { headers });
            slotsAfterResponse.data.forEach(slot => {
                console.log(`   Slot ${slot.id}: ${slot.places_restantes}/${slot.capacite_max} places`);
            });

            // 6. Essayer de reprendre le rendez-vous
            console.log('\n🔄 Tentative de reprise du rendez-vous...');
            try {
                const reprendreResponse = await axios.patch(`${BASE_URL}/appointments/${firstAppt.id}/reprendre`, {}, { headers });
                console.log('✅', reprendreResponse.data.message);
            } catch (error) {
                console.log('❌', error.response?.data?.message || error.message);
            }

            // 7. Vérifier le statut final
            console.log('\n📋 Rendez-vous après reprise:');
            const finalAppointments = await axios.get(`${BASE_URL}/appointments/me`, { headers });
            finalAppointments.data.forEach(appt => {
                console.log(`   RDV ${appt.id}: ${appt.status}`);
            });
        }

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data?.message || error.message);
        console.log('\n💡 Assurez-vous que:');
        console.log('   1. Le serveur est démarré (npm start)');
        console.log('   2. La base de données est initialisée (npm run seed)');
    }
}

testAnnulationAvecPriorite();
