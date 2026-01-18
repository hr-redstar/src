// Test script to debug loadDrivers/loadUsers
const store = require('./utils/ストレージ/ストア共通');

async function test() {
    const guildId = '1452724199557824514';

    console.log('Testing listKeys directly...');
    const keys = await store.listKeys(`GCS/${guildId}/送迎者`, { recursive: true });
    console.log('Keys found:', keys.length);
    console.log('Keys:', keys);

    console.log('\nTesting loadDrivers...');
    const drivers = await store.loadDrivers(guildId);
    console.log('Drivers found:', drivers.length);
    console.log('Driver data:', JSON.stringify(drivers, null, 2));

    console.log('\nTesting loadUsers...');
    const users = await store.loadUsers(guildId);
    console.log('Users found:', users.length);
    console.log('User data:', JSON.stringify(users, null, 2));
}

test().catch(console.error);
