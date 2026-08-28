<script setup lang="ts">
defineProps<{
	modelValue: string
	placeholder?: string
	type?: string
	disabled?: boolean
}>()

defineEmits<{
	'update:modelValue': [value: string]
}>()
</script>

<template>
	<input
		class="field"
		:type="type ?? 'text'"
		:value="modelValue"
		:placeholder="placeholder"
		:disabled="disabled"
		autocomplete="off"
		@input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
	/>
</template>
