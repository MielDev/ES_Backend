const https = require('https');
const { URL } = require('url');

const BASE_URL = 'http://localhost:3000/api';

// Données de test
const USER_CREDENTIALS = {
    email: 'jean.martin@email.com',
    password: 'User123!'
};

function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Test-Script/1.0'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function testAnnulationReprise() {
    try {
        console.log('🔐 Connexion...');
        const loginResponse = await makeRequest('POST', '/auth/login', USER_CREDENTIALS);
        const token = loginResponse.data.token;

        console.log('👤 Utilisateur connecté:', loginResponse.data.user.email);

        // 1. Voir les créneaux disponibles
        console.log('\n📅 Créneaux disponibles:');
        const slotsBefore = await makeRequest('GET', '/slots', null, token);
        const availableSlot = slotsBefore.data.find(slot => slot.places_restantes > 0);

        if (!availableSlot) {
            console.log('❌ Aucun créneau disponible');
            return;
        }

        console.log(`   Slot ${availableSlot.id}: ${availableSlot.places_restantes}/${availableSlot.capacite_max} places (${availableSlot.date} ${availableSlot.heure})`);

        // 2. Prendre un rendez-vous
        console.log(`\n📝 Prise du RDV sur slot ${availableSlot.id}...`);
        const bookResponse = await makeRequest('POST', '/appointments', {
            slotId: availableSlot.id,
            note: 'Rendez-vous de test'
        }, token);

        console.log('✅ RDV pris:', bookResponse.data.message || 'OK');

        // 3. Vérifier que la place est occupée
        console.log('\n📅 Créneaux après prise de RDV:');
        const slotsAfterBook = await makeRequest('GET', '/slots', null, token);
        const bookedSlot = slotsAfterBook.data.find(slot => slot.id === availableSlot.id);
        console.log(`   Slot ${bookedSlot.id}: ${bookedSlot.places_restantes}/${bookedSlot.capacite_max} places (${bookedSlot.date} ${bookedSlot.heure})`);

        // 4. Voir mes rendez-vous
        console.log('\n📋 Mes rendez-vous:');
        const appointmentsAfterBook = await makeRequest('GET', '/appointments/me', null, token);
        const myAppointment = appointmentsAfterBook.data.find(appt => appt.status === 'confirmé');
        console.log(`   RDV ${myAppointment.id}: ${myAppointment.status} - Slot ${myAppointment.slotId}`);

        // 5. Annuler le rendez-vous
        console.log(`\n❌ Annulation du RDV ${myAppointment.id}...`);
        await makeRequest('DELETE', `/appointments/${myAppointment.id}`, null, token);
        console.log('✅ RDV annulé');

        // 6. Vérifier que la place est libérée
        console.log('\n📅 Créneaux après annulation:');
        const slotsAfterCancel = await makeRequest('GET', '/slots', null, token);
        const cancelledSlot = slotsAfterCancel.data.find(slot => slot.id === availableSlot.id);
        console.log(`   Slot ${cancelledSlot.id}: ${cancelledSlot.places_restantes}/${cancelledSlot.capacite_max} places (${cancelledSlot.date} ${cancelledSlot.heure})`);

        // 7. Reprendre le même rendez-vous
        console.log(`\n🔄 Reprise du même RDV (slot ${availableSlot.id})...`);
        const rebookResponse = await makeRequest('POST', '/appointments', {
            slotId: availableSlot.id,
            note: 'Rendez-vous repris'
        }, token);

        console.log('✅ RDV repris:', rebookResponse.data.message);

        // 8. Vérifier le résultat final
        console.log('\n📅 Créneaux finaux:');
        const slotsFinal = await makeRequest('GET', '/slots', null, token);
        const finalSlot = slotsFinal.data.find(slot => slot.id === availableSlot.id);
        console.log(`   Slot ${finalSlot.id}: ${finalSlot.places_restantes}/${finalSlot.capacite_max} places (${finalSlot.date} ${finalSlot.heure})`);

        console.log('\n📋 Mes rendez-vous finaux:');
        const finalAppointments = await makeRequest('GET', '/appointments/me', null, token);
        finalAppointments.data.forEach(appt => {
            console.log(`   RDV ${appt.id}: ${appt.status} - Slot ${appt.slotId} (${appt.slot.date} ${appt.slot.heure})`);
        });

        console.log('\n🎯 Test terminé avec succès !');

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data?.message || error.message);
        console.log('\n💡 Assurez-vous que:');
        console.log('   1. Le serveur est démarré (npm start)');
        console.log('   2. La base de données est initialisée (npm run seed)');
    }
}

testAnnulationReprise();
