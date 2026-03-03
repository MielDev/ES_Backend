'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('Affiches', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            titre: {
                type: Sequelize.STRING,
                allowNull: false
            },
            contenu: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            image_url: {
                type: Sequelize.STRING,
                allowNull: true
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            date_debut: {
                type: Sequelize.DATEONLY,
                allowNull: true
            },
            date_fin: {
                type: Sequelize.DATEONLY,
                allowNull: true
            },
            priorite: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('Affiches');
    }
};
