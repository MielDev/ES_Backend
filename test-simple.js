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

async function testAnnulationSimple() {
    try {
        console.log('🔐 Connexion...');
        const loginResponse = await makeRequest('POST', '/auth/login', USER_CREDENTIALS);
        const token = loginResponse.data.token;

        console.log('👤 Utilisateur connecté:', loginResponse.data.user.email);

        // 1. Voir les créneaux AVANT
        console.log('\n📅 Créneaux avant annulation:');
        const slotsBefore = await makeRequest('GET', '/slots', null, token);
        slotsBefore.data.forEach(slot => {
            console.log(`   Slot ${slot.id}: ${slot.places_restantes}/${slot.capacite_max} places (${slot.date} ${slot.heure})`);
        });

        // 2. Voir mes rendez-vous
        console.log('\n📋 Mes rendez-vous:');
        const appointmentsResponse = await makeRequest('GET', '/appointments/me', null, token);
        appointmentsResponse.data.forEach(appt => {
            console.log(`   RDV ${appt.id}: ${appt.status} - Slot ${appt.slotId}`);
        });

        // 3. Annuler le premier rendez-vous
        if (appointmentsResponse.data.length > 0) {
            const firstAppt = appointmentsResponse.data[0];
            console.log(`\n❌ Annulation du RDV ${firstAppt.id}...`);

            await makeRequest('DELETE', `/appointments/${firstAppt.id}`, null, token);
            console.log('✅ Annulé !');

            // 4. Voir les créneaux APRÈS annulation
            console.log('\n📅 Créneaux après annulation:');
            const slotsAfter = await makeRequest('GET', '/slots', null, token);
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

            console.log('\n🎯 Résultat: La place est maintenant disponible pour tout le monde !');
        }

    } catch (error) {
        console.error('❌ Erreur:', error);
        console.log('\n💡 Assurez-vous que:');
        console.log('   1. Le serveur est démarré (npm start)');
        console.log('   2. La base de données est initialisée (npm run seed)');
    }
}

testAnnulationSimple();
