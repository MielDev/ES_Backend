const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user.model');

const MailHistory = sequelize.define('MailHistory', {
    id: { 
        type: DataTypes.INTEGER, 
        autoIncrement: true, 
        primaryKey: true 
    },
    subject: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    content: { 
        type: DataTypes.TEXT, 
        allowNull: false 
    },
    recipients: { 
        type: DataTypes.ENUM('all', 'admins', 'users'), 
        allowNull: false 
    },
    sentCount: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0 
    },
    failedCount: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0 
    },
    totalCount: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0 
    },
    status: { 
        type: DataTypes.ENUM('pending', 'sent', 'failed', 'partial'), 
        defaultValue: 'pending' 
    },
    sentBy: { 
        type: DataTypes.INTEGER, 
        allowNull: true,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    sentAt: { 
        type: DataTypes.DATE, 
        allowNull: true 
    },
    completedAt: { 
        type: DataTypes.DATE, 
        allowNull: true 
    },
    errorMessage: { 
        type: DataTypes.TEXT, 
        allowNull: true 
    },
    metadata: { 
        type: DataTypes.JSON, 
        allowNull: true 
    }
}, {
    timestamps: true,
    tableName: 'MailHistories',
    indexes: [
        {
            fields: ['status']
        },
        {
            fields: ['sentAt']
        },
        {
            fields: ['sentBy']
        }
    ]
});

// Association avec le modèle User
MailHistory.belongsTo(User, {
    foreignKey: 'sentBy',
    as: 'sender'
});

module.exports = MailHistory;
