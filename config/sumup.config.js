require('dotenv').config();

const config = {
    // Clé API SumUp (Secret Key)
    apiKey: process.env.SUMUP_API_KEY,
    // Token d'accès (peut être identique à l'API Key pour certaines intégrations)
    accessToken: process.env.SUMUP_API_KEY,
    // Email du compte SumUp
    payToEmail: process.env.SUMUP_PAY_TO_EMAIL,
    // Configuration de base
    apiUrl: process.env.SUMUP_API_URL || 'https://api.sumup.com',
    merchantCode: process.env.SUMUP_MERCHANT_CODE || 'MZQ42HAM',
    defaultCurrency: 'EUR',
    defaultCountry: 'FR',
    defaultDescription: 'Paiement Epicerie Solidaire',
    checkoutUrl: 'https://checkout.sumup.com/pay'
};

// Vérification des variables obligatoires
if (!config.apiKey) {
    console.error(' ERREUR: SUMUP_API_KEY n\'est pas définie dans le fichier .env');
}
if (!config.payToEmail) {
    console.error(' ERREUR: SUMUP_PAY_TO_EMAIL n\'est pas défini dans le fichier .env');
}

console.log(' Configuration SumUp chargée:', {
    ...config,
    apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : 'non définie',
    accessToken: config.accessToken ? '***' + config.accessToken.slice(-4) : 'non défini',
    payToEmail: config.payToEmail ? '***' + config.payToEmail.split('@')[1] : 'non défini'
});

module.exports = config;

