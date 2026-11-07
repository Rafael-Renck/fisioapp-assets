"""Convert the CC BY 4.0 Stanford pelvis adaptation from OBGynSpace into glTF 2 GLB.
Source/attribution: public/models/NOTICE.txt. Run: python scripts/prepare-pelvis-model.py
"""
import json, struct, requests
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'models'
source = requests.get('https://obgynspace.com/models/pelvis.bin', timeout=30).content
assert source[:4] == b'OBGB'
header_size = struct.unpack_from('<I', source, 4)[0]
header = json.loads(source[8:8+header_size])
payload = memoryview(source)[8+header_size:]
textures = sorted({p['tex'] for p in header['parts']})
images = {name: requests.get(f'https://obgynspace.com/models/tex/{name}.jpg', timeout=30).content for name in textures}
blob = bytearray()
views, accessors, meshes, nodes, materials, image_defs, texture_defs = [], [], [], [], [], [], []

def add_view(data, target=None):
    while len(blob) % 4: blob.append(0)
    offset = len(blob)
    blob.extend(data)
    view = {'buffer':0,'byteOffset':offset,'byteLength':len(data)}
    if target: view['target'] = target
    views.append(view)
    return len(views)-1

for name in textures:
    image_defs.append({'bufferView':add_view(images[name]),'mimeType':'image/jpeg','name':name})
    texture_defs.append({'source':len(image_defs)-1})
    materials.append({'name':name,'pbrMetallicRoughness':{'baseColorTexture':{'index':len(texture_defs)-1},'metallicFactor':0,'roughnessFactor':0.88},'doubleSided':True})

for part in header['parts']:
    nv, ni, off = part['nv'], part['ni'], part['off']
    pos = payload[off:off+nv*6]
    uv = payload[off+nv*6:off+nv*10]
    indices = payload[off+nv*10:off+nv*10+ni*2]
    floats = bytearray(nv*12)
    lo, span = header['min'], header['scale']
    for i in range(nv):
        q = struct.unpack_from('<3H',pos,i*6)
        struct.pack_into('<3f',floats,i*12,*(lo[j]+span[j]*q[j]/65535 for j in range(3)))
    pv = add_view(floats,34962)
    uvv = add_view(uv,34962)
    iv = add_view(indices,34963)
    acc0 = len(accessors)
    accessors += [
        {'bufferView':pv,'componentType':5126,'count':nv,'type':'VEC3','min':part['bounds'][:3],'max':part['bounds'][3:]},
        {'bufferView':uvv,'componentType':5123,'normalized':True,'count':nv,'type':'VEC2'},
        {'bufferView':iv,'componentType':5123,'count':ni,'type':'SCALAR'},
    ]
    meshes.append({'name':part['id'],'primitives':[{'attributes':{'POSITION':acc0,'TEXCOORD_0':acc0+1},'indices':acc0+2,'material':textures.index(part['tex'])}]})
    nodes.append({'name':part['id'],'mesh':len(meshes)-1,'extras':{'group':part['group']}})

gltf = {'asset':{'version':'2.0','generator':'FisioApp Stanford pelvis converter'},'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,'materials':materials,'textures':texture_defs,'images':image_defs,'bufferViews':views,'accessors':accessors,'buffers':[{'byteLength':len(blob)}]}
encoded = json.dumps(gltf,separators=(',',':')).encode()
encoded += b' ' * (-len(encoded)%4)
blob += b'\0' * (-len(blob)%4)
out = b'glTF' + struct.pack('<II',2,12+8+len(encoded)+8+len(blob)) + struct.pack('<I4s',len(encoded),b'JSON')+encoded + struct.pack('<I4s',len(blob),b'BIN\0')+blob
path = ROOT/'stanford-female-pelvis.glb'
path.write_bytes(out)
print(path, len(out), 'bytes', len(nodes), 'meshes')
