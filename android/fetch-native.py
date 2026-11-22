from pathlib import Path
import urllib.request,hashlib,zipfile,argparse
parser=argparse.ArgumentParser();parser.add_argument('--directory',type=Path,required=True);args=parser.parse_args();root=args.directory.resolve();root.mkdir(parents=True,exist_ok=True)
items=[('r8-build','https://dl.google.com/dl/android/maven2/com/android/tools/r8/9.5.33/r8-9.5.33.jar'),('libvlc','https://repo.maven.apache.org/maven2/org/videolan/android/libvlc-all/3.7.7/libvlc-all-3.7.7.aar'),('annotation-jvm','https://dl.google.com/dl/android/maven2/androidx/annotation/annotation-jvm/1.7.1/annotation-jvm-1.7.1.jar'),('collection','https://dl.google.com/dl/android/maven2/androidx/collection/collection/1.0.0/collection-1.0.0.jar'),('core','https://dl.google.com/dl/android/maven2/androidx/core/core/1.0.0/core-1.0.0.aar'),('livedata','https://dl.google.com/dl/android/maven2/androidx/lifecycle/lifecycle-livedata-core/2.0.0/lifecycle-livedata-core-2.0.0.aar'),('lifecycle','https://dl.google.com/dl/android/maven2/androidx/lifecycle/lifecycle-common/2.0.0/lifecycle-common-2.0.0.jar'),('arch-common','https://dl.google.com/dl/android/maven2/androidx/arch/core/core-common/2.0.0/core-common-2.0.0.jar'),('arch-runtime','https://dl.google.com/dl/android/maven2/androidx/arch/core/core-runtime/2.0.0/core-runtime-2.0.0.aar'),('kotlin','https://repo.maven.apache.org/maven2/org/jetbrains/kotlin/kotlin-stdlib/2.2.10/kotlin-stdlib-2.2.10.jar')]
for name,url in items:
 suffix='.'+url.rsplit('.',1)[-1];path=root/(name+suffix)
 if not path.exists():
  print('Downloading '+name,flush=True);urllib.request.urlretrieve(url,path)
 expected=urllib.request.urlopen(url+'.sha1',timeout=30).read().decode().strip().split()[0]
 assert hashlib.sha1(path.read_bytes()).hexdigest()==expected,name+' checksum mismatch'
 if suffix=='.aar':
  with zipfile.ZipFile(path) as archive:archive.extractall(root/name)
 print(name+' ready',flush=True)
