export function readLocalStorageValue<T extends string>(
	key: string,
	allowed: readonly T[],
	fallback: T
): T {
	const value = localStorage.getItem(key)
	return allowed.includes(value as T) ? (value as T) : fallback
}

export function writeLocalStorageValue(key: string, value: string): void {
	localStorage.setItem(key, value)
}
