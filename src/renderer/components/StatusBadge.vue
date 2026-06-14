<script setup lang="ts">
defineProps<{
	tone?: 'neutral' | 'ok' | 'warning'
}>()
</script>

<template>
	<span class="status" :class="tone ? `status--${tone}` : 'status--neutral'">
		<slot />
	</span>
</template>
