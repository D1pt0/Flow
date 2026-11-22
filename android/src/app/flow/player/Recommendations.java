package app.flow.player;
import android.content.Context;
import org.json.*;
import java.net.*;
import java.io.*;
import java.util.regex.*;
/** Public IMDb charts, cached daily. Chart availability never blocks the server catalog. */
final class Recommendations {
 static JSONArray load(Context context)throws Exception{
  android.content.SharedPreferences cache=context.getSharedPreferences("charts",0);
  String old=cache.getString("items","[]");
  if(System.currentTimeMillis()-cache.getLong("time",0)<86400000L)return new JSONArray(old);
  JSONArray result=new JSONArray();
  for(String chart:new String[]{"top","toptv","moviemeter","tvmeter"}){
   try{
    HttpURLConnection connection=(HttpURLConnection)new URL("https://www.imdb.com/chart/"+chart+"/").openConnection();
    connection.setConnectTimeout(8000);connection.setReadTimeout(10000);connection.setRequestProperty("User-Agent","Mozilla/5.0");
    try{
     if(connection.getResponseCode()!=200)continue;
     ByteArrayOutputStream bytes=new ByteArrayOutputStream();
     try(InputStream input=connection.getInputStream()){byte[] buffer=new byte[8192];int n;while((n=input.read(buffer))!=-1){bytes.write(buffer,0,n);if(bytes.size()>8000000)throw new IOException();}}
     Matcher script=Pattern.compile("<script[^>]*type=[\"']application/ld\\+json[\"'][^>]*>([\\s\\S]*?)</script>").matcher(bytes.toString("UTF-8"));
     while(script.find()){
      JSONObject data=new JSONObject(script.group(1));JSONArray list=data.optJSONArray("itemListElement");if(list==null)continue;
      for(int i=0;i<list.length();i++){
       JSONObject entry=list.getJSONObject(i).optJSONObject("item");if(entry==null)continue;
       String date=entry.optString("datePublished");JSONObject rating=entry.optJSONObject("aggregateRating");
       result.put(new JSONObject().put("name",entry.optString("name")).put("year",date.length()>=4?date.substring(0,4):"").put("rating",rating==null?0:rating.optDouble("ratingValue",0)).put("chart",chart).put("rank",i+1).put("source",entry.optString("url")));
      }
     }
    }finally{connection.disconnect();}
   }catch(Exception ignored){}
  }
  if(result.length()==0)return new JSONArray(old);
  cache.edit().putString("items",result.toString()).putLong("time",System.currentTimeMillis()).apply();return result;
 }
}
