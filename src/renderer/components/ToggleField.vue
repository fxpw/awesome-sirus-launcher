<script setup lang="ts">
const props = defineProps<{
	checked: boolean
	label: string
}>()

const emit = defineEmits<{
	toggle: []
}>()

function onChange(event: Event): void {
	const input = event.target as HTMLInputElement
	input.checked = props.checked
	emit('toggle')
}
</script>

<template>
	<label class="toggle">
		<input type="checkbox" :checked="checked" @change="onChange" />
		{{ label }}
	</label>
</template>
