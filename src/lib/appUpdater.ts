import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface AppInfoResult {
  versionCode: number;
  versionName: string;
  activeOtaPath: string;
  canRequestPackageInstalls: boolean;
}

export interface ApkDownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
}

interface AppUpdaterPlugin {
  getAppInfo(): Promise<AppInfoResult>;
  fetchManifest(options: { url: string }): Promise<{ json: string }>;
  downloadAndPrepareWebUpdate(options: { url: string; buildId: string }): Promise<{ path: string; buildId: string }>;
  applyWebBundle(options?: { path?: string }): Promise<void>;
  downloadAndInstallApk(options: { url: string }): Promise<{ status: 'installing' | 'needs_permission' | 'error'; filePath?: string }>;
  retryInstallApk(): Promise<{ status: 'installing' | 'needs_permission' | 'error' }>;
  clearCachedApk(): Promise<void>;
  addListener(eventName: 'apkDownloadProgress', listenerFunc: (event: ApkDownloadProgress) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'apkInstallResumed', listenerFunc: () => void): Promise<PluginListenerHandle>;
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

export const VERSION_MANIFEST_URL = 'https://bahtek.site/version.json';

export interface RemoteApkInfo {
  versionCode: number;
  versionName: string;
  url: string;
  notes?: string;
  mandatory?: boolean;
}

export interface RemoteWebInfo {
  buildId: string;
  url: string;
  size?: number;
}

export interface RemoteVersionManifest {
  apk?: RemoteApkInfo;
  web?: RemoteWebInfo;
}

export type UpdateCheckResult =
  | {
      kind: 'apk';
      currentVersionCode: number;
      currentVersionName: string;
      apk: RemoteApkInfo;
    }
  | {
      kind: 'web';
      currentVersionCode: number;
      currentVersionName: string;
      currentBuildId: string;
      web: RemoteWebInfo;
    }
  | {
      kind: 'up-to-date';
      currentVersionCode: number;
      currentVersionName: string;
      currentBuildId: string;
    };

export function isAndroidApp(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export function getBundledWebBuildId(): string {
  if (typeof document === 'undefined') return '';
  return document.querySelector('meta[name="bahtak-web-id"]')?.getAttribute('content')?.trim() || '';
}

export async function checkForAppUpdates(): Promise<UpdateCheckResult | null> {
  if (!isAndroidApp()) return null;

  const info = await AppUpdater.getAppInfo();
  const currentBuildId = getBundledWebBuildId();
  const manifestUrl = `${VERSION_MANIFEST_URL}?t=${Date.now()}`;

  let rawJson = '';
  try {
    const res = await AppUpdater.fetchManifest({ url: manifestUrl });
    rawJson = res.json;
  } catch {
    const resp = await fetch(manifestUrl, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    rawJson = await resp.text();
  }

  const remote = JSON.parse(rawJson) as RemoteVersionManifest;

  if (remote.apk && Number(remote.apk.versionCode) > Number(info.versionCode)) {
    return {
      kind: 'apk',
      currentVersionCode: Number(info.versionCode),
      currentVersionName: info.versionName,
      apk: {
        versionCode: Number(remote.apk.versionCode),
        versionName: String(remote.apk.versionName || ''),
        url: String(remote.apk.url || 'https://bahtek.site/Bahtak.apk'),
        notes: remote.apk.notes ? String(remote.apk.notes) : '',
        mandatory: Boolean(remote.apk.mandatory),
      },
    };
  }

  // مسح ملف التحديث المؤقت القديم إذا أصبح التطبيق محدثاً بالفعل لتوفير مساحة الهاتف
  AppUpdater.clearCachedApk().catch(() => {});

  if (
    remote.web?.buildId &&
    remote.web?.url &&
    currentBuildId &&
    remote.web.buildId.trim() !== currentBuildId
  ) {
    return {
      kind: 'web',
      currentVersionCode: Number(info.versionCode),
      currentVersionName: info.versionName,
      currentBuildId,
      web: {
        buildId: remote.web.buildId.trim(),
        url: remote.web.url,
        size: remote.web.size,
      },
    };
  }

  return {
    kind: 'up-to-date',
    currentVersionCode: Number(info.versionCode),
    currentVersionName: info.versionName,
    currentBuildId,
  };
}

export { AppUpdater };
export type { RemoteVersionManifest as VersionManifest };
