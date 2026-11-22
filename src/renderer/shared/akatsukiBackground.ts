const cloudsUrl = new URL('../assets/akatsuki-clouds-left.svg', import.meta.url).href

interface BackgroundIcon {
	x: number
	y: number
	width: number
	height: number
	rotation: number
	alpha: number
}

export async function initializeAkatsukiBackground(): Promise<void> {
	const image = await loadImage(cloudsUrl)
	const aspectRatio = image.naturalHeight / image.naturalWidth
	const width = Math.max(window.innerWidth, 1500)
	const height = Math.max(window.innerHeight, 720)
	const canvas = document.createElement('canvas')
	canvas.className = 'akatsuki-background-layer'
	canvas.width = width
	canvas.height = height

	const context = canvas.getContext('2d')
	if (!context) return

	context.imageSmoothingEnabled = true
	context.imageSmoothingQuality = 'high'
	for (const icon of createIcons(width, height, aspectRatio)) {
		drawIcon(context, image, icon)
	}

	document.body.prepend(canvas)
}

function createIcons(width: number, height: number, aspectRatio: number): BackgroundIcon[] {
	const targetCount = Math.round((width * height) / 132000)
	const icons: BackgroundIcon[] = []
	const maxAttempts = targetCount * 24

	for (let attempt = 0; attempt < maxAttempts && icons.length < targetCount; attempt += 1) {
		const iconWidth = Math.round(randomBetween(260, 560))
		const iconHeight = Math.round(iconWidth * aspectRatio)
		const icon: BackgroundIcon = {
			x: randomBetween(-iconWidth * 0.18, width - iconWidth * 0.82),
			y: randomBetween(-iconHeight * 0.14, height - iconHeight * 0.78),
			width: iconWidth,
			height: iconHeight,
			rotation: randomBetween(-38, 38),
			alpha: randomBetween(0.62, 0.9)
		}

		if (isFarEnough(icon, icons)) {
			icons.push(icon)
		}
	}

	return icons
}

function drawIcon(
	context: CanvasRenderingContext2D,
	image: HTMLImageElement,
	icon: BackgroundIcon
): void {
	context.save()
	context.globalAlpha = icon.alpha
	context.shadowColor = 'rgba(247, 244, 238, 0.24)'
	context.shadowBlur = 14
	context.translate(icon.x + icon.width / 2, icon.y + icon.height / 2)
	context.rotate((icon.rotation * Math.PI) / 180)
	context.drawImage(image, -icon.width / 2, -icon.height / 2, icon.width, icon.height)
	context.restore()
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image()
		image.onload = () => resolve(image)
		image.onerror = reject
		image.src = src
	})
}

function randomBetween(min: number, max: number): number {
	return min + Math.random() * (max - min)
}

function isFarEnough(icon: BackgroundIcon, icons: BackgroundIcon[]): boolean {
	return icons.every((placedIcon) => {
		const iconCenterX = icon.x + icon.width / 2
		const iconCenterY = icon.y + icon.height / 2
		const placedCenterX = placedIcon.x + placedIcon.width / 2
		const placedCenterY = placedIcon.y + placedIcon.height / 2
		const distance = Math.hypot(iconCenterX - placedCenterX, iconCenterY - placedCenterY)
		const iconSize = Math.max(icon.width, icon.height)
		const placedSize = Math.max(placedIcon.width, placedIcon.height)
		const minimumDistance = (iconSize + placedSize) * randomBetween(0.38, 0.62)

		return distance >= minimumDistance
	})
}
