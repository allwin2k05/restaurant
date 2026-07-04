class LightSurreal {
  private ws: WebSocket | null = null;
  private url = 'wss://restaurant-zzmp.onrender.com/rpc';
  private resolvers = new Map<string, (value: any) => void>();
  private rejecters = new Map<string, (err: any) => void>();
  private messageId = 0;
  private connectPromise: Promise<void> | null = null;

  async connect(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve, reject) => {
      console.log('Connecting to SurrealDB...');
      try {
        this.ws = new WebSocket(this.url);
      } catch (e) {
        console.error('Failed to create WebSocket:', e);
        this.connectPromise = null;
        return reject(e);
      }

      this.ws.onopen = async () => {
        try {
          // Use namespace & db
          await this.send('use', ['posr', 'posr']);
          // Sign in
          await this.send('signin', [{ user: 'root', pass: 'root' }]);
          console.log('SurrealDB client connected & authenticated!');
          resolve();
        } catch (e) {
          this.connectPromise = null;
          reject(e);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const id = data.id;
          if (id) {
            if (data.error) {
              const rejecter = this.rejecters.get(id);
              if (rejecter) rejecter(new Error(data.error.message));
            } else {
              const resolver = this.resolvers.get(id);
              if (resolver) resolver(data.result);
            }
            this.resolvers.delete(id);
            this.rejecters.delete(id);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onerror = (e) => {
        console.error('WebSocket error:', e);
        this.connectPromise = null;
        reject(e);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed.');
        this.connectPromise = null;
      };
    });

    return this.connectPromise;
  }

  private send(method: string, params: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) { // 1 = WebSocket.OPEN
        return reject(new Error('WebSocket is not open'));
      }
      const id = String(++this.messageId);
      this.resolvers.set(id, resolve);
      this.rejecters.set(id, reject);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async query<T = any>(surrealql: string, vars: any = {}): Promise<T> {
    await this.connect();
    const res = await this.send('query', [surrealql, vars]);
    // SurrealDB returns query results as an array: [{ status: "OK", result: [...] }]
    if (res && res[0]) {
      if (res[0].status === 'ERR') {
        throw new Error(res[0].result);
      }
      return [res[0].result] as unknown as T;
    }
    return [[]] as unknown as T;
  }

  async create(table: string, data: any): Promise<any> {
    await this.connect();
    const res = await this.send('create', [table, data]);
    return Array.isArray(res) ? res : [res];
  }
}

export const db = new LightSurreal();
export async function connectDB() {
  await db.connect();
}
