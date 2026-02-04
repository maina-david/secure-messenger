const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Get user data path (same as Electron app.getPath('userData'))
const userDataPath = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'secure-messenger-desktop'
);

const dbPath = path.join(userDataPath, 'messenger.db');

console.log('Database path:', dbPath);
console.log('Clearing and reseeding database...');

try {
  const db = new Database(dbPath);

  // Get list of all tables
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all();

  console.log('Found tables:', tables.map(t => t.name).join(', '));

  // Delete all data from each table
  for (const table of tables) {
    try {
      if (table.name !== 'messages_fts') {
        db.prepare(`DELETE FROM ${table.name}`).run();
        console.log(`Cleared table: ${table.name}`);
      }
    } catch (error) {
      console.warn(`Could not clear table ${table.name}:`, error.message);
    }
  }

  // Clear FTS table
  try {
    db.prepare(`DELETE FROM messages_fts`).run();
    console.log('Cleared FTS table');
  } catch (error) {
    console.warn('Could not clear FTS table:', error.message);
  }

  db.close();
  console.log('\nDatabase cleared successfully!');
  console.log('The app will reseed the database on next launch.');

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
