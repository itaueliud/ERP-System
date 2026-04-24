/**
 * Property-Based Tests for Referential Integrity
 *
 * Property 18: Referential Integrity
 * Validates: Requirements 44.2
 *
 * Models a simple in-memory database with referential integrity enforcement.
 * Uses random input generation (Math.random) to verify properties hold across many inputs.
 */

// ─── Entity types ─────────────────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
  ownerId: string; // references User.id
}

interface Project {
  id: string;
  name: string;
  clientId: string; // references Client.id
}

// ─── IntegrityStore ───────────────────────────────────────────────────────────

class IntegrityStore {
  users: Map<string, User> = new Map();
  clients: Map<string, Client> = new Map();
  projects: Map<string, Project> = new Map();

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  addClient(client: Client): void {
    if (!this.users.has(client.ownerId)) {
      throw new Error(`Referential integrity violation: User '${client.ownerId}' does not exist`);
    }
    this.clients.set(client.id, client);
  }

  addProject(project: Project): void {
    if (!this.clients.has(project.clientId)) {
      throw new Error(`Referential integrity violation: Client '${project.clientId}' does not exist`);
    }
    this.projects.set(project.id, project);
  }

  deleteUser(id: string): void {
    for (const client of this.clients.values()) {
      if (client.ownerId === id) {
        throw new Error(`Referential integrity violation: Client '${client.id}' references User '${id}'`);
      }
    }
    this.users.delete(id);
  }

  deleteClient(id: string): void {
    for (const project of this.projects.values()) {
      if (project.clientId === id) {
        throw new Error(`Referential integrity violation: Project '${project.id}' references Client '${id}'`);
      }
    }
    this.clients.delete(id);
  }

