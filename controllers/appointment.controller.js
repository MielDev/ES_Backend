const { Appointment, Slot, User } = require('../models');

exports.bookAppointment = async (req, res) => {
    try {
        const userId = req.user.id;
        const { slotId, note } = req.body;

        // Vérifier que l'utilisateur est actif
        const user = await User.findByPk(userId);
        if (!user || !user.isActive) {
            return res.status(403).json({ message: 'Votre compte est désactivé' });
        }

        const slot = await Slot.findByPk(slotId);
        if (!slot || !slot.isActive) return res.status(404).json({ message: 'Créneau indisponible' });
        if (slot.places_restantes <= 0) return res.status(400).json({ message: 'Plus de places' });

        // Vérifier si l'utilisateur a déjà un RDV dans la même semaine
        const userAppointments = await Appointment.findAll({
            where: { userId, status: 'confirmé' },
            include: [Slot]
        });

        // Calculer le début et la fin de la semaine du slot
        const slotDate = new Date(slot.date);
        const startOfWeek = new Date(slotDate);
        startOfWeek.setDate(slotDate.getDate() - slotDate.getDay() + 1); // Lundi
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Dimanche
        endOfWeek.setHours(23, 59, 59, 999);

        // Vérifier si l'utilisateur a déjà un RDV confirmé dans cette semaine
        const hasConfirmedAppointmentThisWeek = userAppointments.some(appt => {
            const apptDate = new Date(appt.slot.date);
            return apptDate >= startOfWeek && apptDate <= endOfWeek;
        });

        if (hasConfirmedAppointmentThisWeek) {
            return res.status(400).json({
                message: 'Vous ne pouvez prendre qu\'un seul rendez-vous par semaine',
                semaine: `${startOfWeek.toISOString().split('T')[0]} au ${endOfWeek.toISOString().split('T')[0]}`
            });
        }

        // Vérifier si l'utilisateur a déjà un RDV sur ce slot
        const existingAppointment = await Appointment.findOne({ where: { userId, slotId } });
        if (existingAppointment && existingAppointment.status === 'confirmé') {
            return res.status(400).json({ message: 'Vous avez déjà un rendez-vous confirmé sur ce créneau' });
        }

        // Si l'utilisateur a annulé ce créneau, permettre de le reprendre (exception à la règle)
        if (existingAppointment && existingAppointment.status === 'annulé') {
            // Vérifier que la place est toujours disponible (pas prise par quelqu'un d'autre)
            if (slot.places_restantes <= 0) {
                return res.status(400).json({ message: 'Ce créneau n\'est plus disponible' });
            }

            // Vérifier si l'utilisateur a déjà un RDV confirmé dans cette semaine (même en reprenant un annulé)
            const allConfirmedAppointments = await Appointment.findAll({
                where: { userId, status: 'confirmé' },
                include: [Slot]
            });

            const hasAnyConfirmedAppointmentThisWeek = allConfirmedAppointments.some(appt => {
                const apptDate = new Date(appt.slot.date);
                return apptDate >= startOfWeek && apptDate <= endOfWeek;
            });

            if (hasAnyConfirmedAppointmentThisWeek) {
                return res.status(400).json({
                    message: 'Vous avez déjà un rendez-vous confirmé cette semaine. Un seul rendez-vous par semaine autorisé.',
                    semaine: `${startOfWeek.toISOString().split('T')[0]} au ${endOfWeek.toISOString().split('T')[0]}`
                });
            }

            // Reprendre le rendez-vous existant
            existingAppointment.status = 'confirmé';
            existingAppointment.note = note || existingAppointment.note;
            await existingAppointment.save();

            // Remettre la place à occupée
            await slot.update({ places_restantes: slot.places_restantes - 1 });

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

        const appt = await Appointment.create({ userId, slotId });
        await slot.update({ places_restantes: slot.places_restantes - 1 });
        res.status(201).json(appt);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur réservation' });
    }
};

exports.getUserAppointments = async (req, res) => {
    const userId = req.user.id;
    const appointments = await Appointment.findAll({ where: { userId }, include: [Slot], order: [['createdAt', 'DESC']] });
    res.json(appointments);
};

exports.cancelAppointment = async (req, res) => {
    try {
        const id = req.params.id;
        const appt = await Appointment.findByPk(id);
        if (!appt) return res.status(404).json({ message: 'Rendez-vous non trouvé' });

        // Autorisation : seul propriétaire ou admin peut annuler
        if (req.user.role !== 'admin' && req.user.id !== appt.userId) return res.status(403).json({ message: 'Accès refusé' });

        appt.status = 'annulé';
        await appt.save();

        const slot = await Slot.findByPk(appt.slotId);
        if (slot) await slot.update({ places_restantes: slot.places_restantes + 1 });

        res.json({ message: 'Annulé', appt });
    } catch (err) {
        res.status(500).json({ message: 'Erreur annulation' });
    }
};

exports.getAllAppointments = async (req, res) => {
    // admin
    const appts = await Appointment.findAll({ include: [User, Slot], order: [['createdAt', 'DESC']] });
    res.json(appts);
};
