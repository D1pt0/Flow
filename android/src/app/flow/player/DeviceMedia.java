package app.flow.player;
import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import org.json.*;
import java.util.*;
/** Shared media indexed by Android, excluding app data and short game assets. */
final class DeviceMedia {
 static JSONArray files(Context context)throws Exception {
  JSONArray items=new JSONArray();
  Uri[] stores={MediaStore.Video.Media.EXTERNAL_CONTENT_URI,MediaStore.Audio.Media.EXTERNAL_CONTENT_URI};
  for(int type=0;type<stores.length;type++){
   String permission=Build.VERSION.SDK_INT>=33?(type==0?"android.permission.READ_MEDIA_VIDEO":"android.permission.READ_MEDIA_AUDIO"):"android.permission.READ_EXTERNAL_STORAGE";
   if(context.checkSelfPermission(permission)!=android.content.pm.PackageManager.PERMISSION_GRANTED)continue;
   String folderColumn=Build.VERSION.SDK_INT>=29?"relative_path":"_data";
   String[] columns={"_id","_display_name",folderColumn,"duration","_size"};
   try(Cursor rows=context.getContentResolver().query(stores[type],columns,null,null,null)){
    if(rows==null)continue;
    while(rows.moveToNext()){
     String folder=rows.getString(2);if(folder==null)folder="Media/";
     if(Build.VERSION.SDK_INT<29)folder=folder.substring(0,Math.max(0,folder.lastIndexOf('/')+1));
     String lower=folder.toLowerCase(Locale.ROOT);
     if(lower.contains("/android/")||lower.startsWith("android/")||lower.contains("/cache/")||lower.contains("/.")||rows.getLong(3)<30000||rows.getLong(4)<262144)continue;
     items.put(new JSONObject().put("url",ContentUris.withAppendedId(stores[type],rows.getLong(0)).toString()).put("name",rows.getString(1)).put("folder",folder).put("local",true).put("audio",type==1).put("directory",false));
    }
   }
  }
  return items;
 }
 static JSONArray roots(Context c)throws Exception{
  TreeSet<String> folders=new TreeSet<>(String.CASE_INSENSITIVE_ORDER);JSONArray media=files(c),result=new JSONArray();
  for(int i=0;i<media.length();i++)folders.add(media.getJSONObject(i).getString("folder"));
  for(String folder:folders)result.put(new JSONObject().put("name",folder).put("url","flowmedia:"+Uri.encode(folder)).put("directory",true).put("local",true));
  return result;
 }
 static JSONObject list(Context c,String address)throws Exception{
  String folder=Uri.decode(address.substring("flowmedia:".length()));JSONArray all=files(c),result=new JSONArray();
  for(int i=0;i<all.length();i++){JSONObject item=all.getJSONObject(i);if(folder.equals(item.optString("folder")))result.put(item);}
  return new JSONObject().put("url",address).put("files",result);
 }
}
