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
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }
}
