"use client";

// Une seule base locale : la file d'actions et les vidéos en attente. Pas de bibliothèque pour si peu.
export type StoreName = "ops" | "uploads";

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open("tartan", 1);
    request.onupgradeneeded = () => {
      for (const store of ["ops", "uploads"]) request.result.createObjectStore(store, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const run = async <T>(store: StoreName, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>) => {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const request = action(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
};

export const idbAll = <T>(store: StoreName): Promise<T[]> => run<T[]>(store, "readonly", (s) => s.getAll());
export const idbPut = (store: StoreName, value: unknown): Promise<unknown> =>
  run(store, "readwrite", (s) => s.put(value));
export const idbDelete = (store: StoreName, id: string): Promise<unknown> =>
  run(store, "readwrite", (s) => s.delete(id));

// Lecture, comparaison et remplacement dans UNE transaction : aucun intervalle
// pendant lequel une autre fenêtre peut ajouter une saisie qui serait effacée.
export const idbTransform = async <T>(
  store: StoreName,
  transform: (rows: T[]) => { remove: string[]; put: T[] },
): Promise<void> => {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const table = tx.objectStore(store);
      const request = table.getAll();
      let failure: unknown;
      request.onsuccess = () => {
        try {
          const change = transform(request.result as T[]);
          for (const id of change.remove) table.delete(id);
          for (const row of change.put) table.put(row);
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(failure ?? tx.error);
      tx.onerror = () => reject(failure ?? tx.error);
    });
  } finally {
    db.close();
  }
};
