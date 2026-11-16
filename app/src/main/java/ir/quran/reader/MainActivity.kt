package ir.quran.reader

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * کل رابط کاربری (HTML/CSS/JS) داخل assets است و با WebView نمایش داده می‌شود.
 * همه‌ی درخواست‌های https://app.local/... مستقیماً از assets (یا فایل دریافت‌شده) پاسخ داده می‌شوند
 * و هیچ ترافیک شبکه‌ای نمی‌سازند.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val host = "app.local"
    private val dataFile: File get() = File(filesDir, "quran.json")

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        webView.setBackgroundColor(0xFFFBF7EE.toInt())
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.settings.textZoom = 100

        webView.addJavascriptInterface(Bridge(), "Android")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val uri = request.url
                // هر درخواست به بیرون از اپ مسدود می‌شود
                if (uri.host != host) return notFound()
                return serve(uri.path ?: "/")
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    "window.handleBack ? window.handleBack() : false"
                ) { result ->
                    if (result != "true") {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        })

        webView.loadUrl("https://$host/index.html")
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    // ---------------------------------------------------------------- serving

    private fun serve(path: String): WebResourceResponse {
        val name = path.trimStart('/').ifEmpty { "index.html" }
        if (name.contains("..")) return notFound()
        return try {
            if (name == "quran.json") {
                val stream: InputStream =
                    if (dataFile.exists()) FileInputStream(dataFile) else assets.open("quran.json")
                WebResourceResponse("application/json", "UTF-8", stream)
            } else {
                WebResourceResponse(mimeOf(name), "UTF-8", assets.open(name))
            }
        } catch (e: IOException) {
            notFound()
        }
    }

    private fun notFound(): WebResourceResponse =
        WebResourceResponse(
            "text/plain", "UTF-8", 404, "Not Found",
            emptyMap(), ByteArrayInputStream(ByteArray(0))
        )

    private fun mimeOf(name: String): String = when (name.substringAfterLast('.', "").lowercase()) {
        "html" -> "text/html"
        "js" -> "text/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "woff2" -> "font/woff2"
        "woff" -> "font/woff"
        "ttf" -> "font/ttf"
        "otf" -> "font/otf"
        else -> "application/octet-stream"
    }

    // ----------------------------------------------------------------- bridge

    inner class Bridge {

        /** دریافت یک‌باره‌ی متن قرآن (آیات + شماره‌ی جزء و صفحه) */
        @JavascriptInterface
        fun downloadQuran() {
            Thread {
                val ok = try {
                    download()
                    true
                } catch (e: Exception) {
                    false
                }
                runOnUiThread {
                    webView.evaluateJavascript(
                        "window.onDownloaded && window.onDownloaded($ok)", null
                    )
                }
            }.start()
        }

        /** اگر فایل دریافت‌شده خراب بود، پاکش می‌کند تا دوباره دریافت شود */
        @JavascriptInterface
        fun resetData() {
            dataFile.delete()
        }

        @JavascriptInterface
        fun shareText(text: String) {
            runOnUiThread {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                startActivity(Intent.createChooser(intent, null))
            }
        }
    }

    private fun download() {
        val conn = URL("https://api.alquran.cloud/v1/quran/quran-uthmani")
            .openConnection() as HttpURLConnection
        conn.connectTimeout = 20_000
        conn.readTimeout = 60_000
        try {
            if (conn.responseCode != 200) throw IOException("HTTP ${conn.responseCode}")
            val tmp = File(filesDir, "quran.json.tmp")
            conn.inputStream.use { input ->
                FileOutputStream(tmp).use { out -> input.copyTo(out) }
            }
            if (tmp.length() < 500_000L) {
                tmp.delete()
                throw IOException("incomplete download")
            }
            if (!tmp.renameTo(dataFile)) throw IOException("cannot save file")
        } finally {
            conn.disconnect()
        }
    }
}
