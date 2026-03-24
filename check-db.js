const { Sequelize } = require('sequelize');
require('dotenv').config();

async function testConnection() {
    console.log('--- Testing database connection ---');
    console.log('DB_NAME:', process.env.DB_NAME);
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_PORT:', process.env.DB_PORT);

    const sequelize = new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASS,
        {
            host: process.env.DB_HOST,
            dialect: 'mysql',
            port: process.env.DB_PORT || 3306,
            logging: false,
        }
    );

    try {
        await sequelize.authenticate();
        console.log('✅ Connection has been established successfully.');
    } catch (error) {
        console.error('❌ Unable to connect to the database:', error.message);
        
        console.log('\n--- Attempting with root user (no password) ---');
        const rootSequelize = new Sequelize(
            process.env.DB_NAME,
            'root',
            '',
            {
                host: process.env.DB_HOST,
                dialect: 'mysql',
                port: process.env.DB_PORT || 3306,
                logging: false,
            }
        );
        try {
            await rootSequelize.authenticate();
            console.log('✅ Connection with root (no password) worked!');
            console.log('💡 You should probably update your .env to use DB_USER=root and empty DB_PASS.');
        } catch (rootError) {
            console.error('❌ Connection with root (no password) also failed:', rootError.message);
        }
    }
}

testConnection();
