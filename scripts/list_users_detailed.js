import { Surreal } from 'surrealdb';

async function main() {
  const db = new Surreal();
  try {
    await db.connect('ws://localhost:8000/rpc', {
      namespace: 'posr',
      database: 'posr',
      authentication: {
        username: 'root',
        password: 'root',
      }
    });
    const result = await db.query('SELECT * FROM user FETCH user_role');
    console.log("USERS:", JSON.stringify(result[0], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}

main();
