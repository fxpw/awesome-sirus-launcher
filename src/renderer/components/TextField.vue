<script setup lang="ts">
defineProps<{
	modelValue: string
	placeholder?: string
	type?: string
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
		autocomplete="off"
		@input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
	/>
</template>
