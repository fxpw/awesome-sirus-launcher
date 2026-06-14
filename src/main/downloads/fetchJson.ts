export async function fetchJson(url: string): Promise<unknown> {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`Request failed ${response.status} ${response.statusText}`.trim())
	}

	return response.json()
}
