const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SystemSetting = sequelize.define('SystemSetting', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    key: { 
        type: DataTypes.STRING, 
        allowNull: false, 
        unique: true 
    },
    value: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, { 
    timestamps: true 
});

module.exports = SystemSetting;
