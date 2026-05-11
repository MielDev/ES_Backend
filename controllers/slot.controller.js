const { Op } = require('sequelize');
const { sequelize, Slot, IntervalSlot, Appointment } = require('../models');

const CANCELLED_APPOINTMENT_STATUSES = ['annule', 'annul\u00e9'];

const normalizeTime = (time) => {
    if (typeof time !== 'string') return null;

    const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
    if (!match) return null;

    return `${match[1]}:${match[2]}:${match[3] || '00'}`;
};

const timeToMinutes = (time) => {
    const normalizedTime = normalizeTime(time);
    if (!normalizedTime) return null;

    const [hours, minutes] = normalizedTime.split(':').map(Number);
    return hours * 60 + minutes;
};

const isValidDateOnly = (date) => {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().startsWith(date);
};

const activeAppointmentWhere = (intervalSlotId) => ({
    intervalSlotId,
    status: { [Op.notIn]: CANCELLED_APPOINTMENT_STATUSES }
});

// Créer un créneau principal manuellement
exports.createSlot = async (req, res) => {
    try {
        const { date, heure_debut, heure_fin, interval_minutes, capacite_par_interval } = req.body;
        const slot = await Slot.create({
            date,
            heure_debut,
            heure_fin,
            interval_minutes: interval_minutes || 15,
            capacite_par_interval: capacite_par_interval || 3
        });
        res.status(201).json(slot);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur création slot' });
    }
};

// Générer les créneaux détaillés depuis un slot principal
exports.generateIntervalSlots = async (req, res) => {
    try {
        const { slotId } = req.params;
        const slot = await Slot.findByPk(slotId);

        if (!slot) {
            return res.status(404).json({
                success: false,
                message: 'Créneau principal non trouvé',
                code: 'SLOT_NOT_FOUND'
            });
        }

        // Vérifier si des créneaux existent déjà pour ce slot
        const existingIntervals = await IntervalSlot.findOne({
            where: { slot_parent_id: slotId }
        });

        if (existingIntervals) {
            return res.status(400).json({
                success: false,
                message: 'Les créneaux ont déjà été générés pour ce créneau principal',
                code: 'SLOTS_ALREADY_GENERATED',
                existingSlotId: existingIntervals.id
            });
        }

        const intervalSlots = [];
        const [startHour, startMin] = slot.heure_debut.split(':').map(Number);
        const [endHour, endMin] = slot.heure_fin.split(':').map(Number);

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        // Générer et créer tous les intervalles
        for (let currentTime = startTime; currentTime < endTime; currentTime += slot.interval_minutes) {
            const heureDebut = Math.floor(currentTime / 60);
            const minuteDebut = currentTime % 60;

            const finTime = currentTime + slot.interval_minutes;
            const heureFin = Math.floor(finTime / 60);
            const minuteFin = finTime % 60;

            const heure_debut_interval = `${heureDebut.toString().padStart(2, '0')}:${minuteDebut.toString().padStart(2, '0')}:00`;
            const heure_fin_interval = `${heureFin.toString().padStart(2, '0')}:${minuteFin.toString().padStart(2, '0')}:00`;

            const intervalSlot = await IntervalSlot.create({
                date: slot.date,
                heure_debut: heure_debut_interval,
                heure_fin: heure_fin_interval,
                capacite_max: slot.capacite_par_interval,
                places_restantes: slot.capacite_par_interval,
                slot_parent_id: slot.id
            });

            intervalSlots.push(intervalSlot);
        }


        res.status(201).json({
            success: true,
            message: `${intervalSlots.length} créneaux ont été générés avec succès`,
            count: intervalSlots.length,
            slots: intervalSlots,
            slotParentId: slot.id
        });
    } catch (err) {
        console.error('Erreur lors de la génération des créneaux:', err);

        // Gestion spécifique des erreurs de validation
        if (err.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Erreur de validation des données',
                code: 'VALIDATION_ERROR',
                errors: err.errors.map(e => ({
                    field: e.path,
                    message: e.message
                }))
            });
        }

        // Erreur générique
        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de la génération des créneaux',
            code: 'INTERNAL_SERVER_ERROR',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

exports.getSlots = async (req, res) => {
    const slots = await Slot.findAll({ order: [['date', 'ASC'], ['heure_debut', 'ASC']] });
    res.json(slots);
};

// Lister les créneaux disponibles pour les étudiants
exports.getIntervalSlots = async (req, res) => {
    try {
        const { date, includeInactive } = req.query;
        const canSeeInactive = includeInactive === 'true' && ['admin', 'administrateur'].includes(req.user?.role);
        const whereClause = canSeeInactive ? {} : { isActive: true };

        if (date) {
            whereClause.date = date;
        }

        const intervalSlots = await IntervalSlot.findAll({
            where: whereClause,
            include: [{ model: Slot, attributes: ['date', 'heure_debut', 'heure_fin'] }],
            order: [['date', 'ASC'], ['heure_debut', 'ASC']]
        });

        res.json(intervalSlots);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur récupération créneaux' });
    }
};

