"""Convert the CC BY 4.0 term-fetus mesh from OBGynSpace to glTF 2 GLB.
Source and adaptation: public/models/NOTICE.txt.
"""
import json, math, struct, requests
from pathlib import Path

root=Path(__file__).resolve().parents[1]/'public'/'models'
source=requests.get('https://obgynspace.com/models/embryo.bin',timeout=30).content
assert source[:4]==b'OBGB'
size=struct.unpack_from('<I',source,4)[0]
header=json.loads(source[8:8+size])
part=next(x for x in header['parts'] if x['id']=='fetus3t')
offset=8+size+part['off']; count=part['nv']; index_count=part['ni']
positions=[]
for i in range(count):
    q=struct.unpack_from('<3H',source,offset+i*6)
    positions.extend(header['min'][j]+header['scale'][j]*q[j]/65535 for j in range(3))
indices=struct.unpack_from('<'+str(index_count)+'H',source,offset+count*6)
normals=[0.0]*(count*3)
for i in range(0,index_count,3):
    a,b,c=indices[i:i+3]
    ax,ay,az=positions[a*3:a*3+3];bx,by,bz=positions[b*3:b*3+3];cx,cy,cz=positions[c*3:c*3+3]
    ux,uy,uz=bx-ax,by-ay,bz-az;vx,vy,vz=cx-ax,cy-ay,cz-az
    nx,ny,nz=uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx
    for j in [a,b,c]:
        normals[j*3]+=nx;normals[j*3+1]+=ny;normals[j*3+2]+=nz
for i in range(count):
    x,y,z=normals[i*3:i*3+3];length=math.sqrt(x*x+y*y+z*z) or 1
    normals[i*3:i*3+3]=[x/length,y/length,z/length]
position_bytes=struct.pack('<'+str(count*3)+'f',*positions)
normal_bytes=struct.pack('<'+str(count*3)+'f',*normals)
index_bytes=struct.pack('<'+str(index_count)+'H',*indices)
blob=bytearray();views=[]
for data,target in [(position_bytes,34962),(normal_bytes,34962),(index_bytes,34963)]:
    while len(blob)%4:blob.append(0)
    views.append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data),'target':target});blob.extend(data)
gltf={'asset':{'version':'2.0','generator':'FisioApp birth model converter'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'fetus','mesh':0}],'meshes':[{'name':'term-fetus','primitives':[{'attributes':{'POSITION':0,'NORMAL':1},'indices':2,'material':0}]}],'materials':[{'name':'tissue','pbrMetallicRoughness':{'baseColorFactor':[0.91,0.62,0.51,1],'metallicFactor':0,'roughnessFactor':0.78},'doubleSided':True}],'accessors':[{'bufferView':0,'componentType':5126,'count':count,'type':'VEC3','min':part['bounds'][:3],'max':part['bounds'][3:]},{'bufferView':1,'componentType':5126,'count':count,'type':'VEC3'},{'bufferView':2,'componentType':5123,'count':index_count,'type':'SCALAR'}],'bufferViews':views,'buffers':[{'byteLength':len(blob)}]}
encoded=json.dumps(gltf,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);blob+=b'\0'*(-len(blob)%4)
out=b'glTF'+struct.pack('<II',2,12+8+len(encoded)+8+len(blob))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(blob),b'BIN\0')+blob
path=root/'term-fetus.glb';path.write_bytes(out)
print(path,len(out),'bytes')
