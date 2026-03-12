const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Simulation exacte de la fonction forgotPassword
const resetToken = 'abc123def456';
const resetPasswordToken = resetToken; // Simplifié pour le test
const resetPasswordExpire = new Date(Date.now() + 3600000);

// Simulation de req.protocol et req.get('host')
const req = {
    protocol: 'https',
    get: (header) => header === 'host' ? 'api.episoletudiantedumans.fr' : null
};

const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/student/reset-password/${resetToken}`;
const message = `Vous avez demandé une réinitialisation de mot de passe. Veuillez cliquer sur le lien suivant : \n\n${resetUrl}\n\nCe lien expirera dans 1 heure.`;

console.log('URL de réinitialisation:', resetUrl);
console.log('Message texte:', message);

const mailOptions = {
    to: 'kadmieltognon5@gmail.com',
    subject: 'Réinitialisation de votre mot de passe - Épicerie Solidaire',
    text: message,
    html: `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Réinitialisation de mot de passe</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f8f8f8;
                }
                .container {
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                    border-top: 4px solid #4E9667;
                }
                h1 {
                    color: #4E9667;
                    text-align: center;
                    margin-bottom: 20px;
                }
                .button {
                    display: inline-block;
                    background: linear-gradient(135deg, #4E9667, #5C77B9);
                    color: white;
                    text-decoration: none;
                    padding: 12px 30px;
                    border-radius: 8px;
                    font-weight: 600;
                    margin: 20px 0;
                    text-align: center;
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    color: #666;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Réinitialisation de votre mot de passe</h1>
                <p>Bonjour,</p>
                <p>Vous avez demandé une réinitialisation de votre mot de passe pour votre compte Épicerie Solidaire.</p>
                <p>Veuillez cliquer sur le bouton ci-dessous pour réinitialiser votre mot de passe :</p>
                <div style="text-align: center;">
                    <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
                </div>
                <p>Ou copiez-collez ce lien dans votre navigateur :</p>
                <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">
                    ${resetUrl}
                </p>
                <p><strong>Ce lien expirera dans 1 heure.</strong></p>
                <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
                <div class="footer">
                    <p>Cordialement,<br>L'équipe de l'Épicerie Solidaire</p>
                </div>
            </div>
        </body>
        </html>
    `
};

console.log('Test exact de forgotPassword...');

transporter.sendMail(mailOptions, function(error, info) {
    if (error) {
        console.log('ERREUR DÉTAILLÉE:', error);
        console.log('Code:', error.code);
        console.log('Message:', error.message);
    } else {
        console.log('SUCCÈS - forgotPassword fonctionne!');
        console.log('Message ID:', info.messageId);
        console.log('Réponse:', info.response);
    }
});
