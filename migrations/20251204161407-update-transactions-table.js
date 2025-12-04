'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Vérifier les colonnes existantes
    const tableDescription = await queryInterface.describeTable('transactions');
    
    // Ajouter la colonne 'reference' si elle n'existe pas
    if (!tableDescription.reference) {
      await queryInterface.addColumn('transactions', 'reference', {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        defaultValue: Sequelize.literal("concat('tx_', to_char(now(), 'YYYYMMDDHH24MISS'), '_', floor(random() * 1000)::int)")
      });
    }
    
    // Ajouter la colonne 'currency' si elle n'existe pas
    if (!tableDescription.currency) {
      // Ajouter la colonne 'currency' uniquement si elle n'existe pas
      await queryInterface.addColumn('transactions', 'currency', {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'EUR'
      });
    }

    // Modifier le type de 'description' pour le rendre nullable
    await queryInterface.changeColumn('transactions', 'description', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    // Modifier le type de 'paymentDetails' et 'metadata' pour utiliser TEXT au lieu de JSONB
    await queryInterface.changeColumn('transactions', 'paymentDetails', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: '{}'
    });

    await queryInterface.changeColumn('transactions', 'metadata', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: '{}'
    });

    // Mettre à jour l'enum 'status' pour inclure 'refunded'
    await queryInterface.sequelize.query(
      "ALTER TYPE enum_transactions_status ADD VALUE IF NOT EXISTS 'refunded' AFTER 'cancelled'"
    );

    // Mettre à jour l'enum 'paymentMethod' pour utiliser les nouvelles valeurs
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_transactions_paymentMethod') THEN
          ALTER TABLE "transactions" 
          ALTER COLUMN "paymentMethod" TYPE VARCHAR(255) 
          USING CASE 
            WHEN "paymentMethod" = 'sumup' THEN 'card'
            ELSE 'other'
          END;
          
          DROP TYPE "enum_transactions_paymentMethod";
        END IF;
      END
      $$;
    `);

    // Recréer l'enum avec les nouvelles valeurs
    await queryInterface.sequelize.query(
      "CREATE TYPE enum_transactions_paymentMethod AS ENUM ('card', 'cash', 'transfer', 'other')"
    );

    // Appliquer le nouvel enum
    await queryInterface.sequelize.query(`
      ALTER TABLE "transactions" 
      ALTER COLUMN "paymentMethod" TYPE enum_transactions_paymentMethod 
      USING "paymentMethod"::enum_transactions_paymentMethod
    `);

    // Changer le type de paymentDetails en JSONB
    await queryInterface.sequelize.query(`
      ALTER TABLE "transactions" 
      ALTER COLUMN "paymentDetails" TYPE JSONB 
      USING "paymentDetails"::jsonb
    `);

    // Ajouter la colonne 'metadata' si elle n'existe pas
    await queryInterface.addColumn('transactions', 'metadata', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {}
    });

    // Ajouter la colonne 'completedAt' si elle n'existe pas
    await queryInterface.addColumn('transactions', 'completedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Ajouter la colonne 'cancelledAt' si elle n'existe pas
    await queryInterface.addColumn('transactions', 'cancelledAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Ajouter la colonne 'refundedAt' si elle n'existe pas
    await queryInterface.addColumn('transactions', 'refundedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Ajouter la colonne 'ipAddress' si elle n'existe pas
    await queryInterface.addColumn('transactions', 'ipAddress', {
      type: Sequelize.STRING(45),
      allowNull: true
    });

    // Ajouter la colonne 'userAgent' si elle n'existe pas
    await queryInterface.addColumn('transactions', 'userAgent', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // Créer des index pour améliorer les performances
    await queryInterface.addIndex('transactions', ['reference'], {
      name: 'transactions_reference_idx',
      unique: true
    });

    await queryInterface.addIndex('transactions', ['userId'], {
      name: 'transactions_user_id_idx'
    });

    await queryInterface.addIndex('transactions', ['status'], {
      name: 'transactions_status_idx'
    });

    await queryInterface.addIndex('transactions', ['createdAt'], {
      name: 'transactions_created_at_idx'
    });

    await queryInterface.addIndex('transactions', ['userId', 'status'], {
      name: 'transactions_user_status_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    // Supprimer les index
    await queryInterface.removeIndex('transactions', 'transactions_reference_idx');
    await queryInterface.removeIndex('transactions', 'transactions_user_id_idx');
    await queryInterface.removeIndex('transactions', 'transactions_status_idx');
    await queryInterface.removeIndex('transactions', 'transactions_created_at_idx');
    await queryInterface.removeIndex('transactions', 'transactions_user_status_idx');

    // Supprimer les colonnes ajoutées
    const columnsToRemove = [
      'reference',
      'currency',
      'metadata',
      'completedAt',
      'cancelledAt',
      'refundedAt',
      'ipAddress',
      'userAgent'
    ];

    for (const column of columnsToRemove) {
      if (await queryInterface.describeTable('transactions').then(table => column in table)) {
        await queryInterface.removeColumn('transactions', column);
      }
    }

    // Remettre le type de description à NOT NULL
    await queryInterface.changeColumn('transactions', 'description', {
      type: Sequelize.STRING,
      allowNull: false
    });

    // Note: La rétrogradation de l'enum 'status' et 'paymentMethod' n'est pas triviale
    // et peut nécessiter une manipulation manuelle de la base de données
    console.warn('La rétrogradation des enums status et paymentMethod nécessite une intervention manuelle');
  }
};
