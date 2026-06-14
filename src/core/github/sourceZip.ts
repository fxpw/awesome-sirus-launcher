export interface GitHubRepoRef {
	repo: string
	ref: string
}

export function buildGitHubSourceZipUrl(input: GitHubRepoRef): string {
	const [owner, repo] = input.repo.split('/')
	if (!owner || !repo) {
		throw new Error('GitHub repo должен быть в формате owner/repository')
	}

	const ref = input.ref.trim()
	if (!ref) throw new Error('GitHub ref не может быть пустым')

	return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/archive/refs/heads/${encodeURIComponent(ref)}.zip`
}