exports.updateIntervalSlot = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
        const intervalSlot = await IntervalSlot.findByPk(id, { transaction });

        if (!intervalSlot) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Intervalle non trouvé' });
        }

        const updates = {};
        const nextDate = req.body.date !== undefined ? req.body.date : intervalSlot.date;
        const nextStartTime = req.body.heure_debut !== undefined ? normalizeTime(req.body.heure_debut) : intervalSlot.heure_debut;
        const nextEndTime = req.body.heure_fin !== undefined ? normalizeTime(req.body.heure_fin) : intervalSlot.heure_fin;

        if (!isValidDateOnly(nextDate)) {
            await transaction.rollback();
            return res.status(400).json({ message: 'Date invalide. Format attendu: YYYY-MM-DD' });
        }

        if (!nextStartTime || !nextEndTime) {
            await transaction.rollback();
            return res.status(400).json({ message: 'Heure invalide. Format attendu: HH:mm ou HH:mm:ss' });
        }

        if (timeToMinutes(nextStartTime) >= timeToMinutes(nextEndTime)) {
            await transaction.rollback();
            return res.status(400).json({ message: 'L\'heure de fin doit être après l\'heure de début' });
        }

        if (req.body.date !== undefined) updates.date = nextDate;
        if (req.body.heure_debut !== undefined) updates.heure_debut = nextStartTime;
        if (req.body.heure_fin !== undefined) updates.heure_fin = nextEndTime;

        const reservedCount = await Appointment.count({
            where: activeAppointmentWhere(id),
            transaction
        });

        if (req.body.capacite_max !== undefined) {
            const capacity = Number(req.body.capacite_max);

            if (!Number.isInteger(capacity) || capacity < 1) {
                await transaction.rollback();
                return res.status(400).json({ message: 'La capacité doit être un nombre entier supérieur à 0' });
            }

            if (capacity < reservedCount) {
                await transaction.rollback();
                return res.status(400).json({
                    message: `La capacité ne peut pas être inférieure aux ${reservedCount} réservation(s) existante(s)`
                });
            }

            updates.capacite_max = capacity;
            updates.places_restantes = capacity - reservedCount;
        }

        if (req.body.isActive !== undefined) {
            if (typeof req.body.isActive === 'boolean') {
                updates.isActive = req.body.isActive;
            } else if (req.body.isActive === 'true' || req.body.isActive === 'false') {
                updates.isActive = req.body.isActive === 'true';
            } else {
                await transaction.rollback();
                return res.status(400).json({ message: 'Le statut doit être un booléen' });
            }
        }

        await intervalSlot.update(updates, { transaction });

        if (updates.date || updates.heure_debut || updates.heure_fin) {
            await Appointment.update(
                {
                    date_rdv: intervalSlot.date,
                    heure_debut: intervalSlot.heure_debut,
                    heure_fin: intervalSlot.heure_fin
                },
                {
                    where: activeAppointmentWhere(id),
                    transaction
                }
            );
        }

        const updatedInterval = await IntervalSlot.findByPk(id, {
            include: [{ model: Slot, attributes: ['date', 'heure_debut', 'heure_fin'] }],
            transaction
        });

        await transaction.commit();
        res.json(updatedInterval);
    } catch (err) {
        await transaction.rollback();
        console.error('Erreur update interval slot:', err);
        res.status(500).json({ message: 'Erreur update intervalle' });
    }
};

exports.deleteIntervalSlot = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
        const intervalSlot = await IntervalSlot.findByPk(id, { transaction });

        if (!intervalSlot) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Intervalle non trouvé' });
        }

        const appointmentsDeleted = await Appointment.destroy({
            where: { intervalSlotId: id },
            transaction
        });

        await intervalSlot.destroy({ transaction });
        await transaction.commit();

        res.json({
            message: 'Intervalle supprimé',
            appointmentsDeleted
        });
    } catch (err) {
        await transaction.rollback();
        console.error('Erreur suppression interval slot:', err);
        res.status(500).json({ message: 'Erreur suppression intervalle' });
    }
};

exports.updateSlot = async (req, res) => {
    try {
        const id = req.params.id;
        const slot = await Slot.findByPk(id);
        if (!slot) return res.status(404).json({ message: 'Slot non trouvé' });
        await slot.update(req.body);
        res.json(slot);
    } catch (err) {
        res.status(500).json({ message: 'Erreur update slot' });
    }
};

exports.deleteSlot = async (req, res) => {
    try {
        const id = req.params.id;
        const slot = await Slot.findByPk(id);
        if (!slot) return res.status(404).json({ message: 'Slot non trouvé' });

        // Supprimer d'abord les intervalles générés associés
        await IntervalSlot.destroy({ where: { slot_parent_id: id } });

        // Puis supprimer le slot principal
        await slot.destroy();
        res.json({ message: 'Supprimé avec ses intervalles associés' });
    } catch (err) {
        res.status(500).json({ message: 'Erreur suppression slot' });
    }
};
