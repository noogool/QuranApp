# Keep JavaScript bridge methods
-keepclassmembers class ir.quran.reader.MainActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
