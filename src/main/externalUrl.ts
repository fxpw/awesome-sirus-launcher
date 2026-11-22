export function isAllowedExternalUrl(value: string): boolean {
	const protocol = URL.parse(value)?.protocol
	return protocol === 'http:' || protocol === 'https:'
}
