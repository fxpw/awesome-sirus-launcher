<script setup lang="ts">
withDefaults(
	defineProps<{
		variant?: 'primary' | 'secondary'
		type?: 'button' | 'submit'
		disabled?: boolean
	}>(),
	{
		variant: 'primary',
		type: 'button'
	}
)
</script>

<template>
	<button class="button" :class="`button--${variant}`" :disabled="disabled" :type="type">
		<slot />
	</button>
</template>
