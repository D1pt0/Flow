package app.flow.player;
import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.WebView;
import java.io.File;
import java.util.*;
/** Disposable media metadata and WebView resources. User libraries use separate stores. */
final class CachePolicy {
 static final long WEEK=7L*24*60*60*1000, LIMIT=32L*1024*1024;
 static void prune(Context context,WebView web){
  long now=System.currentTimeMillis();
  for(String name:new String[]{"online-artwork-v1","movie-info"}){
   SharedPreferences cache=context.getSharedPreferences(name,0);
   SharedPreferences.Editor edit=cache.edit();
   for(Map.Entry<String,?> entry:cache.getAll().entrySet()){
    String key=entry.getKey();if(key.startsWith("checked:"))continue;
    long checked=cache.getLong("checked:"+key,0);
    if(checked==0||now-checked>=WEEK){edit.remove(key);edit.remove("checked:"+key);}
   }
   edit.apply();
  }
  SharedPreferences charts=context.getSharedPreferences("charts",0);
  if(now-charts.getLong("time",0)>=WEEK)charts.edit().clear().apply();
  SharedPreferences housekeeping=context.getSharedPreferences("cache-policy",0);
  long last=housekeeping.getLong("web-cleared",0);
  long bytes=size(context.getCacheDir())+size(new File(context.getApplicationInfo().dataDir,"app_webview"));
  if(now-last>=WEEK||bytes>LIMIT){web.clearCache(true);housekeeping.edit().putLong("web-cleared",now).apply();}
  trim(context.getCacheDir(),now-WEEK,false);
  ArrayList<File> remaining=new ArrayList<>();collect(context.getCacheDir(),remaining);
  remaining.sort(Comparator.comparingLong(File::lastModified));
  long total=size(context.getCacheDir());
  for(File file:remaining){if(total<=LIMIT)break;long length=file.length();if(file.delete())total-=length;}

 }
 static void clear(Context context,WebView web){
  for(String name:new String[]{"online-artwork-v1","movie-info","charts"})context.getSharedPreferences(name,0).edit().clear().apply();
  web.clearCache(true);
  trim(context.getCacheDir(),Long.MAX_VALUE,true);
  context.getSharedPreferences("cache-policy",0).edit().putLong("web-cleared",System.currentTimeMillis()).apply();
 }
 private static void collect(File directory,List<File> result){
  File[] files=directory.listFiles();if(files==null)return;
  for(File file:files)try{if(!file.getCanonicalPath().startsWith(directory.getCanonicalPath()+File.separator))continue;if(file.isDirectory())collect(file,result);else result.add(file);}catch(Exception ignored){}
 }
 private static long size(File file){if(file.isFile())return file.length();long total=0;File[] files=file.listFiles();if(files!=null)for(File child:files)total+=size(child);return total;}
 private static void trim(File root,long cutoff,boolean all){
  try{trimInside(root,root.getCanonicalPath()+File.separator,cutoff,all);}catch(Exception ignored){}
 }
 private static void trimInside(File folder,String allowed,long cutoff,boolean all)throws Exception{
  File[] children=folder.listFiles();if(children==null)return;
  for(File file:children){
   if(!file.getCanonicalPath().startsWith(allowed))continue;
   if(file.isDirectory())trimInside(file,allowed,cutoff,all);
   else if(all||file.lastModified()<cutoff)file.delete();
  }
 }
}
