import dotenv from 'dotenv';
import path from 'path';

// Load environment variables before any test modules are imported
dotenv.config({ path: path.resolve(__dirname, '.env.development') });
