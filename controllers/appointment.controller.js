const { User, Slot, IntervalSlot, Appointment } = require('../models');

exports.bookAppointment = async (req, res) => {
    try {
        const userId = req.user.id;
        const { intervalSlotId, note } = req.body;

        // Vérifier que l'utilisateur est actif
        const user = await User.findByPk(userId);
        if (!user || !user.isActive) {
            return res.status(403).json({ message: 'Votre compte est désactivé' });
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
            include: [{ model: IntervalSlot, include: [Slot] }]
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

        // Vérifier la limite de passages de l'utilisateur
        if (user.passages_utilises >= user.passages_max_autorises) {
            return res.status(400).json({
                message: `Vous avez atteint votre limite de ${user.passages_max_autorises} passages`
            });
        }

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

        res.status(201).json(appointment);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur réservation' });
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

        appt.status = 'annulé';
        await appt.save();

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
    // admin
    const appts = await Appointment.findAll({
        include: [User, { model: IntervalSlot, include: [Slot] }],
        order: [['createdAt', 'DESC']]
    });
    res.json(appts);
};
