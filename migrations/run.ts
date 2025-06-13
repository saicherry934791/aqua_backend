import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '../src/models/schema';
import dotenv from 'dotenv';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { nanoid } from 'nanoid';
import { UserRole } from '../src/types';

// Load environment variables
dotenv.config();

const runMigration = async () => {
  try {
    console.log('Starting database migration...');
    
    // Check for required environment variables
    const dbUrl = process.env.TURSO_DB_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!dbUrl) {
      throw new Error('TURSO_DB_URL environment variable is not set');
    }

    // Create Turso DB client
    const client = createClient({
      url: dbUrl,
      authToken: authToken,
    });

    // Initialize Drizzle ORM
    const db = drizzle(client, { schema });

    // Run migrations
    console.log('Running migrations...');
    await migrate(db, { migrationsFolder: 'migrations/sql' });
    
    // Create admin user if doesn't exist
    console.log('Checking for admin user...');
    const adminExists = await db.query.users.findFirst({
      where: (user, { eq }) => eq(user.role, UserRole.ADMIN),
    });

    if (!adminExists) {
      console.log('Creating admin user...');
      await db.insert(schema.users).values({
        id: `user_${nanoid(10)}`,
        phone: '9999999999', // Default admin phone
        name: 'System Administrator',
        role: UserRole.ADMIN,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    console.log('Migration completed successfully!');
    
    // Close the database connection
    await client.close();
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigration();