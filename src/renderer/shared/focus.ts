export function isFocusLeaving(event: FocusEvent): boolean {
	const nextTarget = event.relatedTarget
	return !(
		nextTarget instanceof Node &&
		event.currentTarget instanceof Node &&
		event.currentTarget.contains(nextTarget)
	)
}
