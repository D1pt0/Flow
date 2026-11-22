package app.flow.player;
import java.net.*;
import java.io.*;
import java.util.regex.*;
import org.json.*;
/** Anonymous FTP directory listing through Android's URL connection. */
final class FtpDirectory {
 static JSONObject list(URL url)throws Exception{
  URLConnection connection=url.openConnection();connection.setConnectTimeout(12000);connection.setReadTimeout(15000);
  JSONArray files=new JSONArray();
  Pattern unix=Pattern.compile("^([d-])[rwxstST-]{9}\\s+\\d+\\s+\\S+\\s+\\S+\\s+\\d+\\s+\\S+\\s+\\d+\\s+\\S+\\s+(.+)$");
  Pattern dos=Pattern.compile("^\\d{2}-\\d{2}-\\d{2,4}\\s+\\S+\\s+(<DIR>|\\d+)\\s+(.+)$",Pattern.CASE_INSENSITIVE);
  try(BufferedReader reader=new BufferedReader(new InputStreamReader(connection.getInputStream(),"UTF-8"))){
   String line;while((line=reader.readLine())!=null){
    Matcher match=unix.matcher(line);boolean directory;String name;
    if(match.matches()){directory=match.group(1).equals("d");name=match.group(2);}
    else {match=dos.matcher(line);if(!match.matches())continue;directory=match.group(1).equalsIgnoreCase("<DIR>");name=match.group(2);}
    if(name.equals(".")||name.equals(".."))continue;
    if(!directory&&!name.toLowerCase().matches(".*\\.(mp4|mkv|avi|webm|mov|m4v|mp3|m4a|aac|flac|ogg|wav|ts|m3u8)$"))continue;
    String encoded=URLEncoder.encode(name,"UTF-8").replace("+","%20");
    files.put(new JSONObject().put("name",name).put("url",new URL(url,encoded+(directory?"/":"")).toString()).put("directory",directory));
   }
  }
  return new JSONObject().put("url",url.toString()).put("files",files);
 }
}
