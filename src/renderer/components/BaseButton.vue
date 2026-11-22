<script setup lang="ts">
withDefaults(
	defineProps<{
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon'
		disabled?: boolean
	}>(),
	{
		variant: 'primary'
	}
)
</script>

<template>
	<button class="button" :class="`button--${variant}`" :disabled="disabled" type="button">
		<slot />
	</button>
</template>
