import { api } from '../services/api.js';

/**
 * Downloads a protected API file with the user's credentials and saves it.
 * Plain <a href> links skip the Authorization header and the API base URL, so they fail once the cookie lapses.
 */
export async function downloadFromApi(endpoint: string, filename: string): Promise<void> {
  const blob = await api.blob(endpoint);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
