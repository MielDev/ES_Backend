const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const IntervalSlot = sequelize.define('IntervalSlot', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },      // ex: 2024-06-10
    heure_debut: { type: DataTypes.TIME, allowNull: false },    // ex: 08:00:00
    heure_fin: { type: DataTypes.TIME, allowNull: false },      // ex: 08:15:00
    capacite_max: { type: DataTypes.INTEGER, allowNull: false }, // ex: 3 personnes
    places_restantes: { type: DataTypes.INTEGER, allowNull: false }, // ex: 3 places
    slot_parent_id: { type: DataTypes.INTEGER, allowNull: false }, // référence au slot principal
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { timestamps: true });

module.exports = IntervalSlot;
