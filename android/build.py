from pathlib import Path
import argparse, subprocess, os, json, secrets, zipfile, shutil, hashlib

parser=argparse.ArgumentParser(description='Build and locally sign Flow for Android using official Android SDK tools.')
parser.add_argument('--java-home',type=Path,required=True)
parser.add_argument('--platform',type=Path,required=True,help='SDK platform directory containing android.jar')
parser.add_argument('--build-tools',type=Path,required=True)
parser.add_argument('--work',type=Path,required=True,help='Build scratch directory; signing key is retained here')
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--native',type=Path,required=True,help='Directory prepared by fetch-native.py')
args=parser.parse_args()
root=Path(__file__).resolve().parent
work=args.work.resolve();work.mkdir(parents=True,exist_ok=True)
java=args.java_home.resolve()/'bin/java.exe';javac=args.java_home.resolve()/'bin/javac.exe';keytool=args.java_home.resolve()/'bin/keytool.exe'
tools=args.build_tools.resolve();android=args.platform.resolve()/'android.jar';native=args.native.resolve()
environment=os.environ.copy();environment['JAVA_HOME']=str(args.java_home.resolve())
def run(command,**kwargs):
 subprocess.run([str(c) for c in command],check=True,env=environment,**kwargs)
for name in ('classes','dex','generated'):
 target=(work/name).resolve()
 if target.parent!=work:raise RuntimeError('Build scratch path escaped workspace')
 if target.exists():shutil.rmtree(target)
 target.mkdir()
deps=[native/'libvlc/classes.jar',native/'annotation-jvm.jar',native/'collection.jar',native/'core/classes.jar',native/'livedata/classes.jar',native/'lifecycle.jar',native/'arch-common.jar',native/'arch-runtime/classes.jar',native/'kotlin.jar']
for dep in deps:
 if not dep.is_file():raise RuntimeError('Run fetch-native.py first: missing '+str(dep))
resources=[]
for i,res in enumerate([native/'libvlc/res',native/'core/res',native/'livedata/res',native/'arch-runtime/res',root/'res']):
 if res.is_dir() and any(res.rglob('*.xml')):
  compiled=work/('resources-'+str(i)+'.zip');run([tools/'aapt2.exe','compile','--dir',res,'-o',compiled]);resources.append(compiled)
run([tools/'aapt2.exe','link','-o',work/'resources.apk','--manifest',root/'AndroidManifest.xml','-I',android,*resources,'--auto-add-overlay','--extra-packages','org.videolan:androidx.core:androidx.lifecycle:androidx.arch.core','--java',work/'generated'])
run([javac,'-encoding','UTF-8','-source','8','-target','8','-bootclasspath',str(android)+os.pathsep+str(tools/'core-lambda-stubs.jar'),'-classpath',os.pathsep.join(str(d) for d in deps),'-d',work/'classes',*root.glob('src/**/*.java'),*(work/'generated').rglob('*.java')])
run([java,'-cp',native/'r8-build.jar','com.android.tools.r8.D8','--min-api','26','--lib',android,'--output',work/'dex',*(work/'classes').rglob('*.class'),*deps])
unsigned=work/'unsigned.apk';shutil.copy2(work/'resources.apk',unsigned)
with zipfile.ZipFile(unsigned,'a',compression=zipfile.ZIP_DEFLATED) as apk:
 for asset in (root/'assets').rglob('*'):
  if asset.is_file():apk.write(asset,'assets/'+asset.relative_to(root/'assets').as_posix())
 for dex in (work/'dex').glob('*.dex'):apk.write(dex,dex.name)
 for lib in (native/'libvlc/jni').rglob('*.so'):apk.write(lib,'lib/'+lib.relative_to(native/'libvlc/jni').as_posix())
 for asset in (native/'libvlc/assets').rglob('*'):
  if asset.is_file():apk.write(asset,'assets/'+asset.relative_to(native/'libvlc/assets').as_posix())
run([tools/'zipalign.exe','-P','16','-f','4',unsigned,work/'aligned.apk'])
signing=work/'signing.json';keystore=work/'flow-signing.p12'
if signing.exists():password=json.loads(signing.read_text())['password']
else:
 password=secrets.token_urlsafe(32);signing.write_text(json.dumps({'password':password}))
environment['FLOW_SIGNING_PASSWORD']=password
if not keystore.exists():
 run([keytool,'-genkeypair','-keystore',keystore,'-storetype','PKCS12','-alias','flow','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Flow Local Android Build','-storepass:env','FLOW_SIGNING_PASSWORD','-keypass:env','FLOW_SIGNING_PASSWORD'])
output=args.output.resolve();output.parent.mkdir(parents=True,exist_ok=True)
run([java,'-jar',tools/'lib/apksigner.jar','sign','--ks',keystore,'--ks-key-alias','flow','--ks-pass','env:FLOW_SIGNING_PASSWORD','--key-pass','env:FLOW_SIGNING_PASSWORD','--out',output,work/'aligned.apk'])
run([java,'-jar',tools/'lib/apksigner.jar','verify','--verbose',output])
run([tools/'zipalign.exe','-P','16','-c','4',output])
run([tools/'aapt2.exe','dump','badging',output])
print('APK: '+str(output))
print('SHA256: '+hashlib.sha256(output.read_bytes()).hexdigest())
