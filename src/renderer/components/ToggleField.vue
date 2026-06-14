<script setup lang="ts">
defineProps<{
	checked: boolean
	label: string
}>()

defineEmits<{
	toggle: []
}>()
</script>

<template>
	<label class="toggle">
		<input type="checkbox" :checked="checked" @change="$emit('toggle')" />
		{{ label }}
	</label>
</template>
