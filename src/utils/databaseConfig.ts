// Construct DATABASE_URL for Cloud SQL socket connections
export function constructDatabaseUrl(): string { // Added export
  // Check if we're in Cloud Run (has socket path in PGHOST)
  const pgHost = process.env.PGHOST;
  const pgUser = process.env.PGUSER;
  const password = process.env.PGPASSWORD; // Raw password from environment
  const pgDatabase = process.env.PGDATABASE;

  console.log('DEBUG: Environment variables for DB connection (in constructDatabaseUrl):');
  console.log(`DEBUG: PGUSER: ${pgUser}`);
  // --- BEGIN ADDITION (Password Debugging) ---
  console.log(`DEBUG: Raw PGPASSWORD length: ${password ? password.length : 'undefined'}`);
  console.log(`DEBUG: First 3 chars of raw password: ${password ? password.substring(0, 3) + '...' : 'undefined'}`);
  // --- END ADDITION (Password Debugging) ---
  console.log(`DEBUG: PGHOST: ${pgHost}`);
  console.log(`DEBUG: PGDATABASE: ${pgDatabase}`);
  
  if (pgHost && pgHost.startsWith('/cloudsql/')) {
    // Cloud SQL socket connection
    const user = pgUser || 'postgres';
    const database = pgDatabase || 'airora_staging_db';
    
    // --- BEGIN MODIFICATION (URL Encode Password) ---
    const encodedPassword = password ? encodeURIComponent(password) : ''; 
    // --- END MODIFICATION (URL Encode Password) ---
    
    // For Cloud SQL, use this specific format without 'localhost' and with 'sslmode=disable'
    // Using encodedPassword now
    const databaseUrl = `postgresql://${user}:${encodedPassword}@localhost/${database}?host=${pgHost}&sslmode=disable`; // Added localhost placeholder
    
    console.log('Constructed DATABASE_URL for Cloud SQL socket connection (with URL-encoded password, with localhost placeholder, with sslmode=disable)');
    // Masking for display purposes
    const maskedDisplayUrl = `postgresql://${user}:***MASKED_ENCODED***/${database}?host=${pgHost}&sslmode=disable`;
    console.log(`Constructed URL (display masked): ${maskedDisplayUrl}`);
    
    return databaseUrl; // Return URL with encoded password
  }
  
  // Fall back to existing DATABASE_URL if not Cloud SQL
  const standardUrl = process.env.DATABASE_URL || '';
  // If using standardUrl, and it contains a password, that might also need encoding if not already.
  console.log(`Using standard DATABASE_URL configuration: ${standardUrl ? 'Found' : 'Not Found/Empty'}`);
  return standardUrl;
}

// Removed the immediate call to constructDatabaseUrl and setting of process.env.DATABASE_URL here
// This will now be handled by prismaClient.ts
