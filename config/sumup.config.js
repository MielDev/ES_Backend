require('dotenv').config();

module.exports = {
    apiKey: process.env.SUMUP_API_KEY,
    apiUrl: process.env.SUMUP_API_URL || 'https://api.sumup.com',
    merchantCode: process.env.SUMUP_MERCHANT_CODE || 'MZQ42HAM', // Remplacez par votre code marchand SumUp
    defaultCurrency: 'EUR',
    defaultCountry: 'FR',
    defaultDescription: 'Paiement Epicerie Solidaire'
};
