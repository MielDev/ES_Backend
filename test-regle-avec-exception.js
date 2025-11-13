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

async function testRegleAvecException() {
    try {
        console.log('🔐 Connexion...');
        const loginResponse = await makeRequest('POST', '/auth/login', USER_CREDENTIALS);
        const token = loginResponse.data.token;

        console.log('👤 Utilisateur connecté:', loginResponse.data.user.email);

        // 1. Voir les créneaux disponibles de la même semaine
        console.log('\n📅 Créneaux disponibles (même semaine):');
        const slotsResponse = await makeRequest('GET', '/slots', null, token);

        // Filtrer les slots de la même semaine (20 octobre 2025)
        const targetWeekSlots = slotsResponse.data.filter(slot =>
            slot.date.startsWith('2025-10-20') || slot.date.startsWith('2025-10-21') || slot.date.startsWith('2025-10-23')
        );

        console.log('Créneaux trouvés pour la semaine du 20/10/2025:');
        targetWeekSlots.forEach(slot => {
            console.log(`   Slot ${slot.id}: ${slot.date} ${slot.heure} (${slot.places_restantes}/${slot.capacite_max})`);
        });

        if (targetWeekSlots.length < 3) {
            console.log('❌ Pas assez de créneaux dans la même semaine pour tester');
            return;
        }

        // 2. Prendre le premier RDV de la semaine
        const firstSlot = targetWeekSlots[0];
        console.log(`\n📝 Prise du premier RDV (slot ${firstSlot.id})...`);
        const firstBookResponse = await makeRequest('POST', '/appointments', {
            slotId: firstSlot.id,
            note: 'Premier RDV de la semaine'
        }, token);

        console.log('✅ Premier RDV:', firstBookResponse.data.message || 'OK');

        // 3. Prendre le deuxième RDV de la semaine (devrait échouer)
        const secondSlot = targetWeekSlots[1];
        console.log(`\n📝 Tentative de deuxième RDV (slot ${secondSlot.id})...`);
        try {
            const secondBookResponse = await makeRequest('POST', '/appointments', {
                slotId: secondSlot.id,
                note: 'Deuxième RDV de la semaine'
            }, token);

            console.log('❌ ERREUR: Deuxième RDV accepté (ne devrait pas arriver!)');
        } catch (error) {
            console.log('✅ CORRECT: Deuxième RDV refusé:', error.response?.data?.message);
        }

        // 4. Annuler le premier RDV
        console.log('\n📋 Mes RDV avant annulation:');
        const appointmentsBeforeCancel = await makeRequest('GET', '/appointments/me', null, token);
        const confirmedAppt = appointmentsBeforeCancel.data.find(appt => appt.status === 'confirmé');

        if (confirmedAppt) {
            console.log(`❌ Annulation du RDV ${confirmedAppt.id}...`);
            await makeRequest('DELETE', `/appointments/${confirmedAppt.id}`, null, token);
            console.log('✅ RDV annulé');
        }

        // 5. Reprendre le même RDV annulé (devrait réussir)
        console.log(`\n🔄 Reprise du même RDV (slot ${firstSlot.id})...`);
        try {
            const rebookResponse = await makeRequest('POST', '/appointments', {
                slotId: firstSlot.id,
                note: 'RDV repris après annulation'
            }, token);

            console.log('✅ CORRECT: Reprise acceptée:', rebookResponse.data.message);
        } catch (error) {
            console.log('❌ ERREUR: Reprise refusée (ne devrait pas arriver):', error.response?.data?.message);
        }

        // 6. Prendre un RDV sur le slot qui était refusé avant (maintenant devrait échouer car on a déjà 1 RDV)
        console.log(`\n📝 Tentative de RDV sur slot ${secondSlot.id} (après reprise)...`);
        try {
            const thirdBookResponse = await makeRequest('POST', '/appointments', {
                slotId: secondSlot.id,
                note: 'Troisième RDV de la semaine'
            }, token);

            console.log('❌ ERREUR: Troisième RDV accepté (ne devrait pas arriver!)');
        } catch (error) {
            console.log('✅ CORRECT: Troisième RDV refusé:', error.response?.data?.message);
        }

        // 7. Voir l'état final
        console.log('\n📋 RDV finaux:');
        const finalAppointments = await makeRequest('GET', '/appointments/me', null, token);
        finalAppointments.data.forEach(appt => {
            console.log(`   RDV ${appt.id}: ${appt.status} - ${appt.slot.date} ${appt.slot.heure} (${appt.note})`);
        });

        console.log('\n🎯 Test de la règle avec exception terminé !');

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data?.message || error.message);
        console.log('\n💡 Assurez-vous que:');
        console.log('   1. Le serveur est démarré (npm start)');
        console.log('   2. La base de données est initialisée (npm run seed)');
    }
}

testRegleAvecException();
