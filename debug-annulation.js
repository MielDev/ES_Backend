const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Remplacez par vos vraies données
const USER_CREDENTIALS = {
    email: 'jean.martin@email.com',
    password: 'User123!'
};

async function debugAnnulation() {
    try {
        console.log('🔐 Connexion...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, USER_CREDENTIALS);
        const token = loginResponse.data.token;
        const headers = { Authorization: `Bearer ${token}` };

        console.log('👤 Utilisateur connecté:', loginResponse.data.user.email);

        // 1. Voir les créneaux AVANT
        console.log('\n📅 Créneaux avant annulation:');
        const slotsBefore = await axios.get(`${BASE_URL}/slots`, { headers });
        slotsBefore.data.forEach(slot => {
            console.log(`   Slot ${slot.id}: ${slot.places_restantes}/${slot.capacite_max} places`);
        });

        // 2. Voir mes rendez-vous
        console.log('\n📋 Mes rendez-vous:');
        const appointmentsResponse = await axios.get(`${BASE_URL}/appointments/me`, { headers });
        appointmentsResponse.data.forEach(appt => {
            console.log(`   RDV ${appt.id}: ${appt.status} - Slot ${appt.slotId}`);
        });

        if (appointmentsResponse.data.length === 0) {
            console.log('   ❌ Aucun rendez-vous à annuler');
            return;
        }

        // 3. Annuler le premier rendez-vous
        const appointmentId = appointmentsResponse.data[0].id;
        console.log(`\n❌ Annulation du RDV ${appointmentId}...`);
        await axios.delete(`${BASE_URL}/appointments/${appointmentId}`, { headers });

        // 4. Voir les créneaux APRÈS
        console.log('\n📅 Créneaux après annulation:');
        const slotsAfter = await axios.get(`${BASE_URL}/slots`, { headers });
        slotsAfter.data.forEach(slot => {
            console.log(`   Slot ${slot.id}: ${slot.places_restantes}/${slot.capacite_max} places`);
        });

        // 5. Comparaison
        console.log('\n📊 Comparaison:');
        slotsBefore.data.forEach((before, index) => {
            const after = slotsAfter.data[index];
            if (before.places_restantes !== after.places_restantes) {
                console.log(`   Slot ${before.id}: ${before.places_restantes} → ${after.places_restantes} (${after.places_restantes > before.places_restantes ? '+' : ''}${after.places_restantes - before.places_restantes})`);
            }
        });

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data?.message || error.message);
    }
}

debugAnnulation();
