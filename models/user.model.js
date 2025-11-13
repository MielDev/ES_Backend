const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    nom: { type: DataTypes.STRING, allowNull: false },
    prenom: { type: DataTypes.STRING, allowNull: false },
    email: { 
        type: DataTypes.STRING, 
        allowNull: false, 
        unique: true,
        // Ajout d'un index personnalisé avec un nom spécifique
        indexes: [{
            unique: true,
            name: 'unique_email',
            fields: ['email']
        }]
    },
    password: { type: DataTypes.STRING, allowNull: false },
    telephone: { 
        type: DataTypes.STRING, 
        allowNull: true,
        // Désactive l'index automatique
        index: false
    },
    ecole_universite: { 
        type: DataTypes.STRING, 
        allowNull: true,
        index: false
    },
    specialite: { 
        type: DataTypes.STRING, 
        allowNull: true,
        index: false
    },
    justificatif_path: { 
        type: DataTypes.STRING, 
        allowNull: true,
        index: false
    },
    justificatif_status: {
        type: DataTypes.ENUM('en_attente', 'validé', 'refusé'),
        defaultValue: 'en_attente',
        index: false
    },
    justificatif_commentaire: { 
        type: DataTypes.STRING, 
        allowNull: true,
        index: false
    },
    role: { 
        type: DataTypes.ENUM('utilisateur', 'admin'), 
        defaultValue: 'utilisateur',
        index: true // Gardons un index sur le rôle pour les requêtes de filtrage
    },
    isDeleted: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false,
        index: true // Utile pour les requêtes de suppression logique
    },
    isActive: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: true,
        index: true // Utile pour les requêtes de filtrage
    },
    passages_utilises: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0,
        index: false
    },
    passages_max_autorises: { 
        type: DataTypes.INTEGER, 
        defaultValue: 2,
        index: false
    },
    date_derniere_validation: { 
        type: DataTypes.DATE, 
        allowNull: true,
        index: false
    },
    date_inscription: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        index: true // Utile pour le tri par date d'inscription
    }
}, { 
    timestamps: true,
    // Désactive la création automatique des index pour les clés étrangères
    indexes: [],
    // Désactive les timestamps automatiques si vous ne les utilisez pas
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

module.exports = User;
