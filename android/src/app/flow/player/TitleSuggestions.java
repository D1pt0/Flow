package app.flow.player;
import org.json.*;
import java.net.URLEncoder;
import java.util.*;
/** Small on-demand title suggestions. No artwork downloads or persistent cache. */
final class TitleSuggestions {
 static JSONArray fetch(String query)throws Exception{
  String encoded=URLEncoder.encode(query.trim().toLowerCase(Locale.ROOT),"UTF-8").replace("+","%20");
  return parse(MovieInfo.get("https://v3.sg.media-imdb.com/suggestion/x/"+encoded+".json"));
 }
 static JSONArray parse(JSONObject response)throws Exception{
  JSONArray entries=response.optJSONArray("d"),result=new JSONArray();
  if(entries==null)return result;
  for(int i=0;i<entries.length()&&result.length()<8;i++){
   JSONObject item=entries.optJSONObject(i);
   if(item==null||!item.optString("id").matches("tt[0-9]+"))continue;
   if(!Arrays.asList("movie","tvSeries","tvMiniSeries","tvMovie").contains(item.optString("qid")))continue;
   result.put(new JSONObject().put("name",item.optString("l")).put("year",item.optInt("y",0)));
  }
  return result;
 }
}
