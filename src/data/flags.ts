// @ts-nocheck
/* 生成物: tools/extract.py が body.html から切り出した。国旗の描画（すべてSVGで手描き） */

export function pts(cx,cy,r,n,rot){
  let a=[];
  for(let i=0;i<n*2;i++){
    const rad=(i%2===0)?r:r*0.382;
    const t=(Math.PI/ n)*i - Math.PI/2 + (rot||0);
    a.push((cx+rad*Math.cos(t)).toFixed(2)+','+(cy+rad*Math.sin(t)).toFixed(2));
  }
  return a.join(' ');
}
export function star(cx,cy,r,fill,rot){
  return '<polygon points="'+pts(cx,cy,r,5,rot||0)+'" fill="'+fill+'"/>';
}
export function trigram(x,y,rot,pat){
  let s='<g transform="translate('+x+' '+y+') rotate('+rot+')" fill="#0A0A0A">';
  pat.forEach(function(solid,i){
    const yy=-2.9+i*2.3;
    if(solid){ s+='<rect x="-4.6" y="'+yy+'" width="9.2" height="1.5"/>'; }
    else{ s+='<rect x="-4.6" y="'+yy+'" width="3.8" height="1.5"/><rect x="0.8" y="'+yy+'" width="3.8" height="1.5"/>'; }
  });
  return s+'</g>';
}
export function unionJack(){
  let s='<rect width="60" height="40" fill="#00247D"/>';
  s+='<path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" stroke-width="8"/>';
  s+='<path d="M0 0 L60 40 M60 0 L0 40" stroke="#CF142B" stroke-width="3.4"/>';
  s+='<path d="M30 0 V40 M0 20 H60" stroke="#fff" stroke-width="12"/>';
  s+='<path d="M30 0 V40 M0 20 H60" stroke="#CF142B" stroke-width="7"/>';
  return s;
}
export function usStars(){
  let s='',rows=[6,5,6,5,6,5,6,5,6];
  const w=24,h=40*7/13;
  rows.forEach(function(n,r){
    const cy=h*(r+1)/10;
    for(let i=0;i<n;i++){
      const cx=(n===6)? w*(i+1)/7 : w*(i+1.5)/7;
      s+=star(cx,cy,1.05,'#fff');
    }
  });
  return s;
}
export function chakra(){
  let s='<circle cx="30" cy="20" r="6.2" fill="none" stroke="#0A3C8A" stroke-width="1"/><circle cx="30" cy="20" r="1.3" fill="#0A3C8A"/>';
  for(let i=0;i<24;i++){
    const t=Math.PI*2*i/24;
    s+='<line x1="'+(30+1.6*Math.cos(t)).toFixed(2)+'" y1="'+(20+1.6*Math.sin(t)).toFixed(2)+'" x2="'+(30+6.2*Math.cos(t)).toFixed(2)+'" y2="'+(20+6.2*Math.sin(t)).toFixed(2)+'" stroke="#0A3C8A" stroke-width="0.45"/>';
  }
  return s;
}
export function sunRays(cx,cy,r){
  let s='';
  for(let i=0;i<16;i++){
    const t=Math.PI*2*i/16;
    const x1=cx+r*Math.cos(t), y1=cy+r*Math.sin(t);
    const x2=cx+(r*2.1)*Math.cos(t), y2=cy+(r*2.1)*Math.sin(t);
    s+='<line x1="'+x1.toFixed(2)+'" y1="'+y1.toFixed(2)+'" x2="'+x2.toFixed(2)+'" y2="'+y2.toFixed(2)+'" stroke="#E8B84B" stroke-width="1.1"/>';
  }
  return s;
}
export const MAPLE='M30 6.4 L31.3 12.6 L35.9 11.3 L34.9 15.9 L41.7 13.9 L40.1 18.3 L46.3 21.7 L42.4 23.7 L43.7 26.7 L37.2 25.9 L36.6 28.5 L31.4 25.8 L32.7 33.4 L30 32.1 L27.3 33.4 L28.6 25.8 L23.4 28.5 L22.8 25.9 L16.3 26.7 L17.6 23.7 L13.7 21.7 L19.9 18.3 L18.3 13.9 L25.1 15.9 L24.1 11.3 L28.7 12.6 Z';
export const FLAGS={
  jp:function(){return '<rect width="60" height="40" fill="#fff"/><circle cx="30" cy="20" r="12" fill="#BC002D"/>';},
  kr:function(){
    let s='<rect width="60" height="40" fill="#fff"/>';
    s+='<g transform="rotate(-33.69 30 20)">';
    s+='<circle cx="30" cy="20" r="9" fill="#CD2E3A"/>';
    s+='<path d="M21 20a9 9 0 0 0 18 0a4.5 4.5 0 0 0-9 0a4.5 4.5 0 0 1-9 0z" fill="#0047A0"/>';
    s+='</g>';
    s+=trigram(11,8,-57,[1,1,1])+trigram(49,8,57,[0,1,0])+trigram(11,32,57,[1,0,1])+trigram(49,32,-57,[0,0,0]);
    return s;
  },
  cn:function(){
    let s='<rect width="60" height="40" fill="#DE2910"/>'+star(11,10,5.2,'#FFDE00');
    const small=[[21,4.5],[25.5,8.5],[25.5,14.5],[21,18.5]];
    small.forEach(function(p,i){ s+=star(p[0],p[1],1.9,'#FFDE00',[0.4,0.2,-0.2,-0.4][i]); });
    return s;
  },
  us:function(){
    let s='<rect width="60" height="40" fill="#fff"/>';
    for(let i=0;i<7;i++){ s+='<rect y="'+(i*2*40/13).toFixed(2)+'" width="60" height="'+(40/13).toFixed(2)+'" fill="#B22234"/>'; }
    s+='<rect width="24" height="'+(40*7/13).toFixed(2)+'" fill="#3C3B6E"/>'+usStars();
    return s;
  },
  ca:function(){
    return '<rect width="60" height="40" fill="#D52B1E"/><rect x="15" width="30" height="40" fill="#fff"/>'
      +'<rect x="29.25" y="30" width="1.5" height="4.4" fill="#D52B1E"/><path d="'+MAPLE+'" fill="#D52B1E"/>';
  },
  br:function(){
    let s='<rect width="60" height="40" fill="#009739"/>';
    s+='<polygon points="30,4 55,20 30,36 5,20" fill="#FEDD00"/>';
    s+='<circle cx="30" cy="20" r="9" fill="#012169"/>';
    s+='<path d="M21.6 17.2 A 13 13 0 0 0 38.6 22.6 L 38.2 20.4 A 11.5 11.5 0 0 1 21.9 15.6 Z" fill="#fff"/>';
    [[27,15],[31,14],[34,16.5],[26,24],[32.5,25],[35,22]].forEach(function(p){ s+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="0.7" fill="#fff"/>'; });
    return s;
  },
  gb:unionJack,
  fr:function(){return '<rect width="20" height="40" fill="#002395"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#ED2939"/>';},
  de:function(){return '<rect width="60" height="13.34" fill="#000"/><rect y="13.34" width="60" height="13.33" fill="#DD0000"/><rect y="26.67" width="60" height="13.33" fill="#FFCE00"/>';},
  it:function(){return '<rect width="20" height="40" fill="#009246"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#CE2B37"/>';},
  ch:function(){return '<rect width="60" height="40" fill="#D52B1E"/><rect x="26" y="9" width="8" height="22" fill="#fff"/><rect x="19" y="16" width="22" height="8" fill="#fff"/>';},
  se:function(){return '<rect width="60" height="40" fill="#006AA7"/><rect x="18" width="7" height="40" fill="#FECC02"/><rect y="16.5" width="60" height="7" fill="#FECC02"/>';},
  dk:function(){return '<rect width="60" height="40" fill="#C8102E"/><rect x="18" width="7" height="40" fill="#fff"/><rect y="16.5" width="60" height="7" fill="#fff"/>';},
  nl:function(){return '<rect width="60" height="13.34" fill="#AE1C28"/><rect y="13.34" width="60" height="13.33" fill="#fff"/><rect y="26.67" width="60" height="13.33" fill="#21468B"/>';},
  ru:function(){return '<rect width="60" height="13.34" fill="#fff"/><rect y="13.34" width="60" height="13.33" fill="#0039A6"/><rect y="26.67" width="60" height="13.33" fill="#D52B1E"/>';},
  gr:function(){
    let s='<rect width="60" height="40" fill="#0D5EAF"/>';
    for(let i=0;i<4;i++){ s+='<rect y="'+((i*2+1)*40/9).toFixed(2)+'" width="60" height="'+(40/9).toFixed(2)+'" fill="#fff"/>'; }
    s+='<rect width="'+(40*5/9).toFixed(2)+'" height="'+(40*5/9).toFixed(2)+'" fill="#0D5EAF"/>';
    s+='<rect x="9.26" y="0" width="4.44" height="22.2" fill="#fff"/><rect x="0" y="8.88" width="22.2" height="4.44" fill="#fff"/>';
    return s;
  },
  tr:function(){
    return '<rect width="60" height="40" fill="#E30A17"/><circle cx="23" cy="20" r="8" fill="#fff"/><circle cx="26.2" cy="20" r="6.4" fill="#E30A17"/>'+star(36.5,20,4.6,'#fff',Math.PI/10*2);
  },
  in:function(){
    return '<rect width="60" height="13.34" fill="#FF9933"/><rect y="13.34" width="60" height="13.33" fill="#fff"/><rect y="26.67" width="60" height="13.33" fill="#138808"/>'+chakra();
  },
  th:function(){
    return '<rect width="60" height="40" fill="#A51931"/><rect y="6.67" width="60" height="26.66" fill="#F4F5F8"/><rect y="13.34" width="60" height="13.32" fill="#2D2A4A"/>';
  },
  vn:function(){return '<rect width="60" height="40" fill="#DA251D"/>'+star(30,20,9,'#FFFF00');},
  id:function(){return '<rect width="60" height="20" fill="#CE1126"/><rect y="20" width="60" height="20" fill="#fff"/>';},
  za:function(){
    let s='<rect width="60" height="20" fill="#E03C31"/><rect y="20" width="60" height="20" fill="#001489"/>';
    s+='<polygon points="0,0 13,0 36,17 60,17 60,23 36,23 13,40 0,40 0,31 22,20 0,9" fill="#fff"/>';
    s+='<polygon points="0,4 8,4 33,18.6 60,18.6 60,21.4 33,21.4 8,36 0,36 0,28.6 17,20 0,11.4" fill="#007A4D"/>';
    s+='<polygon points="0,0 0,40 23,20" fill="#FFB612"/><polygon points="0,4 0,36 18.5,20" fill="#000"/>';
    return s;
  },
  ar:function(){
    let s='<rect width="60" height="13.34" fill="#74ACDF"/><rect y="13.34" width="60" height="13.33" fill="#fff"/><rect y="26.67" width="60" height="13.33" fill="#74ACDF"/>';
    s+=sunRays(30,20,3.2)+'<circle cx="30" cy="20" r="3.2" fill="#F6B40E" stroke="#85340A" stroke-width="0.4"/>';
    return s;
  },
  au:function(){
    let s='<rect width="60" height="40" fill="#00247D"/><g transform="scale(0.5)">'+unionJack()+'</g>';
    s+=star(15,30,4.2,'#fff');
    s+=star(45,9,2.1,'#fff')+star(50,19,2.4,'#fff')+star(43,23,2.1,'#fff')+star(46,32,2.4,'#fff')+star(39,17,1.3,'#fff');
    return s;
  }
};
export function flagSVG(code){
  return '<svg viewBox="0 0 60 40" role="img" aria-label="国旗">'+FLAGS[code]()+'</svg>';
}
