import type { TestSubmissionReceipt } from '../../api/polls'

// Kept only in this origin's IndexedDB. Never place the one-time secret in a URL or a log.
export function storeTestReceipt(pollId: string, receipt: TestSubmissionReceipt): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('Хранилище браузера недоступно.')); return }
    const request = indexedDB.open('anonpulse-private', 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('test-receipts')) request.result.createObjectStore('test-receipts', { keyPath: 'attemptId' })
    }
    request.onerror = () => reject(new Error('Не удалось открыть хранилище браузера.'))
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction('test-receipts', 'readwrite')
      transaction.objectStore('test-receipts').put({ pollId, attemptId: receipt.attemptId, accessSecret: receipt.accessSecret, savedAt: new Date().toISOString() })
      transaction.oncomplete = () => { database.close(); resolve() }
      transaction.onerror = () => { database.close(); reject(new Error('Не удалось сохранить секрет в браузере.')) }
      transaction.onabort = () => { database.close(); reject(new Error('Не удалось сохранить секрет в браузере.')) }
    }
  })
}
