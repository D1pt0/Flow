package app.flow.player;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.text.Html;
import android.view.View;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.provider.DocumentsContract;
import org.json.*;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.*;

public final class MainActivity extends Activity {
    private WebView web;
    private FrameLayout root;
    private View fullView;
    private WebChromeClient.CustomViewCallback fullCallback;
    private ValueCallback<Uri[]> fileCallback;
    private int oldFlags, oldOrientation;
    private final ExecutorService network=Executors.newFixedThreadPool(3),artNetwork=Executors.newFixedThreadPool(3),infoNetwork=Executors.newFixedThreadPool(2);
    private static final String APP_HOST="flow.local";
    private static final Set<String> MEDIA_HOSTS=new HashSet<>(Arrays.asList("172.16.50.4","172.16.50.7","172.16.50.10","172.16.50.12","172.16.50.14"));

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(17,22,22));
        getWindow().setNavigationBarColor(Color.rgb(17,22,22));
        root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(17,22,22));
        web=new WebView(this);web.setBackgroundColor(Color.rgb(17,22,22));
        root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);
        root.setOnApplyWindowInsetsListener((view,insets)->{
            if(fullView==null)root.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            else root.setPadding(0,0,0,0);
            return insets.consumeSystemWindowInsets();
        });
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        web.addJavascriptInterface(new Bridge(),"FlowAndroid");
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                Uri u=request.getUrl();
                if(!APP_HOST.equals(u.getHost()))return null;
                try{
                    String path=u.getPath();if(path==null||path.equals("/"))path="/index.html";
                    if(path.contains(".."))throw new IOException("Invalid asset path");
                    String type=path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".svg")?"image/svg+xml":"text/html";
                    return new WebResourceResponse(type,"UTF-8",200,"OK",Collections.singletonMap("Cache-Control","no-store"),getAssets().open("web"+path));
                }catch(IOException e){return new WebResourceResponse("text/plain","UTF-8",404,"Not found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                Uri u=request.getUrl();
                // The JavaScript bridge is available only to the bundled UI. Never open remote pages in this WebView.
                return !"https".equals(u.getScheme())||!APP_HOST.equals(u.getHost());
            }
            @Override public void onReceivedSslError(WebView view,android.webkit.SslErrorHandler handler,android.net.http.SslError error){handler.cancel();}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onShowCustomView(View view,CustomViewCallback callback){
                if(fullView!=null){callback.onCustomViewHidden();return;}
                oldFlags=getWindow().getDecorView().getSystemUiVisibility();oldOrientation=getRequestedOrientation();
                fullView=view;fullCallback=callback;web.setVisibility(View.GONE);root.addView(view,new FrameLayout.LayoutParams(-1,-1));
                getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);root.requestApplyInsets();
            }
            @Override public void onHideCustomView(){hideFullscreen();}
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"video/*","audio/*"});intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try{startActivityForResult(intent,10);return true;}catch(Exception e){fileCallback=null;callback.onReceiveValue(null);return true;}
            }
        });
        CachePolicy.prune(this,web);web.loadUrl("https://"+APP_HOST+"/index.html");
    }

    private void hideFullscreen(){
        if(fullView==null)return;
        root.removeView(fullView);fullView=null;web.setVisibility(View.VISIBLE);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(oldFlags);setRequestedOrientation(oldOrientation);root.requestApplyInsets();
        if(fullCallback!=null){WebChromeClient.CustomViewCallback cb=fullCallback;fullCallback=null;cb.onCustomViewHidden();}
    }
    @Override public void onBackPressed(){
        if(fullView!=null){hideFullscreen();return;}
        web.evaluateJavascript("(function(){if(window.flowBack)return window.flowBack();const d=document.querySelector('dialog[open]');if(d){d.close();return true}return false})()",result->{if(!"true".equals(result))finish();});
    }
    @Override public void onConfigurationChanged(Configuration config){super.onConfigurationChanged(config);}
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==10&&fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);fileCallback=null;}
        if(request==11&&result==RESULT_OK&&data!=null){String value=data.getStringExtra("result");if(value!=null)web.evaluateJavascript("window.FlowPlaybackResult&&window.FlowPlaybackResult("+value+")",null);}
        if((request==20||request==21)&&result==RESULT_OK&&data!=null&&data.getData()!=null){
            Uri uri=data.getData();try{getContentResolver().takePersistableUriPermission(uri,data.getFlags()&Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(Exception ignored){}
            try{JSONObject selected=new JSONObject().put("url",uri.toString()).put("name",LocalLibrary.name(this,request==21?DocumentsContract.buildDocumentUriUsingTree(uri,DocumentsContract.getTreeDocumentId(uri)):uri)).put("local",true).put("directory",request==21).put("audio",request==20&&String.valueOf(getContentResolver().getType(uri)).startsWith("audio/"));
                web.evaluateJavascript((request==21?"window.FlowFolderSelected&&window.FlowFolderSelected(":"window.FlowLocalSelected&&window.FlowLocalSelected(")+selected+")",null);
            }catch(Exception e){Toast.makeText(this,"That file or folder could not be opened.",Toast.LENGTH_SHORT).show();}
        }
    }
    @Override protected void onResume(){super.onResume();if(web!=null)CachePolicy.prune(this,web);}
    @Override protected void onPause(){super.onPause();web.evaluateJavascript("document.querySelector('video')?.pause()",null);}
    @Override protected void onDestroy(){network.shutdownNow();artNetwork.shutdownNow();infoNetwork.shutdownNow();if(fileCallback!=null)fileCallback.onReceiveValue(null);web.removeJavascriptInterface("FlowAndroid");web.destroy();super.onDestroy();}

    public final class Bridge {
        @JavascriptInterface public void clearCachedData(String id){runOnUiThread(()->{CachePolicy.clear(MainActivity.this,web);respond(id,true,"true");});}

        @JavascriptInterface public void keepAwake(boolean enabled){runOnUiThread(()->{if(enabled)getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);});}
        @JavascriptInterface public void play(String data) {
            runOnUiThread(() -> {
                try {
                    JSONObject media = new JSONObject(data);
                    String scheme = Uri.parse(media.getString("url")).getScheme();
                    if (!Arrays.asList("http", "https", "ftp", "ftps", "content").contains(scheme)) {
                        throw new IllegalArgumentException("Unsupported media source");
                    }
                    // A folder containing long URLs can exceed the intent budget.
                    // Keep the selected movie playable even if its queue is too large.
                    if (data.length() > 65536) media.remove("queue");
                    startActivityForResult(new Intent(MainActivity.this, PlayerActivity.class)
                            .putExtra("media", media.toString()), 11);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "This media source could not be opened.", Toast.LENGTH_LONG).show();
                }
            });
        }
        @JavascriptInterface public void pickFile(){runOnUiThread(()->{Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("*/*");intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"video/*","audio/*","application/octet-stream"});intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);startActivityForResult(intent,20);});}
        @JavascriptInterface public void pickFolder(){runOnUiThread(()->{Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);startActivityForResult(intent,21);});}
        @JavascriptInterface public void localFolders(String id){runOnUiThread(()->{
            String[] needed=android.os.Build.VERSION.SDK_INT>=33?new String[]{"android.permission.READ_MEDIA_VIDEO","android.permission.READ_MEDIA_AUDIO"}:new String[]{"android.permission.READ_EXTERNAL_STORAGE"};
            boolean missing=false;for(String permission:needed)if(checkSelfPermission(permission)!=android.content.pm.PackageManager.PERMISSION_GRANTED)missing=true;
            if(missing){mediaRequest=id;requestPermissions(needed,61);}else scanMedia(id);
        });}
        @JavascriptInterface public void suggestions(String query,String id){
            if(query==null||query.length()>120||id==null||id.length()>64)return;
            artNetwork.execute(()->{try{respond(id,true,TitleSuggestions.fetch(query).toString());}catch(Exception e){respond(id,true,"[]");}});
        }
        @JavascriptInterface public void recommendations(String id){infoNetwork.execute(()->{try{respond(id,true,Recommendations.load(MainActivity.this).toString());}catch(Exception e){respond(id,true,"[]");}});}
        @JavascriptInterface public void artwork(String title,String year,String id){if(title==null||year==null||id==null||id.length()>64)return;artNetwork.execute(()->{try{respond(id,true,MovieArt.lookup(MainActivity.this,title,year).toString());}catch(Exception e){respond(id,false,JSONObject.quote("Online artwork is unavailable."));}});}
        @JavascriptInterface public void movieInfo(String title,String year,String id){if(title==null||year==null||id==null||id.length()>64)return;infoNetwork.execute(()->{try{respond(id,true,MovieInfo.lookup(MainActivity.this,title,year).toString());}catch(Exception e){respond(id,false,JSONObject.quote("Online movie information is unavailable. Playback still works without it."));}});}
        @JavascriptInterface public void browse(String address,String id){
            if(id==null||id.length()>64||address==null||address.length()>8192)return;
            network.execute(()->{
                try{JSONObject data=address.startsWith("flowmedia:")?DeviceMedia.list(MainActivity.this,address):address.startsWith("content:")?LocalLibrary.list(MainActivity.this,address):list(address);respond(id,true,data.toString());}
                catch(Exception error){respond(id,false,JSONObject.quote("Cannot reach this server. Check its address and connect to the network that provides it."));}
            });
        }
    }
    private String mediaRequest;
    private void scanMedia(String id){network.execute(()->{try{JSONArray roots=DeviceMedia.roots(this);JSONArray manual=LocalLibrary.roots(this);for(int i=0;i<manual.length();i++)roots.put(manual.get(i));respond(id,true,roots.toString());}catch(Exception e){respond(id,false,JSONObject.quote("Media access was not granted. You can still add a folder."));}});}
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==61&&mediaRequest!=null){String id=mediaRequest;mediaRequest=null;scanMedia(id);}}
    private void respond(String id,boolean ok,String data){runOnUiThread(()->{
        if(isFinishing()||isDestroyed()||web.getUrl()==null||!APP_HOST.equals(Uri.parse(web.getUrl()).getHost()))return;
        web.evaluateJavascript("window.FlowNativeResult&&window.FlowNativeResult("+JSONObject.quote(id)+","+ok+","+data+")",null);
    });}
    private static URL allowed(String value)throws Exception{
        URL url=new URL(value);
        if(!Arrays.asList("http","https","ftp").contains(url.getProtocol())||url.getHost().isEmpty()||url.getUserInfo()!=null)throw new IOException("Unsupported host");
        return url;
    }
    private static JSONObject list(String address)throws Exception{
        URL url=allowed(address);if(url.getProtocol().equals("ftp"))return FtpDirectory.list(url);String html=null;
        for(int redirects=0;redirects<5;redirects++){
            HttpURLConnection connection=(HttpURLConnection)url.openConnection();connection.setConnectTimeout(12000);connection.setReadTimeout(20000);connection.setInstanceFollowRedirects(false);connection.setRequestProperty("User-Agent","Flow-Android/1.0");
            try{
                int status=connection.getResponseCode();
                if(status>=300&&status<400){url=allowed(new URL(url,connection.getHeaderField("Location")).toString());continue;}
                if(status!=200)throw new IOException("HTTP "+status);
                try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                    byte[] buf=new byte[16384];int count;
                    while((count=in.read(buf))!=-1){out.write(buf,0,count);if(out.size()>8*1024*1024)throw new IOException("Directory too large");}
                    html=out.toString("UTF-8");break;
                }
            }finally{connection.disconnect();}
        }
        if(html==null)throw new IOException("Too many redirects");
        Pattern anchors=Pattern.compile("<a\\b[^>]*href\\s*=\\s*[\"']([^\"']+)[\"'][^>]*>([\\s\\S]*?)</a>",Pattern.CASE_INSENSITIVE);
        Matcher matcher=anchors.matcher(html);Set<String> seen=new HashSet<>();ArrayList<JSONObject> items=new ArrayList<>();
        String artwork=null;int artworkRank=-1;
        while(matcher.find()){
            try{
                String href=Html.fromHtml(matcher.group(1),Html.FROM_HTML_MODE_LEGACY).toString();
                if(href.startsWith("#")||href.equals("..")||href.equals("../"))continue;
                URL link=allowed(new URL(url,href).toString());String name=Html.fromHtml(matcher.group(2),Html.FROM_HTML_MODE_LEGACY).toString().trim();boolean dir=link.getPath().endsWith("/");
                String imagePath=link.getPath().toLowerCase(Locale.ROOT);
                if(imagePath.matches(".*\\.(jpg|jpeg|png|webp)$")){
                    int rank=imagePath.contains("poster")?3:imagePath.contains("cover")?2:1;
                    if(rank>artworkRank){artwork=link.toString();artworkRank=rank;}
                    continue;
                }
                if(name.isEmpty()||link.toString().equals(url.toString())||!seen.add(link.toString())||(!dir&&!link.getPath().toLowerCase(Locale.ROOT).matches(".*\\.(mp4|mkv|webm|avi|mov|ts|m2ts|mpg|mpeg|m4v|wmv|flv|3gp|3g2|vob|ogv|mp3|m4a|aac|wav|ogg|opus|flac|ac3|eac3|dts|aiff|aif|wma|mka|m3u8|mpd)$")))continue;
                items.add(new JSONObject().put("name",name).put("url",link.toString()).put("directory",dir));
            }catch(Exception ignored){}
        }
        items.sort((a,b)->{int folders=Boolean.compare(b.optBoolean("directory"),a.optBoolean("directory"));return folders!=0?folders:a.optString("name").compareToIgnoreCase(b.optString("name"));});
        JSONArray files=new JSONArray();for(JSONObject item:items)files.put(item);
        JSONObject result=new JSONObject().put("url",url.toString()).put("files",files);
        if(artwork!=null)result.put("artwork",artwork);
        return result;
    }
}
