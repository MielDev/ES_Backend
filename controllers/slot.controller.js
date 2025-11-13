const { Slot, AdminConfig } = require('../models');

exports.generateSlotsFromConfig = async (req, res) => {
    try {
        const configs = await AdminConfig.findAll({ where: { is_active: true } });
        if (configs.length === 0) {
            return res.status(400).json({ message: 'Aucune configuration active trouvée' });
        }

        const slotsCreated = [];
        const today = new Date();

        // Générer des slots pour les 4 prochaines semaines
        for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
            configs.forEach(async (config) => {
                const currentDate = new Date(today);
                currentDate.setDate(today.getDate() + (weekOffset * 7));

                // Trouver le jour de la semaine
                const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
                const currentDayName = dayNames[currentDate.getDay()];

                if (currentDayName === config.jour_semaine) {
                    // Créer des slots pour ce jour selon les heures configurées
                    const [startHour, startMin] = config.heure_debut.split(':').map(Number);
                    const [endHour, endMin] = config.heure_fin.split(':').map(Number);

                    for (let hour = startHour; hour < endHour; hour++) {
                        const slotDate = new Date(currentDate);
                        slotDate.setHours(hour, 0, 0, 0);

                        // Vérifier si le slot n'existe pas déjà
                        const existingSlot = await Slot.findOne({
                            where: {
                                date: slotDate.toISOString().split('T')[0],
                                heure: `${hour.toString().padStart(2, '0')}:00:00`
                            }
                        });

                        if (!existingSlot) {
                            const slot = await Slot.create({
                                date: slotDate.toISOString().split('T')[0],
                                heure: `${hour.toString().padStart(2, '0')}:00:00`,
                                capacite_max: config.nombre_passages_max,
                                places_restantes: config.nombre_passages_max
                            });
                            slotsCreated.push(slot);
                        }
                    }
                }
            });
        }

        res.json({
            message: `${slotsCreated.length} créneaux générés`,
            slots: slotsCreated
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur génération créneaux' });
    }
};

exports.createSlot = async (req, res) => {
    try {
        const { date, heure, capacite_max } = req.body;
        const slot = await Slot.create({ date, heure, capacite_max, places_restantes: capacite_max });
        res.status(201).json(slot);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur création slot' });
    }
};

exports.getSlots = async (req, res) => {
    const slots = await Slot.findAll({ order: [['date', 'ASC'], ['heure', 'ASC']] });
    res.json(slots);
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
        await slot.destroy();
        res.json({ message: 'Supprimé' });
    } catch (err) {
        res.status(500).json({ message: 'Erreur suppression slot' });
    }
};
