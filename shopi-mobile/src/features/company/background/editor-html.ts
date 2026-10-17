/**
 * Page de l'éditeur « Retirer le fond » (affichée dans une WebView, hors
 * ligne : rien n'est envoyé tant que le vendeur n'a pas touché « Terminer »).
 *
 * Départ automatique :
 *   - masque de l'IA du téléphone (ML Kit, Android) quand il est disponible ;
 *   - sinon « couleur du fond » : remplissage depuis les bords (même
 *     algorithme que le site, shared/utils/backgroundRemoval.ts).
 * Retouches au doigt, sans se fatiguer :
 *   ✨ Baguette : toucher une zone de fond restante l'efface (sensibilité réglable) ;
 *   🧽 Gomme / 🖌 Restaurer : peindre au doigt (taille du pinceau réglable),
 *      la partie effacée reste visible en transparence pour la restaurer ;
 *   deux doigts : zoomer / déplacer ; ↶ annuler (20 pas) ; maintenir
 *   « Comparer » : voir la photo d'origine ; fond blanc ou transparent ;
 *   « Cadrer » : produit centré dans une photo carrée (recommandé).
 * Messages : RN → page window.__shoneyaLoad({ image, mask? }) puis appel de
 * window.exportResult() ; page → RN { type:'ready'|'stats'|'result'|'error' }.
 */
