const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors'); // Import the CORS middleware
const app = express();

const mongoUrl = 'mongodb://localhost:27017'; // Base MongoDB connection URL

// Use CORS middleware to allow all origins (or configure it as needed)
app.use(cors()); // This allows all origins

// Connect to a specific database
async function connectToDB(dbName) {
    try {
        return mongoose.createConnection(`${mongoUrl}/${dbName}`, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    } catch (err) {
        console.error(`Error connecting to database ${dbName}:`, err);
        throw err;
    }
}

// List all databases
async function listAllDatabases() {
    const client = await mongoose.connect(mongoUrl, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    const admin = client.connection.db.admin();
    const databases = await admin.listDatabases();
    await client.disconnect(); // Disconnect after fetching databases
    return databases.databases.map(db => db.name).filter(name => !['admin', 'local', 'config'].includes(name));
}

// API to search for a report by caseNumber across all databases
app.get('/find-report/:caseNumber', async (req, res) => {
    const { caseNumber } = req.params;

    if (!caseNumber) {
        return res.status(400).json({ error: 'Case number is required' });
    }

    try {
        const dbList = await listAllDatabases(); // Get the list of databases
        console.log(`Databases found: ${dbList.join(', ')}`);

        for (const dbName of dbList) {
            const dbConnection = await connectToDB(dbName);

            try {
                const Report = dbConnection.model('Report', new mongoose.Schema({
                    caseNumber: String,
                    remark: String,
                    deviceName: String,
                    sms: Object,
                    calls: Object,
                    contacts: Object,
                    createdAt: Date,
                }));

                // Search for the case number in the current database
                const report = await Report.findOne({ caseNumber }).exec();
                if (report) {
                    console.log(`Case number ${caseNumber} found in database: ${dbName}`);
                    dbConnection.close(); // Close the connection
                    return res.json({
                        database: dbName,
                        report,
                    });
                }
            } catch (err) {
                console.error(`Error querying database ${dbName}:`, err);
            } finally {
                dbConnection.close(); // Ensure connection is closed
            }
        }

        // If no report is found in any database
        return res.status(404).json({ error: 'Report not found' });
    } catch (err) {
        console.error('Error searching for report:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
