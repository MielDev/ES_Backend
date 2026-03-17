const { User, Slot, IntervalSlot, Appointment } = require('../models');
const nodemailer = require('nodemailer');

// Configuration du transporteur email
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

exports.bookAppointment = async (req, res) => {
    try {
        const userId = req.user.id;
        const { intervalSlotId, note } = req.body;

        // Vérifier que l'utilisateur est actif
        const user = await User.findByPk(userId);
        if (!user || !user.isActive) {
            return res.status(403).json({ message: 'Votre compte est désactivé veillez contacter un administrateur' });
        }

        const intervalSlot = await IntervalSlot.findByPk(intervalSlotId, {
            include: [{ model: Slot, attributes: ['date', 'heure_debut', 'heure_fin'] }]
        });

        if (!intervalSlot || !intervalSlot.isActive) {
            return res.status(404).json({ message: 'Créneau indisponible' });
        }

        if (intervalSlot.places_restantes <= 0) {
            return res.status(400).json({ message: 'Plus de places' });
        }

        // Vérifier si l'utilisateur a déjà un RDV dans la même semaine
        const userAppointments = await Appointment.findAll({
            where: { userId, status: 'confirmé' },
            include: [{
                model: IntervalSlot,
                include: [Slot],
                required: true, // Ne retourne que les rendez-vous avec un IntervalSlot valide
                attributes: ['date']
            }]
        });

        // Calculer le début et la fin de la semaine du slot
        const slotDate = new Date(intervalSlot.date);
        const startOfWeek = new Date(slotDate);
        startOfWeek.setDate(slotDate.getDate() - slotDate.getDay() + 1); // Lundi
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Dimanche
        endOfWeek.setHours(23, 59, 59, 999);

        // Vérifier si l'utilisateur a déjà un RDV confirmé dans cette semaine
        const hasConfirmedAppointmentThisWeek = userAppointments.some(appt => {
            if (!appt.intervalSlot || !appt.intervalSlot.date) return false;
            const apptDate = new Date(appt.intervalSlot.date);
            return apptDate >= startOfWeek && apptDate <= endOfWeek;
        });

        if (hasConfirmedAppointmentThisWeek) {
            return res.status(400).json({
                message: 'Vous ne pouvez prendre qu\'un seul rendez-vous par semaine',
                semaine: `${startOfWeek.toISOString().split('T')[0]} au ${endOfWeek.toISOString().split('T')[0]}`
            });
        }

        // Vérifier si l'utilisateur a déjà un RDV sur ce créneau
        const existingAppointment = await Appointment.findOne({
            where: {
                userId,
                intervalSlotId,
                status: 'confirmé'
            }
        });

        if (existingAppointment && existingAppointment.status === 'confirmé') {
            return res.status(400).json({ message: 'Vous avez déjà un rendez-vous confirmé sur ce créneau' });
        }

        // Si l'utilisateur a annulé ce créneau, permettre de le reprendre
        if (existingAppointment && existingAppointment.status === 'annulé') {
            if (intervalSlot.places_restantes <= 0) {
                return res.status(400).json({ message: 'Ce créneau n\'est plus disponible' });
            }

            const allConfirmedAppointments = await Appointment.findAll({
                where: { userId, status: 'confirmé' },
                include: [{ model: IntervalSlot, include: [Slot] }]
            });

            const hasAnyConfirmedAppointmentThisWeek = allConfirmedAppointments.some(appt => {
                const apptDate = new Date(appt.intervalSlot.date);
                return apptDate >= startOfWeek && apptDate <= endOfWeek;
            });

            if (hasAnyConfirmedAppointmentThisWeek) {
                return res.status(400).json({
                    message: 'Vous avez déjà un rendez-vous confirmé cette semaine. Un seul rendez-vous par semaine autorisé.',
                    semaine: `${startOfWeek.toISOString().split('T')[0]} au ${endOfWeek.toISOString().split('T')[0]}`
                });
            }

            existingAppointment.status = 'confirmé';
            existingAppointment.note = note || existingAppointment.note;
            existingAppointment.date_rdv = intervalSlot.date;
            existingAppointment.heure_debut = intervalSlot.heure_debut;
            existingAppointment.heure_fin = intervalSlot.heure_fin;
            await existingAppointment.save();

            await intervalSlot.decrement('places_restantes');

            return res.json({
                message: 'Rendez-vous repris avec succès',
                appt: existingAppointment
            });
        }

        // Vérifier si l'utilisateur a effectué un paiement
        const hasPaid = user.paiement === true;

        // Si l'utilisateur n'a pas payé et a atteint sa limite de passages, on refuse
        if (!hasPaid && user.passages_utilises >= user.passages_max_autorises) {
            return res.status(400).json({
                message: `Vous avez atteint votre limite de ${user.passages_max_autorises} passages. Veuillez effectuer un paiement pour continuer.`
            });
        }

        // Décrémenter le nombre de passages restants
        await user.increment('passages_utilises');

        // Créer un nouveau rendez-vous avec les horaires
        const appointment = await Appointment.create({
            userId,
            intervalSlotId,
            date_rdv: intervalSlot.date,
            heure_debut: intervalSlot.heure_debut,
            heure_fin: intervalSlot.heure_fin,
            note,
            status: 'confirmé'
        });

        await intervalSlot.update({ places_restantes: intervalSlot.places_restantes - 1 });

        // Envoyer un email de confirmation du rendez-vous
        try {
            await transporter.sendMail({
                from: process.env.SMTP_FROM,
                to: user.email,
                subject: 'Confirmation de votre rendez-vous - Épicerie Solidaire',
                text: `Bonjour ${user.prenom} ${user.nom},\n\nVotre rendez-vous a été confirmé avec succès.\n\nDate : ${new Date(intervalSlot.date).toLocaleDateString('fr-FR')}\nHeure : ${intervalSlot.heure_debut}\nLieu : Épicerie Solidaire\n\nMerci de votre ponctualité.\n\nCordialement,\nL'équipe de l'Épicerie Solidaire`,
                html: `
                    <!DOCTYPE html>
                    <html lang="fr">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Confirmation de rendez-vous</title>
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
                            .confirmation-box {
                                background: linear-gradient(135deg, #4E9667, #5C77B9);
                                color: white;
                                padding: 20px;
                                border-radius: 8px;
                                text-align: center;
                                margin: 20px 0;
                            }
                            .appointment-info {
                                background: #f0f8f0;
                                border-left: 4px solid #4E9667;
                                padding: 15px;
                                margin: 20px 0;
                                border-radius: 5px;
                            }
                            .info-item {
                                margin: 10px 0;
                                padding: 10px;
                                background: #f8f9fa;
                                border-radius: 5px;
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
                            <h1><i class="icon-check"></i> Confirmation de votre rendez-vous</h1>
                            
                            <div class="confirmation-box">
                                <h2>Bonjour ${user.prenom} ${user.nom} !</h2>
                                <p>Votre rendez-vous a été confirmé avec succès</p>
                            </div>
                            
                            <div class="appointment-info">
                                <h3><i class="icon-list"></i> Détails de votre rendez-vous :</h3>
                                <div class="info-item">
                                    <i class="icon-calendar"></i>
                                    <strong>Date :</strong> ${new Date(intervalSlot.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </div>
                                <div class="info-item">
                                    <i class="icon-clock"></i>
                                    <strong>Heure :</strong> ${intervalSlot.heure_debut}
                                </div>
                                <div class="info-item">
                                    <i class="icon-location"></i>
                                    <strong>Lieu :</strong> Épicerie Solidaire<br>
                                    <small>16 Boulevard Charles Nicolle<br>72000 Le Mans</small>
                                </div>
                                ${note ? `<div class="info-item"><i class="icon-note"></i><strong>Note :</strong> ${note}</div>` : ''}
                            </div>
                            
                            <p><strong>Informations importantes :</strong></p>
                            <ul>
                                <li><i class="icon-time"></i> Merci d'arriver 5 minutes avant l'heure de votre rendez-vous</li>
                                <li><i class="icon-cancel"></i> Pensez à annuler à l'avance si vous ne pouvez pas venir</li>
                                <li><i class="icon-week"></i> Un seul rendez-vous par semaine est autorisé</li>
                            </ul>
                            
                            <p>Nous vous remercions de votre confiance et nous attendons avec plaisir !</p>
                            
                            <div class="footer">
                                <p>Cordialement,<br>L'équipe de l'Épicerie Solidaire</p>
                                <p><small>Pour toute question, contactez-nous à l'adresse indiquée sur notre site.</small></p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            });
            console.log('Email de confirmation envoyé à:', user.email);
        } catch (emailError) {
            console.error('Erreur lors de l\'envoi de l\'email de confirmation:', emailError);
            // Ne pas bloquer la réservation si l'email échoue
        }

        res.status(201).json(appointment);
    } catch (err) {
        console.error('Erreur lors de la réservation:', {
            error: err,
            message: err.message,
            stack: err.stack,
            userId: req.user?.id,
            intervalSlotId: req.body.intervalSlotId,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({ 
            message: 'Erreur lors de la réservation',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

exports.getUserAppointments = async (req, res) => {
    const userId = req.user.id;
    const appointments = await Appointment.findAll({
        where: { userId },
        include: [{ model: IntervalSlot, include: [Slot] }],
        order: [['createdAt', 'DESC']]
    });
    res.json(appointments);
};

exports.cancelAppointment = async (req, res) => {
    try {
        const id = req.params.id;
        const appt = await Appointment.findByPk(id, { include: [IntervalSlot] });

        if (!appt) return res.status(404).json({ message: 'Rendez-vous non trouvé' });

        // Autorisation : seul propriétaire ou admin peut annuler
        if (req.user.role !== 'admin' && req.user.id !== appt.userId) return res.status(403).json({ message: 'Accès refusé' });

        // Vérifier d'abord si le rendez-vous était confirmé avant de le marquer comme annulé
        const wasConfirmed = appt.status === 'confirmé';

        // Mettre à jour le statut
        appt.status = 'annulé';
        await appt.save();

        // Incrémenter le nombre de passages restants si le rendez-vous était confirmé
        if (wasConfirmed) {
            const user = await User.findByPk(appt.userId);
            if (user) {
                await user.decrement('passages_utilises');
                if (user.passages_utilises < 0) {
                    await user.update({ passages_utilises: 0 });
                }
            }
        }

        if (appt.intervalSlot) {
            console.log('Places avant annulation:', appt.intervalSlot.places_restantes);
            await appt.intervalSlot.update({ places_restantes: appt.intervalSlot.places_restantes + 1 });
            console.log('Places après annulation:', appt.intervalSlot.places_restantes + 1);
        } else {
            console.log('Aucun intervalSlot trouvé pour le rendez-vous');
            // Solution alternative: mise à jour directe
            await IntervalSlot.update(
                { places_restantes: require('sequelize').literal('places_restantes + 1') },
                { where: { id: appt.intervalSlotId } }
            );
            console.log('Mise à jour directe effectuée pour intervalSlotId:', appt.intervalSlotId);
        }

        res.json({ message: 'Annulé', appt });
    } catch (err) {
        res.status(500).json({ message: 'Erreur annulation' });
    }
};

exports.getAllAppointments = async (req, res) => {
    const appointments = await Appointment.findAll({
        include: [User, { model: IntervalSlot, include: [Slot] }],
        order: [[{ model: IntervalSlot, as: 'IntervalSlot', include: [Slot] }, Slot, 'date', 'DESC']]
    });
    res.json(appointments);
};

// Récupérer les rendez-vous manqués
exports.getMissedAppointments = async (req, res) => {
    try {
        const { Op } = require('sequelize');

        const appointments = await Appointment.findAll({
            where: {
                status: 'manqué'
            },
            include: [
                {
                    model: User,
                    attributes: { exclude: ['password'] }
                },
                {
                    model: IntervalSlot,
                    include: [Slot],
                    where: {
                        date: {
                            [Op.gte]: new Date(new Date().setDate(new Date().getDate() - 30)) // 30 derniers jours
                        }
                    },
                    required: true
                }
            ],
            order: [
                [
                    { model: IntervalSlot, as: 'IntervalSlot', include: [Slot] },
                    Slot,
                    'date',
                    'DESC'
                ],
                [
                    { model: IntervalSlot, as: 'IntervalSlot' },
                    'heure_debut',
                    'ASC'
                ]
            ]
        });

        res.json(appointments);
    } catch (error) {
        console.error('Erreur lors de la récupération des rendez-vous manqués:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des rendez-vous manqués' });
    }
};

// Récupérer les rendez-vous manqués de l'utilisateur connecté
exports.getMyMissedAppointments = async (req, res) => {
    try {
        const userId = req.user.id;
        const { Op } = require('sequelize');

        const appointments = await Appointment.findAll({
            where: {
                userId,
                status: 'manqué'
            },
            include: [
                {
                    model: IntervalSlot,
                    include: [Slot],
                    required: true
                }
            ],
            order: [
                [
                    { model: IntervalSlot, as: 'IntervalSlot', include: [Slot] },
                    Slot,
                    'date',
                    'DESC'
                ],
                [
                    { model: IntervalSlot, as: 'IntervalSlot' },
                    'heure_debut',
                    'ASC'
                ]
            ]
        });

        res.json(appointments);
    } catch (error) {
        console.error('Erreur lors de la récupération de vos rendez-vous manqués:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération de vos rendez-vous manqués' });
    }
};
