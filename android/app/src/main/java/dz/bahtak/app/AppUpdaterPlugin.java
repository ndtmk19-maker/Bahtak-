package dz.bahtak.app;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile File pendingInstallApk = null;

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            PackageInfo pInfo = pm.getPackageInfo(getContext().getPackageName(), 0);
            long versionCode = PackageInfoCompat.getLongVersionCode(pInfo);
            String versionName = pInfo.versionName != null ? pInfo.versionName : "1.0.0";

            SharedPreferences prefs = getContext().getSharedPreferences(
                com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME,
                Activity.MODE_PRIVATE
            );
            String activeOtaPath = prefs.getString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, "");

            JSObject ret = new JSObject();
            ret.put("versionCode", versionCode);
            ret.put("versionName", versionName);
            ret.put("activeOtaPath", activeOtaPath != null ? activeOtaPath : "");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ret.put("canRequestPackageInstalls", pm.canRequestPackageInstalls());
            } else {
                ret.put("canRequestPackageInstalls", true);
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to read app version: " + e.getMessage());
        }
    }

    @PluginMethod
    public void fetchManifest(PluginCall call) {
        String urlStr = call.getString("url", "");
        if (urlStr == null || urlStr.trim().isEmpty()) {
            call.reject("Missing url");
            return;
        }
        executor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                conn = openWithRedirects(urlStr);
                int status = conn.getResponseCode();
                if (status < 200 || status >= 300) {
                    call.reject("HTTP " + status);
                    return;
                }
                try (InputStream in = new BufferedInputStream(conn.getInputStream());
                     ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        baos.write(buf, 0, n);
                    }
                    String jsonText = baos.toString(StandardCharsets.UTF_8.name());
                    JSObject ret = new JSObject();
                    ret.put("json", jsonText);
                    call.resolve(ret);
                }
            } catch (Exception e) {
                call.reject("Manifest fetch failed: " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    @PluginMethod
    public void downloadAndPrepareWebUpdate(PluginCall call) {
        String urlStr = call.getString("url", "");
        String rawBuildId = call.getString("buildId", "");
        if (urlStr == null || urlStr.trim().isEmpty() || rawBuildId == null || rawBuildId.trim().isEmpty()) {
            call.reject("Missing url or buildId");
            return;
        }
        String safeId = rawBuildId.replaceAll("[^a-zA-Z0-9_-]", "");
        if (safeId.isEmpty()) {
            call.reject("Invalid buildId");
            return;
        }

        executor.execute(() -> {
            File zipFile = new File(getContext().getCacheDir(), "ota_bundle.zip");
            File otaRoot = new File(getContext().getFilesDir(), "ota_bundles");
            File tmpDir = new File(otaRoot, ".tmp_" + safeId);
            File finalDir = new File(otaRoot, safeId);
            HttpURLConnection conn = null;

            try {
                if (!otaRoot.exists()) otaRoot.mkdirs();
                deleteRecursive(tmpDir);
                if (!tmpDir.mkdirs() && !tmpDir.exists()) {
                    throw new IOException("Could not create OTA temp dir");
                }

                conn = openWithRedirects(urlStr);
                int status = conn.getResponseCode();
                if (status < 200 || status >= 300) {
                    throw new IOException("HTTP " + status);
                }

                try (InputStream in = new BufferedInputStream(conn.getInputStream());
                     FileOutputStream fos = new FileOutputStream(zipFile)) {
                    byte[] buf = new byte[16384];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        fos.write(buf, 0, n);
                    }
                    fos.flush();
                }

                unzipSafely(zipFile, tmpDir);

                File indexFile = new File(tmpDir, "index.html");
                if (!indexFile.exists() || indexFile.length() < 100) {
                    throw new IOException("Invalid web bundle: missing index.html");
                }

                // نسخ شعارات الجامعات الموجودة أصلاً داخل APK حتى تبقى متاحة دون إنترنت ودون إعادة تحميلها
                copyAssetTree(
                    getContext().getAssets(),
                    "public/assets/univ_logos",
                    new File(tmpDir, "assets/univ_logos")
                );

                deleteRecursive(finalDir);
                if (!tmpDir.renameTo(finalDir)) {
                    throw new IOException("Failed to finalize OTA bundle directory");
                }

                SharedPreferences prefs = getContext().getSharedPreferences(
                    com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME,
                    Activity.MODE_PRIVATE
                );
                prefs.edit()
                    .putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, finalDir.getAbsolutePath())
                    .apply();

                File[] existing = otaRoot.listFiles();
                if (existing != null) {
                    for (File child : existing) {
                        if (!child.getName().equals(finalDir.getName())) {
                            deleteRecursive(child);
                        }
                    }
                }
                zipFile.delete();

                JSObject ret = new JSObject();
                ret.put("path", finalDir.getAbsolutePath());
                ret.put("buildId", safeId);
                call.resolve(ret);
            } catch (Exception e) {
                deleteRecursive(tmpDir);
                if (zipFile.exists()) zipFile.delete();
                call.reject("Web OTA update failed: " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    @PluginMethod
    public void applyWebBundle(PluginCall call) {
        String path = call.getString("path", "");
        if (path == null || path.trim().isEmpty()) {
            SharedPreferences prefs = getContext().getSharedPreferences(
                com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME,
                Activity.MODE_PRIVATE
            );
            path = prefs.getString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, "");
        }
        if (path == null || path.isEmpty() || !new File(path, "index.html").exists()) {
            call.reject("No valid prepared web bundle path found");
            return;
        }
        final String targetPath = path;
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                getBridge().setServerBasePath(targetPath);
                call.resolve();
            } catch (Exception e) {
                call.reject("Apply web bundle failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void downloadAndInstallApk(PluginCall call) {
        String urlStr = call.getString("url", "");
        if (urlStr == null || urlStr.trim().isEmpty()) {
            call.reject("Missing url");
            return;
        }
        executor.execute(() -> {
            File updatesDir = new File(getContext().getCacheDir(), "updates");
            File partFile = new File(updatesDir, "Bahtak-update.apk.part");
            File apkFile = new File(updatesDir, "Bahtak-update.apk");
            HttpURLConnection conn = null;

            try {
                if (!updatesDir.exists()) updatesDir.mkdirs();
                if (partFile.exists()) partFile.delete();

                conn = openWithRedirects(urlStr);
                int status = conn.getResponseCode();
                if (status < 200 || status >= 300) {
                    throw new IOException("HTTP " + status);
                }

                long total = conn.getContentLengthLong();
                long downloaded = 0;
                long lastEmit = 0;

                try (InputStream in = new BufferedInputStream(conn.getInputStream());
                     FileOutputStream fos = new FileOutputStream(partFile)) {
                    byte[] buf = new byte[32768];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        fos.write(buf, 0, n);
                        downloaded += n;
                        long now = System.currentTimeMillis();
                        if (now - lastEmit >= 120 || (total > 0 && downloaded == total)) {
                            lastEmit = now;
                            JSObject ev = new JSObject();
                            ev.put("downloadedBytes", downloaded);
                            ev.put("totalBytes", total);
                            ev.put("percent", total > 0 ? Math.min(100, (int) ((downloaded * 100L) / total)) : -1);
                            notifyListeners("apkDownloadProgress", ev);
                        }
                    }
                    fos.flush();
                }

                // التحقق من أن الملف المحمل هو APK/ZIP صالح وليس صفحة خطأ HTML
                if (partFile.length() < 100_000) {
                    throw new IOException("Downloaded file is too small to be an APK");
                }
                try (FileInputStream fis = new FileInputStream(partFile)) {
                    int b0 = fis.read();
                    int b1 = fis.read();
                    if (b0 != 0x50 || b1 != 0x4B) {
                        throw new IOException("Invalid APK signature");
                    }
                }

                if (apkFile.exists()) apkFile.delete();
                if (!partFile.renameTo(apkFile)) {
                    throw new IOException("Could not finalize APK file");
                }

                JSObject doneEv = new JSObject();
                doneEv.put("downloadedBytes", apkFile.length());
                doneEv.put("totalBytes", apkFile.length());
                doneEv.put("percent", 100);
                notifyListeners("apkDownloadProgress", doneEv);

                String resultStatus = triggerApkInstall(apkFile);
                JSObject ret = new JSObject();
                ret.put("status", resultStatus);
                ret.put("filePath", apkFile.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                if (partFile.exists()) partFile.delete();
                call.reject("APK download failed: " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    @PluginMethod
    public void retryInstallApk(PluginCall call) {
        File apkFile = new File(new File(getContext().getCacheDir(), "updates"), "Bahtak-update.apk");
        if (!apkFile.exists() || apkFile.length() < 100_000) {
            call.reject("No downloaded APK found");
            return;
        }
        try {
            String status = triggerApkInstall(apkFile);
            JSObject ret = new JSObject();
            ret.put("status", status);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Install failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearCachedApk(PluginCall call) {
        File updatesDir = new File(getContext().getCacheDir(), "updates");
        deleteRecursive(updatesDir);
        pendingInstallApk = null;
        call.resolve();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        File pending = pendingInstallApk;
        if (pending != null && pending.exists()) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls()) {
                pendingInstallApk = null;
                try {
                    launchInstallerIntent(pending);
                    notifyListeners("apkInstallResumed", new JSObject());
                } catch (Exception ignored) {
                }
            }
        }
    }

    private String triggerApkInstall(File apkFile) {
        Activity activity = getActivity();
        if (activity == null) {
            return "error";
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            pendingInstallApk = apkFile;
            Intent settingsIntent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.runOnUiThread(() -> activity.startActivity(settingsIntent));
            return "needs_permission";
        }
        launchInstallerIntent(apkFile);
        return "installing";
    }

    private void launchInstallerIntent(File apkFile) {
        Activity activity = getActivity();
        if (activity == null) return;
        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apkFile
        );
        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.runOnUiThread(() -> activity.startActivity(installIntent));
    }

    private static HttpURLConnection openWithRedirects(String rawUrl) throws IOException {
        URL current = new URL(rawUrl);
        for (int i = 0; i < 6; i++) {
            HttpURLConnection conn = (HttpURLConnection) current.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(12000);
            conn.setReadTimeout(30000);
            conn.setUseCaches(false);
            conn.setRequestProperty("Cache-Control", "no-cache");
            conn.setRequestProperty("User-Agent", "BahtakAndroidUpdater/1.0");
            int code = conn.getResponseCode();
            if (code == HttpURLConnection.HTTP_MOVED_PERM ||
                code == HttpURLConnection.HTTP_MOVED_TEMP ||
                code == HttpURLConnection.HTTP_SEE_OTHER ||
                code == 307 || code == 308) {
                String loc = conn.getHeaderField("Location");
                conn.disconnect();
                if (loc == null || loc.isEmpty()) {
                    throw new IOException("Empty redirect location");
                }
                current = new URL(current, loc);
                continue;
            }
            return conn;
        }
        throw new IOException("Too many redirects");
    }

    private static void unzipSafely(File zipFile, File destDir) throws IOException {
        String destCanonical = destDir.getCanonicalPath() + File.separator;
        byte[] buf = new byte[16384];
        try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(new FileInputStream(zipFile)))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                File outFile = new File(destDir, entry.getName());
                String outCanonical = outFile.getCanonicalPath();
                if (!outCanonical.startsWith(destCanonical)) {
                    throw new SecurityException("Blocked unsafe zip entry: " + entry.getName());
                }
                if (entry.isDirectory()) {
                    if (!outFile.exists() && !outFile.mkdirs()) {
                        throw new IOException("Failed to create directory: " + outFile);
                    }
                } else {
                    File parent = outFile.getParentFile();
                    if (parent != null && !parent.exists() && !parent.mkdirs()) {
                        throw new IOException("Failed to create directory: " + parent);
                    }
                    try (BufferedOutputStream bos = new BufferedOutputStream(new FileOutputStream(outFile))) {
                        int len;
                        while ((len = zis.read(buf)) != -1) {
                            bos.write(buf, 0, len);
                        }
                        bos.flush();
                    }
                }
                zis.closeEntry();
            }
        }
    }

    private static void copyAssetTree(AssetManager am, String assetDir, File destDir) throws IOException {
        String[] entries = am.list(assetDir);
        if (entries == null || entries.length == 0) return;
        if (!destDir.exists() && !destDir.mkdirs()) return;

        byte[] buf = new byte[16384];
        for (String name : entries) {
            String childAsset = assetDir + "/" + name;
            File childDest = new File(destDir, name);
            String[] nested = am.list(childAsset);
            if (nested != null && nested.length > 0) {
                copyAssetTree(am, childAsset, childDest);
            } else if (!childDest.exists()) {
                try (InputStream in = am.open(childAsset);
                     OutputStream out = new FileOutputStream(childDest)) {
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        out.write(buf, 0, n);
                    }
                    out.flush();
                }
            }
        }
    }

    private static void deleteRecursive(File target) {
        if (target == null || !target.exists()) return;
        if (target.isDirectory()) {
            File[] children = target.listFiles();
            if (children != null) {
                for (File c : children) {
                    deleteRecursive(c);
                }
            }
        }
        target.delete();
    }
}
