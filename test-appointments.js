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

async function testAppointmentsMe() {
    try {
        console.log('🔐 Connexion...');
        const loginResponse = await makeRequest('POST', '/auth/login', USER_CREDENTIALS);
        const token = loginResponse.data.token;

        console.log('👤 Utilisateur connecté:', loginResponse.data.user.email);

        // Voir mes rendez-vous
        console.log('\n📋 Mes rendez-vous:');
        const appointmentsResponse = await makeRequest('GET', '/appointments/me', null, token);

        console.log('\n📅 Structure de la réponse:');
        if (appointmentsResponse.data.length > 0) {
            console.log(JSON.stringify(appointmentsResponse.data[0], null, 2));
        } else {
            console.log('Aucun rendez-vous trouvé');
        }

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data?.message || error.message);
        console.log('\n💡 Assurez-vous que:');
        console.log('   1. Le serveur est démarré (npm start)');
        console.log('   2. La base de données est initialisée (npm run seed)');
    }
}

testAppointmentsMe();
