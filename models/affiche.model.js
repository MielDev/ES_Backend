const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Affiche = sequelize.define('Affiche', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    titre: { type: DataTypes.STRING, allowNull: false },
    contenu: { type: DataTypes.TEXT, allowNull: false },
    image_url: { type: DataTypes.STRING, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    date_debut: { type: DataTypes.DATEONLY, allowNull: true },
    date_fin: { type: DataTypes.DATEONLY, allowNull: true },
    priorite: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { timestamps: true });

module.exports = Affiche;
