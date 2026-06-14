export type Locale = 'ru' | 'en'

export const defaultLocale: Locale = 'ru'

export const localeLabels: Record<Locale, string> = {
	ru: 'RU',
	en: 'EN'
}

const messages = {
	ru: {
		'app.title': 'Awesome Launcher',
		'app.eyebrow': 'Sirus',
		'app.versionToken': '{name} {version}',
		'nav.dashboard': 'Dashboard',
		'nav.addons': 'Addons',
		'nav.backups': 'Backups',
		'nav.accounts': 'Accounts',
		'nav.settings': 'Settings',
		'header.eyebrow': 'Стартовый каркас',
		'header.title': 'Проверка клиента и системных модулей',
		'github.status': 'GitHub token: {status}',
		'github.configured': 'задан',
		'github.missing': 'не задан',
		'wow.title': 'Путь к WoW',
		'wow.description':
			'Путь сохраняется локально и используется для бекапов, патчей, аддонов и запуска игры.',
		'wow.placeholder': 'F:\\games\\sirus\\World of Warcraft Sirus',
		'wow.select': 'Выбрать',
		'wow.save': 'Сохранить',
		'wow.saved': 'Путь к WoW сохранен',
		'wow.valid': 'Клиент похож на WoW',
		'wow.invalid': 'Не все файлы найдены',
		'wow.allFound': 'Все базовые пути найдены.',
		'wow.validateError': 'Не удалось проверить путь',
		'launch.title': 'Поведение запуска',
		'launch.description':
			'Эти настройки уже сохраняются, подключение к реальному запуску будет следующим слоем.',
		'launch.checkClient': 'Проверять клиент перед запуском',
		'launch.closeOnLaunch': 'Закрывать лаунчер после запуска игры',
		'launch.prereleaseUpdates': 'Показывать pre-release обновления лаунчера',
		'token.title': 'GitHub token',
		'token.description':
			'Опционально нужен для больших лимитов при скачивании аддонов. Сохраненное значение не показывается.',
		'token.placeholder': 'github_pat_...',
		'token.save': 'Сохранить',
    'token.clear': 'Удалить',
    'token.saved': 'GitHub token сохранен',
    'token.cleared': 'GitHub token удален',
    'backup.title': 'Бекапы WTF',
    'backup.description': 'Создает zip-архив папки WTF из выбранного клиента WoW.',
    'backup.create': 'Сделать бекап',
    'backup.created': 'Бекап WTF создан',
    'backup.restore': 'Восстановить',
    'backup.restored': 'WTF восстановлен из бекапа, текущая папка сохранена отдельным safety-бекапом',
    'backup.delete': 'Удалить',
    'backup.deleted': 'Бекап WTF удален',
    'backup.openFolder': 'Открыть папку',
    'backup.restoreConfirm': 'Восстановить WTF из {name}? Текущая папка будет сохранена safety-бекапом.',
    'backup.deleteConfirm': 'Удалить бекап {name}?',
    'backup.empty': 'Бекапов пока нет.',
    'backup.size': '{size} KB',
    'theme.light': 'Светлая',
		'theme.dark': 'Темная',
		'locale.label': 'Язык'
	},
	en: {
		'app.title': 'Awesome Launcher',
		'app.eyebrow': 'Sirus',
		'app.versionToken': '{name} {version}',
		'nav.dashboard': 'Dashboard',
		'nav.addons': 'Addons',
		'nav.backups': 'Backups',
		'nav.accounts': 'Accounts',
		'nav.settings': 'Settings',
		'header.eyebrow': 'Initial scaffold',
		'header.title': 'Client and system module checks',
		'github.status': 'GitHub token: {status}',
		'github.configured': 'configured',
		'github.missing': 'not configured',
		'wow.title': 'WoW path',
		'wow.description':
			'The path is stored locally and used for backups, patches, addons, and game launch.',
		'wow.placeholder': 'F:\\games\\sirus\\World of Warcraft Sirus',
		'wow.select': 'Choose',
		'wow.save': 'Save',
		'wow.saved': 'WoW path saved',
		'wow.valid': 'Client looks like WoW',
		'wow.invalid': 'Some files are missing',
		'wow.allFound': 'All base paths were found.',
		'wow.validateError': 'Could not validate path',
		'launch.title': 'Launch behavior',
		'launch.description':
			'These settings are already saved; real launch integration comes in the next layer.',
		'launch.checkClient': 'Check client before launch',
		'launch.closeOnLaunch': 'Close launcher after game launch',
		'launch.prereleaseUpdates': 'Show launcher pre-release updates',
		'token.title': 'GitHub token',
		'token.description':
			'Optional token for higher addon download limits. The saved value is never shown.',
		'token.placeholder': 'github_pat_...',
		'token.save': 'Save',
    'token.clear': 'Clear',
    'token.saved': 'GitHub token saved',
    'token.cleared': 'GitHub token removed',
    'backup.title': 'WTF backups',
    'backup.description': 'Creates a zip archive of the WTF folder from the selected WoW client.',
    'backup.create': 'Create backup',
    'backup.created': 'WTF backup created',
    'backup.restore': 'Restore',
    'backup.restored': 'WTF restored from backup; current folder was saved as a safety backup',
    'backup.delete': 'Delete',
    'backup.deleted': 'WTF backup deleted',
    'backup.openFolder': 'Open folder',
    'backup.restoreConfirm': 'Restore WTF from {name}? The current folder will be saved as a safety backup.',
    'backup.deleteConfirm': 'Delete backup {name}?',
    'backup.empty': 'No backups yet.',
    'backup.size': '{size} KB',
    'theme.light': 'Light',
		'theme.dark': 'Dark',
		'locale.label': 'Language'
	}
} as const

export type MessageKey = keyof (typeof messages)['ru']

export function translate(
	locale: Locale,
	key: MessageKey,
	params: Record<string, string | number> = {}
): string {
	const template: string = messages[locale][key] ?? messages[defaultLocale][key] ?? key

	return Object.entries(params).reduce(
		(text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
		template
	)
}
