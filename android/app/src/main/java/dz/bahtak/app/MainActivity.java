package dz.bahtak.app;

import android.content.Context;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppPrintPlugin.class);
        super.onCreate(savedInstanceState);

        // واجهة جافاسكربت مباشرة للطباعة كـ PDF في أندرويد
        runOnUiThread(() -> {
            try {
                if (getBridge() != null) {
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        webView.addJavascriptInterface(new Object() {
                            @JavascriptInterface
                            public void print(String jobName) {
                                runOnUiThread(() -> {
                                    try {
                                        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                                        if (printManager != null) {
                                            String name = (jobName != null && !jobName.trim().isEmpty()) ? jobName : "بحث_جامعي_منسق";
                                            PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(name);
                                            PrintAttributes.Builder builder = new PrintAttributes.Builder();
                                            builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);
                                            builder.setColorMode(PrintAttributes.COLOR_MODE_COLOR);
                                            printManager.print(name, printAdapter, builder.build());
                                        }
                                    } catch (Exception ex) {
                                        ex.printStackTrace();
                                    }
                                });
                            }
                        }, "AndroidNativePrint");

                        // واجهة جافاسكربت لحفظ ومشاركة ملفات PowerPoint (.pptx) و Word (.doc) داخل تطبيق الأندرويد
                        webView.addJavascriptInterface(new Object() {
                            @JavascriptInterface
                            public boolean saveBase64File(String base64Data, String fileName, String mimeType) {
                                try {
                                    byte[] bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
                                    String safeName = (fileName != null && !fileName.trim().isEmpty())
                                            ? fileName.replaceAll("[\\\\/:*?\"<>|]+", "_")
                                            : "bahtak_export.pptx";
                                    String safeMime = (mimeType != null && !mimeType.trim().isEmpty())
                                            ? mimeType
                                            : "application/octet-stream";

                                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                                        android.content.ContentValues values = new android.content.ContentValues();
                                        values.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                                        values.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, safeMime);
                                        values.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS + "/Bahtak");
                                        android.net.Uri uri = getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                                        if (uri != null) {
                                            try (java.io.OutputStream out = getContentResolver().openOutputStream(uri)) {
                                                if (out != null) {
                                                    out.write(bytes);
                                                    out.flush();
                                                }
                                            }
                                        }
                                    }

                                    java.io.File exportDir = new java.io.File(getCacheDir(), "exports");
                                    if (!exportDir.exists()) exportDir.mkdirs();
                                    java.io.File cacheFile = new java.io.File(exportDir, safeName);
                                    try (java.io.FileOutputStream fos = new java.io.FileOutputStream(cacheFile)) {
                                        fos.write(bytes);
                                        fos.flush();
                                    }

                                    android.net.Uri contentUri = androidx.core.content.FileProvider.getUriForFile(
                                            MainActivity.this,
                                            getPackageName() + ".fileprovider",
                                            cacheFile
                                    );

                                    runOnUiThread(() -> {
                                        try {
                                            android.content.Intent shareIntent = new android.content.Intent(android.content.Intent.ACTION_SEND);
                                            shareIntent.setType(safeMime);
                                            shareIntent.putExtra(android.content.Intent.EXTRA_STREAM, contentUri);
                                            shareIntent.setClipData(android.content.ClipData.newRawUri("", contentUri));
                                            shareIntent.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                            android.content.Intent chooser = android.content.Intent.createChooser(shareIntent, "حفظ أو مشاركة: " + safeName);
                                            chooser.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                            startActivity(chooser);
                                        } catch (Exception ex) {
                                            ex.printStackTrace();
                                        }
                                    });
                                    return true;
                                } catch (Exception e) {
                                    e.printStackTrace();
                                    return false;
                                }
                            }
                        }, "AndroidNativeFile");
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }
}
