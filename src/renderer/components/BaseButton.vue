<script setup lang="ts">
withDefaults(
	defineProps<{
		variant?: 'primary' | 'secondary'
		type?: 'button' | 'submit'
	}>(),
	{
		variant: 'primary',
		type: 'button'
	}
)
</script>

<template>
	<button class="button" :class="`button--${variant}`" :type="type">
		<slot />
	</button>
</template>
