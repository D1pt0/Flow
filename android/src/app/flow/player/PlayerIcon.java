package app.flow.player;
import android.content.Context;import android.graphics.*;import android.graphics.drawable.*;import android.widget.Button;
/** Small vector controls drawn locally; no font/icon service dependency. */
final class PlayerIcon extends Button {
 private String icon,badge="1×";private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);private int colour=Color.WHITE;
 PlayerIcon(Context c,String name,String label){super(c);icon=name;setText("");setAllCaps(false);setMinWidth(0);setMinimumWidth(0);setPadding(0,0,0,0);setContentDescription(label);setTooltipText(label);GradientDrawable bg=new GradientDrawable();bg.setColor(0x08000000);bg.setShape(GradientDrawable.OVAL);setBackground(new RippleDrawable(android.content.res.ColorStateList.valueOf(0x50ffffff),bg,null));}
 void badge(String value){badge=value;invalidate();}void icon(String value){icon=value;invalidate();}void colour(int value){colour=value;invalidate();}
 @Override protected void onDraw(Canvas c){int save=c.save();float size=Math.min(getWidth(),getHeight())*.53f;c.translate((getWidth()-size)/2,(getHeight()-size)/2);c.scale(size/24,size/24);paint.setColor(colour);paint.setAlpha(isEnabled()?255:70);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1.8f);paint.setStrokeCap(Paint.Cap.ROUND);paint.setStrokeJoin(Paint.Join.ROUND);
  switch(icon){case "back":path(c,16,4,8,12,16,20);break;case "close":path(c,5,5,19,19);path(c,19,5,5,19);break;
  case "play":paint.setStyle(Paint.Style.FILL);path(c,8,4,20,12,8,20,8,4);break;case "pause":paint.setStyle(Paint.Style.FILL);c.drawRoundRect(6,4,9.5f,20,1,1,paint);c.drawRoundRect(14.5f,4,18,20,1,1,paint);break;
  case "previous":paint.setStyle(Paint.Style.FILL);c.drawRect(4,5,7,19,paint);path(c,19,5,9,12,19,19,19,5);break;case "next":paint.setStyle(Paint.Style.FILL);c.drawRect(17,5,20,19,paint);path(c,5,5,15,12,5,19,5,5);break;
  case "audio":path(c,10,17,10,4,20,2,20,15);c.drawOval(3,15,10,20,paint);c.drawOval(13,13,20,18,paint);break;
  case "subtitles":c.drawRoundRect(3,5,21,19,1,1,paint);path(c,6,10,10,10);path(c,14,10,18,10);path(c,6,15,10,15);path(c,14,15,18,15);break;
  case "more":paint.setStyle(Paint.Style.FILL);for(int y=4;y<=20;y+=8)c.drawCircle(12,y,1.7f,paint);break;
  case "speed":paint.setStyle(Paint.Style.FILL);paint.setTextAlign(Paint.Align.CENTER);paint.setTypeface(Typeface.create("sans-serif",Typeface.BOLD));paint.setTextSize(badge.length()>3?8:10);c.drawText(badge,12,16,paint);break;
  case "equalizer":case "enhance":path(c,5,3,5,21);path(c,12,3,12,21);path(c,19,3,19,21);paint.setStyle(Paint.Style.FILL);c.drawRoundRect(3,7,7,12,1,1,paint);c.drawRoundRect(10,13,14,18,1,1,paint);c.drawRoundRect(17,5,21,10,1,1,paint);break;
  case "camera":path(c,3,7,7,7,9,4,15,4,17,7,21,7,21,20,3,20,3,7);c.drawCircle(12,13,4,paint);break;
  case "headphones":c.drawArc(4,3,20,20,180,180,false,paint);path(c,4,11,4,19,8,19,8,13,4,13);path(c,20,11,20,19,16,19,16,13,20,13);break;
  case "lock":case "unlock":c.drawRoundRect(5,10,19,21,2,2,paint);c.drawArc(8,2,16,14,180,icon.equals("lock")?180:120,false,paint);path(c,12,14,12,17);break;
  case "fullscreen":path(c,3,9,3,3,9,3);path(c,15,3,21,3,21,9);path(c,21,15,21,21,15,21);path(c,9,21,3,21,3,15);break;
  case "exitfullscreen":path(c,3,9,9,9,9,3);path(c,15,3,15,9,21,9);path(c,21,15,15,15,15,21);path(c,9,21,9,15,3,15);break;
  case "fit":c.drawRoundRect(2,4,22,20,1,1,paint);path(c,6,9,6,7,9,7);path(c,15,17,18,17,18,14);break;
  case "rotate":c.drawArc(3,3,21,21,25,135,false,paint);c.drawArc(3,3,21,21,205,135,false,paint);path(c,3,13,3,18,8,18);path(c,21,11,21,6,16,6);break;
  case "bookmark":path(c,6,3,18,3,18,21,12,17,6,21,6,3);break;
  case "queue":case "chapters":for(int y=5;y<=19;y+=7){c.drawCircle(4,y,.8f,paint);path(c,9,y,21,y);}break;
  case "info":c.drawCircle(12,12,9,paint);path(c,12,11,12,17);c.drawCircle(12,7,.5f,paint);break;
  case "sleep":c.drawCircle(12,12,9,paint);path(c,12,6,12,12,16,15);break;
  case "heart":case "heart-filled":if(icon.endsWith("filled"))paint.setStyle(Paint.Style.FILL);Path h=new Path();h.moveTo(12,21);h.cubicTo(-7,8,5,-3,12,6);h.cubicTo(19,-3,31,8,12,21);c.drawPath(h,paint);break;
  case "brightness":c.drawCircle(12,12,4,paint);for(int i=0;i<8;i++){double a=i*Math.PI/4;c.drawLine(12+(float)Math.cos(a)*7,12+(float)Math.sin(a)*7,12+(float)Math.cos(a)*10,12+(float)Math.sin(a)*10,paint);}break;
  case "volume":path(c,3,9,7,9,12,5,12,19,7,15,3,15,3,9);c.drawArc(10,5,23,19,-60,120,false,paint);break;
  default:c.drawCircle(12,12,7,paint);
  }c.restoreToCount(save);
 }
 private void path(Canvas c,float... points){Path p=new Path();p.moveTo(points[0],points[1]);for(int i=2;i<points.length;i+=2)p.lineTo(points[i],points[i+1]);c.drawPath(p,paint);}
}
