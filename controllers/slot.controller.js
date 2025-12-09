const { Slot, AdminConfig, IntervalSlot } = require('../models');

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
        const { date } = req.query;
        const whereClause = { isActive: true };

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
