package app.flow.player;
final class PlayerTouch {
 static float clamp(float value,float min,float max){return Math.max(min,Math.min(max,value));}
 static int axis(float dx,float dy,float threshold){if(Math.max(Math.abs(dx),Math.abs(dy))<threshold)return 0;return Math.abs(dy)>Math.abs(dx)*1.15f?1:Math.abs(dx)>Math.abs(dy)*1.15f?2:0;}
 static float level(float start,float startY,float currentY,float height){return clamp(start+(startY-currentY)/Math.max(1,height),0,1);}
 static long seek(long start,float dx,float width,long length){long delta=(long)(dx/Math.max(1,width)*120000);return Math.max(0,Math.min(Math.max(0,length),start+delta));}
}
