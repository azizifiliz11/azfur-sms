// Favori servis/ülkeler cihazda (localStorage) tutulur; kiralama paneli ve profil aynı kaynağı kullanır.
export const FAV_SERVICES_KEY = "azfur_fav_services";
export const FAV_COUNTRIES_KEY = "azfur_fav_countries";
/** Favoriler değiştiğinde yayınlanır (profilden kaldırılan favori kiralama panelinde de güncellenir). */
export const FAVORITES_CHANGE_EVENT = "azfur-favorites-change";

function readList<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getFavoriteServices(): string[] {
  return readList<string>(FAV_SERVICES_KEY);
}

export function getFavoriteCountries(): number[] {
  return readList<number>(FAV_COUNTRIES_KEY);
}

export function saveFavorites(key: typeof FAV_SERVICES_KEY | typeof FAV_COUNTRIES_KEY, list: Array<string | number>) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    window.dispatchEvent(new Event(FAVORITES_CHANGE_EVENT));
  } catch {}
}
