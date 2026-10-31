// Minimal runtime stand-in for the `obsidian` package (which ships types only).
export class Plugin {}
export class PluginSettingTab {
	containerEl = {} as HTMLElement;
	constructor(public app: unknown, public plugin: unknown) {}
}
export class Setting {}
export class Notice {
	constructor(public message: string) {}
}
export const normalizePath = (p: string): string => p.replace(/\\+/g, '/').replace(/\/+/g, '/');
