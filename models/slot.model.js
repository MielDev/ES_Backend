const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Slot = sequelize.define('Slot', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },      // ex: 2024-06-10
    heure: { type: DataTypes.TIME, allowNull: false },         // ex: 08:00:00
    capacite_max: { type: DataTypes.INTEGER, defaultValue: 10 },
    places_restantes: { type: DataTypes.INTEGER, defaultValue: 10 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { timestamps: true });

module.exports = Slot;
