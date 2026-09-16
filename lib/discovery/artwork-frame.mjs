// Eight UV panels preserve the supplied carving while leaving the artwork opening clear.
const references=[{size:1400,x:[222,354,1063,1187],y:[72,200,1150,1284]},{size:1100,x:[150,309,790,944],y:[83,238,819,977]}];
function panels(THREE,x,y,rim,ref){
  const xs=[-x-rim,-x,x,x+rim],ys=[y+rim,y,-y,-y-rim],p=[],uv=[];
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){
    if(row===1&&col===1)continue;
    for(const [a,b]of [[0,0],[0,1],[1,0],[1,0],[0,1],[1,1]]){p.push(xs[col+a],ys[row+b],.082);uv.push(ref.x[col+a]/ref.size,1-ref.y[row+b]/ref.size);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
function ornamentMaterial(THREE,map,color){
  const material=new THREE.MeshBasicMaterial({map:map||null,color:map?0xffffff:color,transparent:true,side:THREE.DoubleSide});
  if(map)material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nif(min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b))>0.92) discard;');};
  return material;
}
export function createArtworkFrame(THREE,width,height,{variant=0,textures=[]}={}){
  const group=new THREE.Group();
  const gold=variant%3===0,color=gold?0x9e7331:0x827c68;
  const rim=gold?.145:.18,gap=.02,bevel=.012;
  const x=width/2+gap,y=height/2+gap;
  const shape=new THREE.Shape();
  shape.moveTo(-x-rim,-y-rim);shape.lineTo(x+rim,-y-rim);shape.lineTo(x+rim,y+rim);shape.lineTo(-x-rim,y+rim);shape.closePath();
  const hole=new THREE.Path();
  hole.moveTo(-x,-y);hole.lineTo(-x,y);hole.lineTo(x,y);hole.lineTo(x,-y);hole.closePath();shape.holes.push(hole);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.15,steps:1,bevelEnabled:true,bevelThickness:.014,bevelSize:bevel,bevelSegments:3,curveSegments:1});
  const material=new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.35,transparent:true});
  const rimMesh=new THREE.Mesh(geometry,material);rimMesh.name='baroque-rim';rimMesh.position.z=-.085;group.add(rimMesh);
  const face=new THREE.Mesh(panels(THREE,x,y,rim,references[gold?0:1]),ornamentMaterial(THREE,textures[gold?0:1],color));face.name='carved-surface';face.userData.layer=1;group.add(face);
  const nx=Math.max(8,Math.round(width/.085)),ny=Math.max(8,Math.round(height/.085));
  const beads=new THREE.InstancedMesh(new THREE.SphereGeometry(.012,6,4),new THREE.MeshStandardMaterial({color:gold?0xd6ad61:0xc2bfb0,metalness:.45,roughness:.4,transparent:true}),2*(nx+ny));
  const matrix=new THREE.Matrix4();let n=0;
  for(let i=0;i<nx;i++)for(const sign of [-1,1]){matrix.makeTranslation(-x+(i+.5)*2*x/nx,sign*(y+.013),.094);beads.setMatrixAt(n++,matrix);}
  for(let i=0;i<ny;i++)for(const sign of [-1,1]){matrix.makeTranslation(sign*(x+.013),-y+(i+.5)*2*y/ny,.094);beads.setMatrixAt(n++,matrix);}
  beads.name='beaded-lip';beads.userData.layer=2;group.add(beads);
  if(variant%3===2){
    const g=new THREE.PlaneGeometry(Math.min(width*.7,1.15),.33),uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(48+uv.getX(i)*264)/360,(285+uv.getY(i)*75)/360);
    const crest=new THREE.Mesh(g,ornamentMaterial(THREE,textures[2],color));crest.name='floral-crest';crest.position.set(0,y+rim-.04,.105);crest.userData.layer=3;group.add(crest);
    const pendant=new THREE.Mesh(g.clone(),ornamentMaterial(THREE,textures[2],color));pendant.rotation.z=Math.PI;pendant.position.set(0,-y-rim+.04,.105);pendant.name='floral-pendant';pendant.userData.layer=3;group.add(pendant);
  }
  // A recessed dark backing fills the narrow reveal without covering any of the image.
  const backing=new THREE.Mesh(new THREE.PlaneGeometry(width+gap*2,height+gap*2),new THREE.MeshBasicMaterial({color:0x201910,transparent:true}));
  backing.name='recess';backing.position.z=-.012;group.add(backing);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(width+rim*2+.08,height+rim*2+.08),new THREE.MeshBasicMaterial({color:0x263127,transparent:true,opacity:.1,depthWrite:false}));
  shadow.name='frame-shadow';shadow.position.set(.025,-.035,-.095);shadow.userData.opacity=.1;group.add(shadow);
  return group;
}

export function disposeArtworkFrame(frame){
  frame?.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});
  frame?.removeFromParent();
}