export const EDITOR_HTML = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
  html,body{margin:0;height:100%;background:#F4F4F5;font-family:-apple-system,Roboto,"Segoe UI",sans-serif;color:#1F1F1F;overflow:hidden}
  #app{display:flex;flex-direction:column;height:100%}
  #stage{position:relative;flex:1;overflow:hidden;touch-action:none;background:#E9E9EC}
  #wrap{position:absolute;left:0;top:0;transform-origin:0 0;box-shadow:0 6px 24px rgba(0,0,0,.12)}
  #wrap.checker{background-color:#fff;background-image:linear-gradient(45deg,#D9D9DE 25%,transparent 25%),linear-gradient(-45deg,#D9D9DE 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#D9D9DE 75%),linear-gradient(-45deg,transparent 75%,#D9D9DE 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0}
  #wrap.white{background:#fff}
  canvas{display:block;width:100%;height:100%}
  #orig{position:absolute;inset:0;display:none}
  #ring{position:absolute;border:2px solid #fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.55);border-radius:50%;pointer-events:none;display:none;transform:translate(-50%,-50%)}
  #busy{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(244,244,245,.85);font-weight:700;font-size:15px}
  .spin{width:34px;height:34px;border-radius:50%;border:4px solid #D4D4D8;border-top-color:#1F1F1F;animation:s 0.8s linear infinite}
  @keyframes s{to{transform:rotate(360deg)}}
  #msg{position:absolute;left:12px;right:12px;top:10px;padding:9px 12px;border-radius:12px;font-size:13px;font-weight:600;display:none;background:#FFF7E6;color:#92400E;border:1px solid #FCD9A0}
  #fit{position:absolute;right:12px;bottom:12px;display:none;border:0;border-radius:999px;padding:9px 14px;background:#1F1F1F;color:#fff;font-weight:700;font-size:13px}
  #panel{background:#fff;border-top:1px solid #E4E4E7;padding:10px 12px calc(10px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px}
  .tools{display:flex;gap:8px}
  .tool{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 4px;border-radius:14px;border:1.5px solid #E4E4E7;background:#fff;font-size:12.5px;font-weight:700;color:#3F3F46}
  .tool svg{width:22px;height:22px}
  .tool.on{border-color:#1F1F1F;background:#1F1F1F;color:#fff}
  .row{display:flex;align-items:center;gap:10px}
  .row label{font-size:12.5px;font-weight:700;color:#52525B;min-width:86px}
  input[type=range]{flex:1;accent-color:#1F1F1F;height:28px}
  .val{font-size:12.5px;font-weight:800;min-width:28px;text-align:right}
  .hint{font-size:12px;color:#71717A;margin:-4px 0 0}
  .acts{display:flex;gap:8px}
  .btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;min-height:42px;border-radius:12px;border:1.2px solid #E4E4E7;background:#fff;font-size:13px;font-weight:700;color:#1F1F1F}
  .btn svg{width:18px;height:18px}
  .btn:disabled{opacity:.4}
  .seg{display:flex;border:1.2px solid #E4E4E7;border-radius:12px;overflow:hidden;flex:1.3}
  .seg button{flex:1;border:0;background:#fff;font-size:12.5px;font-weight:700;color:#52525B;min-height:42px}
  .seg button.on{background:#1F1F1F;color:#fff}
  .chk{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700}
  .chk input{width:20px;height:20px;accent-color:#1F1F1F}
</style></head>
<body><div id="app">
  <div id="stage">
    <div id="wrap" class="checker"><canvas id="view"></canvas><canvas id="orig"></canvas></div>
    <div id="ring"></div>
    <div id="msg"></div>
    <button id="fit" type="button">Ajuster</button>
    <div id="busy"><div class="spin"></div><div id="busyText">Détection du produit…</div></div>
  </div>
  <div id="panel">
    <div class="tools">
      <button class="tool on" data-tool="magic" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></svg>Baguette</button>
      <button class="tool" data-tool="erase" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 19"/><path d="M22 21H7M5 11l9 9"/></svg>Gomme</button>
      <button class="tool" data-tool="restore" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/></svg>Restaurer</button>
    </div>
    <div class="row" id="rowTol"><label>Sensibilité</label><input id="tol" type="range" min="4" max="60" value="22"><span class="val" id="tolV">22</span></div>
    <div class="row" id="rowSize" style="display:none"><label>Pinceau</label><input id="size" type="range" min="8" max="90" value="34"><span class="val" id="sizeV">34</span></div>
    <p class="hint" id="hint">Touchez un reste de fond pour l'effacer. Deux doigts : zoomer.</p>
    <div class="acts">
      <button class="btn" id="undo" type="button" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>Annuler</button>
      <button class="btn" id="cmp" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/></svg>Comparer</button>
      <div class="seg"><button id="bgW" class="on" type="button">Blanc</button><button id="bgT" type="button">Transparent</button></div>
    </div>
    <div class="row" style="justify-content:space-between">
      <label class="chk"><input id="crop" type="checkbox" checked>Cadrer le produit</label>
      <button class="btn" id="method" type="button" style="flex:0 0 auto;padding:0 12px;display:none"></button>
    </div>
  </div>
</div>
<script>
(function(){
  var post=function(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o))}catch(e){}};
  var $=function(id){return document.getElementById(id)};
  var stage=$('stage'),wrap=$('wrap'),view=$('view'),orig=$('orig'),ring=$('ring'),busy=$('busy'),msg=$('msg');
  var W=0,H=0,src=null,ctx=view.getContext('2d',{willReadFrequently:true}),out=null;
  var aiAlpha=null,method='color',tol=22,brush=34,tool='magic',bg='white';
  var base=null,magic=null,edits=null,magicPts=[],undo=[],comparing=false;
  var scale=1,tx=0,ty=0,fitScale=1;

  /* ── Algorithme « couleur du fond » (même principe que le site) ── */
  function dist(r1,g1,b1,r2,g2,b2){var dr=r1-r2,dg=g1-g2,db=b1-b2;return Math.sqrt((2*dr*dr+4*dg*dg+3*db*db)/9)/2.55}
  function estimateBg(d){var rs=[],gs=[],bs=[],st=Math.max(1,Math.floor((W+H)/400));
    function p(x,y){var i=(y*W+x)*4;rs.push(d[i]);gs.push(d[i+1]);bs.push(d[i+2])}
    for(var x=0;x<W;x+=st){p(x,0);p(x,H-1)}for(var y=0;y<H;y+=st){p(0,y);p(W-1,y)}
    function m(a){a.sort(function(q,r){return q-r});return a[a.length>>1]}return[m(rs),m(gs),m(bs)]}
  function grow(d,mask,seeds,ref,t){var R=ref[0],G=ref[1],B=ref[2],far=t*1.8,step=t*0.35,stack=new Int32Array(W*H),top=0;
    for(var s=0;s<seeds.length;s++){var q=seeds[s];if(!mask[q]){mask[q]=1;stack[top++]=q}}
    while(top>0){var p=stack[--top],x=p%W,y=(p-x)/W,i=p*4,pr=d[i],pg=d[i+1],pb=d[i+2];
      for(var k=0;k<4;k++){var nx=k===0?x-1:k===1?x+1:x,ny=k===2?y-1:k===3?y+1:y;
        if(nx<0||ny<0||nx>=W||ny>=H)continue;var n=ny*W+nx;if(mask[n])continue;var j=n*4;
        var dr=dist(d[j],d[j+1],d[j+2],R,G,B);
        if(dr<=t||(dr<=far&&dist(d[j],d[j+1],d[j+2],pr,pg,pb)<=step)){mask[n]=1;stack[top++]=n}}}}
  function floodBorders(t){var d=src.data,m=new Uint8Array(W*H),bgc=estimateBg(d),seeds=[];
    function c(x,y){var p=y*W+x,i=p*4;if(dist(d[i],d[i+1],d[i+2],bgc[0],bgc[1],bgc[2])<=t)seeds.push(p)}
    for(var x=0;x<W;x++){c(x,0);c(x,H-1)}for(var y=1;y<H-1;y++){c(0,y);c(W-1,y)}grow(d,m,seeds,bgc,t);return m}

  /* ── Masque : base (IA ou couleur) − baguette, puis retouches au pinceau ── */
  function computeBase(){
    base=new Uint8Array(W*H);
    if(method==='ai'&&aiAlpha){for(var p=0;p<W*H;p++)base[p]=aiAlpha[p]}
    else{var m=floodBorders(tol);for(var q=0;q<W*H;q++)base[q]=m[q]?0:255}
    magic=new Uint8Array(W*H);var d=src.data;
    for(var k=0;k<magicPts.length;k++){var pt=magicPts[k],pi=pt.y*W+pt.x,ii=pi*4;grow(d,magic,[pi],[d[ii],d[ii+1],d[ii+2]],tol)}
  }
  function alphaAt(p){var e=edits[p];if(e===1)return 255;if(e===-1)return 0;return magic[p]?0:base[p]}
  function paintPixel(p){var i=p*4,a=alphaAt(p),d=src.data,o=out.data;
    if(comparing){o[i]=d[i];o[i+1]=d[i+1];o[i+2]=d[i+2];o[i+3]=255;return}
    var vis=tool==='restore'?Math.max(a,52):a;o[i]=d[i];o[i+1]=d[i+1];o[i+2]=d[i+2];o[i+3]=vis}
  function redraw(){for(var p=0;p<W*H;p++)paintPixel(p);ctx.putImageData(out,0,0);stats()}
  function redrawRect(x0,y0,x1,y1){x0=Math.max(0,x0|0);y0=Math.max(0,y0|0);x1=Math.min(W-1,x1|0);y1=Math.min(H-1,y1|0);
    if(x1<x0||y1<y0)return;for(var y=y0;y<=y1;y++)for(var x=x0;x<=x1;x++)paintPixel(y*W+x);
    ctx.putImageData(out,0,0,x0,y0,x1-x0+1,y1-y0+1)}
  var statT=null;function stats(){clearTimeout(statT);statT=setTimeout(function(){var n=0;for(var p=0;p<W*H;p++)if(alphaAt(p)<128)n++;
    var r=n/(W*H);var t=r<0.04?'Presque rien n’a été retiré : le fond n’est pas uni. Utilisez la Gomme, ou la Baguette sur le fond.':r>0.95?'Le produit semble effacé : baissez la sensibilité ou utilisez Restaurer.':'';
    msg.textContent=t;msg.style.display=t?'block':'none';post({type:'stats',ratio:r})},250)}

  /* ── Affichage : ajusté à l'écran, deux doigts = zoom / déplacement ── */
  function applyT(){wrap.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';$('fit').style.display=Math.abs(scale-fitScale)>0.01?'block':'none'}
  function fit(){var sw=stage.clientWidth,sh=stage.clientHeight,pad=16;fitScale=Math.min((sw-pad*2)/W,(sh-pad*2)/H);
    scale=fitScale;wrap.style.width=W+'px';wrap.style.height=H+'px';tx=(sw-W*scale)/2;ty=(sh-H*scale)/2;applyT()}
  $('fit').onclick=fit;window.addEventListener('resize',function(){if(W)fit()});

  function toImg(cx,cy){var r=view.getBoundingClientRect();return{x:(cx-r.left)/r.width*W,y:(cy-r.top)/r.height*H}}
  function brushImg(){var r=view.getBoundingClientRect();return Math.max(1,brush/(r.width/W)/2)}
  var pts={},stroke=null,pinch=null,down=null;
  function snapshot(){undo.push({e:edits.slice(),m:magicPts.slice()});if(undo.length>20)undo.shift();$('undo').disabled=false}
  function dab(ix,iy,rad,val){var r2=rad*rad,x0=Math.floor(ix-rad),x1=Math.ceil(ix+rad),y0=Math.floor(iy-rad),y1=Math.ceil(iy+rad);
    for(var y=Math.max(0,y0);y<=Math.min(H-1,y1);y++)for(var x=Math.max(0,x0);x<=Math.min(W-1,x1);x++){var dx=x-ix,dy=y-iy;if(dx*dx+dy*dy<=r2)edits[y*W+x]=val}
    return[x0,y0,x1,y1]}
  function strokeTo(cx,cy){var p=toImg(cx,cy),rad=brushImg(),val=tool==='erase'?-1:1,last=stroke.last||p;
    var dx=p.x-last.x,dy=p.y-last.y,len=Math.sqrt(dx*dx+dy*dy),n=Math.max(1,Math.ceil(len/(rad/3))),bx0=1e9,by0=1e9,bx1=-1,by1=-1;
    for(var k=1;k<=n;k++){var b=dab(last.x+dx*k/n,last.y+dy*k/n,rad,val);bx0=Math.min(bx0,b[0]);by0=Math.min(by0,b[1]);bx1=Math.max(bx1,b[2]);by1=Math.max(by1,b[3])}
    if(!stroke.last){var b0=dab(p.x,p.y,rad,val);bx0=Math.min(bx0,b0[0]);by0=Math.min(by0,b0[1]);bx1=Math.max(bx1,b0[2]);by1=Math.max(by1,b0[3])}
    stroke.last=p;redrawRect(bx0,by0,bx1,by1)}
  function showRing(cx,cy){var r=stage.getBoundingClientRect();ring.style.display='block';ring.style.width=ring.style.height=brush+'px';ring.style.left=(cx-r.left)+'px';ring.style.top=(cy-r.top)+'px'}

  stage.addEventListener('pointerdown',function(e){if(!src)return;stage.setPointerCapture(e.pointerId);pts[e.pointerId]={x:e.clientX,y:e.clientY};
    var ids=Object.keys(pts);
    if(ids.length===2){ /* deuxième doigt : on annule le trait commencé, on zoome */
      if(stroke&&stroke.snap){edits=stroke.snap.e;undo.pop();$('undo').disabled=!undo.length;redraw()}stroke=null;down=null;ring.style.display='none';
      var a=pts[ids[0]],b=pts[ids[1]];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),s:scale,mx:(a.x+b.x)/2,my:(a.y+b.y)/2,tx:tx,ty:ty};return}
    if(ids.length>2)return;
    down={x:e.clientX,y:e.clientY,t:Date.now()};
    if(tool!=='magic'){snapshot();stroke={snap:undo[undo.length-1],last:null};showRing(e.clientX,e.clientY);strokeTo(e.clientX,e.clientY)}
  });
  stage.addEventListener('pointermove',function(e){if(!pts[e.pointerId])return;pts[e.pointerId]={x:e.clientX,y:e.clientY};var ids=Object.keys(pts);
    if(pinch&&ids.length===2){var a=pts[ids[0]],b=pts[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
      var ns=Math.min(fitScale*8,Math.max(fitScale*0.8,pinch.s*d/pinch.d)),r=stage.getBoundingClientRect();
      var ox=pinch.mx-r.left,oy=pinch.my-r.top;tx=ox-(ox-pinch.tx)*ns/pinch.s+(mx-pinch.mx);ty=oy-(oy-pinch.ty)*ns/pinch.s+(my-pinch.my);scale=ns;applyT();return}
    if(stroke){showRing(e.clientX,e.clientY);strokeTo(e.clientX,e.clientY)}
  });
  function end(e){var wasTap=down&&tool==='magic'&&Object.keys(pts).length===1&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<12&&Date.now()-down.t<600;
    delete pts[e.pointerId];if(Object.keys(pts).length<2)pinch=null;
    if(wasTap){var p=toImg(e.clientX,e.clientY);if(p.x>=0&&p.y>=0&&p.x<W&&p.y<H){snapshot();magicPts.push({x:Math.floor(p.x),y:Math.floor(p.y)});busyOn('Effacement…');setTimeout(function(){computeBase();redraw();busyOff()},20)}}
    if(stroke&&!Object.keys(pts).length){stroke=null;ring.style.display='none';stats()}
    down=null}
  stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);

  /* ── Réglages ── */
  function setTool(t){tool=t;var bs=document.querySelectorAll('.tool');for(var i=0;i<bs.length;i++)bs[i].classList.toggle('on',bs[i].getAttribute('data-tool')===t);
    $('rowTol').style.display=t==='magic'?'flex':'none';$('rowSize').style.display=t==='magic'?'none':'flex';
    $('hint').textContent=t==='magic'?'Touchez un reste de fond pour l’effacer. Deux doigts : zoomer.':t==='erase'?'Passez le doigt sur ce qu’il faut effacer. Deux doigts : zoomer.':'Passez le doigt sur une partie du produit effacée par erreur.';
    if(src)redraw()}
  var tb=document.querySelectorAll('.tool');for(var i=0;i<tb.length;i++)tb[i].onclick=function(){setTool(this.getAttribute('data-tool'))};
  var tolT=null;$('tol').oninput=function(){tol=+this.value;$('tolV').textContent=tol;clearTimeout(tolT);tolT=setTimeout(function(){computeBase();redraw()},120)};
  $('size').oninput=function(){brush=+this.value;$('sizeV').textContent=brush};
  $('undo').onclick=function(){var s=undo.pop();if(!s)return;edits=s.e;var magicChanged=s.m.length!==magicPts.length;magicPts=s.m;if(magicChanged)computeBase();redraw();this.disabled=!undo.length};
  function cmp(on){comparing=on;redraw()}
  $('cmp').addEventListener('pointerdown',function(){cmp(true)});['pointerup','pointerleave','pointercancel'].forEach(function(ev){$('cmp').addEventListener(ev,function(){if(comparing)cmp(false)})});
  function setBg(b){bg=b;$('bgW').classList.toggle('on',b==='white');$('bgT').classList.toggle('on',b!=='white');wrap.className=b==='white'?'white':'checker'}
  $('bgW').onclick=function(){setBg('white')};$('bgT').onclick=function(){setBg('transparent')};
  function updMethod(){var b=$('method');if(!aiAlpha){b.style.display='none';return}b.style.display='flex';b.textContent=method==='ai'?'Méthode : IA':'Méthode : couleur';$('rowTol').querySelector('label').textContent=method==='ai'?'Baguette':'Sensibilité'}
  $('method').onclick=function(){snapshot();method=method==='ai'?'color':'ai';updMethod();computeBase();redraw()};
  function busyOn(t){$('busyText').textContent=t;busy.style.display='flex'}function busyOff(){busy.style.display='none'}

  /* ── Chargement ── */
  function loadImg(url){return new Promise(function(ok,ko){var im=new Image();im.onload=function(){ok(im)};im.onerror=ko;im.src=url})}
  function load(m){busyOn(m.mask?'Détection du produit…':'Analyse du fond…');
    loadImg(m.image).then(function(im){W=im.naturalWidth;H=im.naturalHeight;view.width=W;view.height=H;orig.width=W;orig.height=H;
      var c=document.createElement('canvas');c.width=W;c.height=H;var cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(im,0,0);src=cx.getImageData(0,0,W,H);
      out=ctx.createImageData(W,H);edits=new Int8Array(W*H);
      var next=m.mask?loadImg(m.mask).then(function(mi){var c2=document.createElement('canvas');c2.width=W;c2.height=H;var x2=c2.getContext('2d',{willReadFrequently:true});x2.drawImage(mi,0,0,W,H);
        var md=x2.getImageData(0,0,W,H).data;aiAlpha=new Uint8Array(W*H);
        /* confiance → contour net mais doux */
        for(var p=0;p<W*H;p++){var c0=md[p*4+3]/255,t=Math.min(1,Math.max(0,(c0-0.3)/0.4));aiAlpha[p]=Math.round(255*t*t*(3-2*t))}
        method='ai'}).catch(function(){aiAlpha=null}):Promise.resolve();
      return next}).then(function(){updMethod();setBg('white');computeBase();fit();redraw();busyOff();post({type:'ready',width:W,height:H,method:method})})
    .catch(function(){busyOff();post({type:'error',message:'Impossible d’ouvrir cette photo.'})})}

  /* ── Résultat : contour adouci, fond blanc ou transparent, produit cadré ── */
  window.exportResult=function(){if(!src){post({type:'error',message:'Photo pas encore prête.'});return}
    busyOn('Préparation de la photo…');
    setTimeout(function(){try{
      var a=new Uint8Array(W*H);for(var p=0;p<W*H;p++)a[p]=alphaAt(p);
      var x0=W,y0=H,x1=-1,y1=-1,f=new Uint8Array(W*H);
      for(var y=0;y<H;y++)for(var x=0;x<W;x++){var s=0,c=0;for(var dy=-1;dy<=1;dy++){var yy=y+dy;if(yy<0||yy>=H)continue;for(var dx=-1;dx<=1;dx++){var xx=x+dx;if(xx<0||xx>=W)continue;s+=a[yy*W+xx];c++}}
        var v=Math.round(s/c);f[y*W+x]=v;if(v>40){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
      if(x1<0){busyOff();post({type:'error',message:'Tout a été effacé : restaurez le produit avant de terminer.'});return}
      var o=document.createElement('canvas'),d=src.data,img=new ImageData(W,H),q=img.data;
      for(var p2=0;p2<W*H;p2++){var i=p2*4,al=f[p2]/255;
        if(bg==='white'){q[i]=Math.round(d[i]*al+255*(1-al));q[i+1]=Math.round(d[i+1]*al+255*(1-al));q[i+2]=Math.round(d[i+2]*al+255*(1-al));q[i+3]=255}
        else{q[i]=d[i];q[i+1]=d[i+1];q[i+2]=d[i+2];q[i+3]=f[p2]}}
      var full=document.createElement('canvas');full.width=W;full.height=H;full.getContext('2d').putImageData(img,0,0);
      if($('crop').checked){var bw=x1-x0+1,bh=y1-y0+1,side=Math.round(Math.max(bw,bh)*1.18),S=Math.min(side,1600);var k=S/side;
        o.width=S;o.height=S;var oc=o.getContext('2d');if(bg==='white'){oc.fillStyle='#fff';oc.fillRect(0,0,S,S)}
        oc.imageSmoothingQuality='high';oc.drawImage(full,x0,y0,bw,bh,(S-bw*k)/2,(S-bh*k)/2,bw*k,bh*k)}
      else{o=full}
      var mime=bg==='white'?'image/jpeg':'image/png';
      post({type:'result',mime:mime,dataUrl:o.toDataURL(mime,0.9)});busyOff()
    }catch(err){busyOff();post({type:'error',message:'La photo n’a pas pu être préparée.'})}},30)};

  window.__shoneyaLoad=function(m){if(m&&m.image)load(m)};
  function onMsg(ev){var m;try{m=JSON.parse(ev.data)}catch(e){return}if(m&&m.type==='load')load(m)}
  document.addEventListener('message',onMsg);window.addEventListener('message',onMsg);
  post({type:'boot'});
})();
</script></body></html>`;
