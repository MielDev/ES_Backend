const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Slot = sequelize.define('Slot', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },      // ex: 2024-06-10
    heure_debut: { type: DataTypes.TIME, allowNull: false },    // ex: 08:00:00
    heure_fin: { type: DataTypes.TIME, allowNull: false },      // ex: 12:00:00
    interval_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 15 }, // ex: 15
    capacite_par_interval: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 }, // ex: 3 personnes
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { timestamps: true });

module.exports = Slot;