  deleteProject(id: string): void {
    this.projects.delete(id);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let idCounter = 0;
function uid(): string {
  return `id-${++idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function randomName(): string {
  const words = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
  return words[Math.floor(Math.random() * words.length)] + '-' + Math.floor(Math.random() * 1000);
}

/** Build a fresh store with one user → client → project chain */
function buildChain(): { store: IntegrityStore; userId: string; clientId: string; projectId: string } {
  const store = new IntegrityStore();
  const userId = uid();
  const clientId = uid();
  const projectId = uid();

  store.addUser({ id: userId, name: randomName() });
  store.addClient({ id: clientId, name: randomName(), ownerId: userId });
  store.addProject({ id: projectId, name: randomName(), clientId });

  return { store, userId, clientId, projectId };
}

// ─── Property 18: Cannot delete a referenced entity ──────────────────────────

/**
 * Property 18 (Referential Integrity): Cannot delete a referenced entity
 * Validates: Requirements 44.2
 */
describe('Property 18 (Referential Integrity): Cannot delete a referenced entity', () => {
  it('deleting a referenced user throws and user still exists — 100 random scenarios', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const { store, userId, clientId, projectId } = buildChain();

      // Attempt to delete user while client references it — must throw
      let threw = false;
      try {
        store.deleteUser(userId);
      } catch {
        threw = true;
      }

      if (!threw) {
        failures.push(`scenario ${i}: deleteUser did not throw when client references user '${userId}'`);
        continue;
      }

      // User must still exist after failed deletion
      if (!store.users.has(userId)) {
        failures.push(`scenario ${i}: user '${userId}' was removed despite referential integrity violation`);
      }

      // Cleanup: delete in correct order to avoid leaking state
      store.deleteProject(projectId);
      store.deleteClient(clientId);
      store.deleteUser(userId);
    }

    expect(failures).toHaveLength(0);
  });

  it('deleting a referenced client throws and client still exists — 100 random scenarios', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const { store, userId, clientId, projectId } = buildChain();

      // Attempt to delete client while project references it — must throw
      let threw = false;
      try {
        store.deleteClient(clientId);
      } catch {
        threw = true;
      }

      if (!threw) {
        failures.push(`scenario ${i}: deleteClient did not throw when project references client '${clientId}'`);
        continue;
      }

      // Client must still exist after failed deletion
      if (!store.clients.has(clientId)) {
        failures.push(`scenario ${i}: client '${clientId}' was removed despite referential integrity violation`);
      }

      // Cleanup
      store.deleteProject(projectId);
      store.deleteClient(clientId);
      store.deleteUser(userId);
    }

    expect(failures).toHaveLength(0);
  });

  it('deleting in correct order (project → client → user) always succeeds — 100 random scenarios', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const { store, userId, clientId, projectId } = buildChain();

      try {
        store.deleteProject(projectId);
        store.deleteClient(clientId);
        store.deleteUser(userId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`scenario ${i}: unexpected error during ordered deletion: ${msg}`);
        continue;
      }

      // Store must be empty after correct-order deletion
      if (store.projects.size !== 0 || store.clients.size !== 0 || store.users.size !== 0) {
        failures.push(
          `scenario ${i}: store not empty after deletion — ` +
          `users=${store.users.size}, clients=${store.clients.size}, projects=${store.projects.size}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Cannot create entity with invalid foreign key ────────────────────────────

describe('Cannot create entity with invalid foreign key', () => {
  it('creating a client with non-existent ownerId always throws — 100 random attempts', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const store = new IntegrityStore();
      // Do NOT add any user — ownerId will always be invalid
      const fakeOwnerId = uid();

      let threw = false;
      try {
        store.addClient({ id: uid(), name: randomName(), ownerId: fakeOwnerId });
      } catch {
        threw = true;
      }

      if (!threw) {
        failures.push(`attempt ${i}: addClient did not throw for non-existent ownerId '${fakeOwnerId}'`);
      }

      // Store must remain empty
      if (store.clients.size !== 0) {
        failures.push(`attempt ${i}: client was added despite invalid ownerId`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('creating a project with non-existent clientId always throws — 100 random attempts', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const store = new IntegrityStore();
      // Add a user but no client — clientId will always be invalid
      const userId = uid();
      store.addUser({ id: userId, name: randomName() });

      const fakeClientId = uid();

      let threw = false;
      try {
        store.addProject({ id: uid(), name: randomName(), clientId: fakeClientId });
      } catch {
        threw = true;
      }

      if (!threw) {
        failures.push(`attempt ${i}: addProject did not throw for non-existent clientId '${fakeClientId}'`);
      }

      if (store.projects.size !== 0) {
        failures.push(`attempt ${i}: project was added despite invalid clientId`);
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Cascade-safe deletion order ─────────────────────────────────────────────

describe('Cascade-safe deletion order: leaf → root always succeeds', () => {
  it('deleting project → client → user leaves store empty — 100 random entity chains', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const { store, userId, clientId, projectId } = buildChain();

      try {
        // Leaf first
        store.deleteProject(projectId);
        // Then intermediate
        store.deleteClient(clientId);
        // Then root
        store.deleteUser(userId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`chain ${i}: cascade deletion threw unexpectedly: ${msg}`);
        continue;
      }

      const totalEntities = store.users.size + store.clients.size + store.projects.size;
      if (totalEntities !== 0) {
        failures.push(
          `chain ${i}: store not empty after cascade deletion — ` +
          `users=${store.users.size}, clients=${store.clients.size}, projects=${store.projects.size}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('deleting multiple chains in leaf-to-root order all succeed — 100 random multi-chain scenarios', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const store = new IntegrityStore();
      const chainCount = 2 + Math.floor(Math.random() * 4); // 2–5 chains
      const chains: Array<{ userId: string; clientId: string; projectId: string }> = [];

      // Build all chains in the same store
      for (let c = 0; c < chainCount; c++) {
        const userId = uid();
        const clientId = uid();
        const projectId = uid();
        store.addUser({ id: userId, name: randomName() });
        store.addClient({ id: clientId, name: randomName(), ownerId: userId });
        store.addProject({ id: projectId, name: randomName(), clientId });
        chains.push({ userId, clientId, projectId });
      }

      // Delete all in leaf-to-root order
      try {
        for (const { projectId } of chains) store.deleteProject(projectId);
        for (const { clientId } of chains) store.deleteClient(clientId);
        for (const { userId } of chains) store.deleteUser(userId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`scenario ${i}: multi-chain cascade deletion threw: ${msg}`);
        continue;
      }

      const totalEntities = store.users.size + store.clients.size + store.projects.size;
      if (totalEntities !== 0) {
        failures.push(
          `scenario ${i}: store not empty after multi-chain deletion — ` +
          `users=${store.users.size}, clients=${store.clients.size}, projects=${store.projects.size}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});
