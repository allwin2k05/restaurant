import { Surreal } from 'surrealdb';

export const db = new Surreal();

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;
  try {
    await db.connect('wss://restaurant-zzmp.onrender.com/rpc', {
      namespace: 'posr',
      database: 'posr',
      authentication: {
        username: 'root',
        password: 'root',
      },
    });
    isConnected = true;
    console.log('Connected to live SurrealDB via WebSockets from React Native!');
  } catch (err) {
    console.error('Failed to connect to SurrealDB:', err);
  }
}
