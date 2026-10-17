/**
 * Page de l'éditeur « Retoucher la photo » (affichée dans une WebView, hors
 * ligne : rien n'est envoyé tant que le vendeur n'a pas touché « Terminer »).
 *
 * Onglet ✨ EMBELLIR (ouvert d'abord, « Auto » déjà appliqué) :
 *   - Auto : niveaux étirés (noirs plus profonds, blancs plus purs), balance
 *     des blancs (supprime la dominante jaune / bleue), exposition corrigée
 *     si la photo est sombre, couleurs ravivées sans brûler les peaux,
 *     netteté légère ;
 *   - styles en un toucher : Original · Auto · Éclatant · Lumineux · Doux · Chaud ;
 *   - réglage fin, un curseur à la fois : Luminosité, Contraste, Couleurs,
 *     Chaleur, Netteté.
 * Onglet ✂️ FOND (facultatif, interrupteur « Retirer le fond ») :
 *   - départ automatique : masque de l'IA du téléphone (ML Kit, Android) quand
 *     il est disponible, sinon « couleur du fond » (remplissage depuis les
 *     bords, même algorithme que le site) ;
 *   - Baguette (toucher un reste de fond), Gomme / Restaurer au doigt
 *     (partie effacée visible en transparence), fond blanc ou transparent,
 *     « Cadrer le produit » (photo carrée, produit centré).
 * Partout : deux doigts pour zoomer / déplacer ; ↶ Annuler ; maintenir
 * « Comparer » = photo d'origine.
 * Messages : RN → page window.__shoneyaLoad({ image, mask? }) puis
 * window.exportResult() ; page → RN { type:'boot'|'ready'|'stats'|'result'|'error' }.
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
  #ring{position:absolute;border:2px solid #fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.55);border-radius:50%;pointer-events:none;display:none;transform:translate(-50%,-50%)}
  #busy{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(244,244,245,.85);font-weight:700;font-size:15px}
  .spin{width:34px;height:34px;border-radius:50%;border:4px solid #D4D4D8;border-top-color:#1F1F1F;animation:s .8s linear infinite}
  @keyframes s{to{transform:rotate(360deg)}}
  #msg{position:absolute;left:12px;right:12px;top:10px;padding:9px 12px;border-radius:12px;font-size:13px;font-weight:600;display:none;background:#FFF7E6;color:#92400E;border:1px solid #FCD9A0}
  #badge{position:absolute;left:12px;bottom:12px;padding:6px 11px;border-radius:999px;background:rgba(31,31,31,.8);color:#fff;font-size:12px;font-weight:700;display:none}
  #fit{position:absolute;right:12px;bottom:12px;display:none;border:0;border-radius:999px;padding:9px 14px;background:#1F1F1F;color:#fff;font-weight:700;font-size:13px}
  #panel{background:#fff;border-top:1px solid #E4E4E7;padding:8px 12px calc(10px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px}
  .tabs{display:flex;background:#F4F4F5;border-radius:12px;padding:3px}
  .tab{flex:1;border:0;background:transparent;border-radius:10px;min-height:38px;font-size:14px;font-weight:800;color:#52525B;display:flex;align-items:center;justify-content:center;gap:6px}
  .tab svg{width:18px;height:18px}
  .tab.on{background:#fff;color:#1F1F1F;box-shadow:0 1px 3px rgba(0,0,0,.12)}
  .sheet{display:flex;flex-direction:column;gap:10px}
  .chips{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
  .chips::-webkit-scrollbar{display:none}
  .chip{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:4px;border:0;background:transparent;font-size:11.5px;font-weight:700;color:#52525B;padding:0}
  .thumb{width:58px;height:58px;border-radius:12px;border:2px solid transparent;overflow:hidden;background:#EEE}
  .thumb canvas{width:100%;height:100%}
  .chip.on{color:#1F1F1F}
  .chip.on .thumb{border-color:#1F1F1F}
  .adj{display:flex;gap:6px}
  .adjb{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;border:1.2px solid #E4E4E7;background:#fff;border-radius:12px;padding:7px 2px;font-size:11px;font-weight:700;color:#52525B;position:relative}
  .adjb svg{width:19px;height:19px}
  .adjb.on{border-color:#1F1F1F;color:#1F1F1F}
  .adjb .dot{position:absolute;top:5px;right:6px;width:6px;height:6px;border-radius:50%;background:#16A34A;display:none}
  .adjb.mod .dot{display:block}
  .tools{display:flex;gap:8px}
  .tool{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px;border-radius:14px;border:1.5px solid #E4E4E7;background:#fff;font-size:12.5px;font-weight:700;color:#3F3F46}
  .tool svg{width:21px;height:21px}
  .tool.on{border-color:#1F1F1F;background:#1F1F1F;color:#fff}
  .row{display:flex;align-items:center;gap:10px}
  .row label{font-size:12.5px;font-weight:700;color:#52525B;min-width:78px}
  input[type=range]{flex:1;accent-color:#1F1F1F;height:28px}
  .val{font-size:12.5px;font-weight:800;min-width:34px;text-align:right}
  .hint{font-size:12px;color:#71717A;margin:-4px 0 0}
  .acts{display:flex;gap:8px}
  .btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;min-height:42px;border-radius:12px;border:1.2px solid #E4E4E7;background:#fff;font-size:13px;font-weight:700;color:#1F1F1F}
  .btn svg{width:18px;height:18px}
  .btn:disabled{opacity:.4}
  .seg{display:flex;border:1.2px solid #E4E4E7;border-radius:12px;overflow:hidden;flex:1.3}
  .seg button{flex:1;border:0;background:#fff;font-size:12.5px;font-weight:700;color:#52525B;min-height:40px}
  .seg button.on{background:#1F1F1F;color:#fff}
  .switch{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1.2px solid #E4E4E7;border-radius:14px}
  .switch b{font-size:14px}
  .switch small{display:block;font-size:12px;color:#71717A;font-weight:500}
  .tg{position:relative;width:50px;height:30px;flex:0 0 auto}
  .tg input{opacity:0;width:0;height:0}
  .tg span{position:absolute;inset:0;background:#D4D4D8;border-radius:999px;transition:.2s}
  .tg span:before{content:"";position:absolute;width:24px;height:24px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
  .tg input:checked+span{background:#1F1F1F}
  .tg input:checked+span:before{transform:translateX(20px)}
  .chk{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700}
  .chk input{width:20px;height:20px;accent-color:#1F1F1F}
  .hidden{display:none!important}
</style></head>
<body><div id="app">
  <div id="stage">
    <div id="wrap" class="white"><canvas id="view"></canvas></div>
    <div id="ring"></div>
    <div id="msg"></div>
    <div id="badge">Photo d’origine</div>
    <button id="fit" type="button">Ajuster</button>
    <div id="busy"><div class="spin"></div><div id="busyText">Préparation…</div></div>
  </div>
  <div id="panel">
    <div class="tabs">
      <button class="tab on" data-tab="look" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>Embellir</button>
      <button class="tab" data-tab="bg" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/></svg>Fond</button>
    </div>

    <!-- ✨ Embellir -->
    <div class="sheet" id="sheetLook">
      <div class="chips" id="presets"></div>
      <div class="adj" id="adjs"></div>
      <div class="row"><label id="adjLabel">Luminosité</label><input id="adjRange" type="range" min="-50" max="50" value="0"><span class="val" id="adjVal">0</span></div>
    </div>

    <!-- ✂️ Fond -->
    <div class="sheet hidden" id="sheetBg">
      <label class="switch"><div><b>Retirer le fond</b><small id="bgSub">Le produit seul, sur fond blanc ou transparent</small></div><span class="tg"><input id="bgOn" type="checkbox"><span></span></span></label>
      <div class="sheet hidden" id="bgTools">
        <div class="tools">
          <button class="tool on" data-tool="magic" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></svg>Baguette</button>
          <button class="tool" data-tool="erase" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 19"/><path d="M22 21H7M5 11l9 9"/></svg>Gomme</button>
          <button class="tool" data-tool="restore" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/></svg>Restaurer</button>
        </div>
        <div class="row" id="rowTol"><label>Sensibilité</label><input id="tol" type="range" min="4" max="60" value="22"><span class="val" id="tolV">22</span></div>
        <div class="row hidden" id="rowSize"><label>Pinceau</label><input id="size" type="range" min="8" max="90" value="34"><span class="val" id="sizeV">34</span></div>
        <p class="hint" id="hint">Touchez un reste de fond pour l’effacer. Deux doigts : zoomer.</p>
        <div class="row" style="gap:8px">
          <div class="seg"><button id="bgW" class="on" type="button">Fond blanc</button><button id="bgT" type="button">Transparent</button></div>
          <button class="btn" id="method" type="button" style="flex:0 0 auto;padding:0 12px;display:none"></button>
        </div>
        <label class="chk"><input id="crop" type="checkbox" checked>Cadrer le produit (photo carrée, centrée)</label>
      </div>
    </div>

    <div class="acts">
      <button class="btn" id="undo" type="button" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>Annuler</button>
      <button class="btn" id="cmp" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/></svg>Maintenir : avant</button>
    </div>
  </div>
</div>
<script>
(function(){
  var post=function(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o))}catch(e){}};
  var $=function(id){return document.getElementById(id)};
  var stage=$('stage'),wrap=$('wrap'),view=$('view'),ring=$('ring'),busy=$('busy'),msg=$('msg');
  var W=0,H=0,src=null,enh=null,ctx=view.getContext('2d',{willReadFrequently:true}),out=null;
  var aiAlpha=null,method='color',tol=22,brush=34,tool='magic',bg='white',removeBg=false,tab='look';
  var base=null,magic=null,edits=null,magicPts=[],undo=[],comparing=false;
  var scale=1,tx=0,ty=0,fitScale=1;

  /* ════════ EMBELLIR ════════ */
  var ADJ=[
    {k:'light',l:'Luminosité',min:-50,max:50,i:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>'},
    {k:'contrast',l:'Contraste',min:-50,max:50,i:'<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"/>'},
    {k:'color',l:'Couleurs',min:-50,max:50,i:'<path d="M12 2.7a9.3 9.3 0 1 0 0 18.6c1 0 1.6-.8 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6h1.9c2.9 0 5.2-2.3 5.2-5.2C21.4 6.4 17.2 2.7 12 2.7Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>'},
    {k:'warm',l:'Chaleur',min:-50,max:50,i:'<path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>'},
    {k:'sharp',l:'Netteté',min:0,max:100,i:'<path d="M12 2 2 22h20Z"/>'}
  ];
  var ZERO={light:0,contrast:0,color:0,warm:0,sharp:0};
  var PRESETS=[
    {k:'orig',l:'Original',auto:false,v:{light:0,contrast:0,color:0,warm:0,sharp:0}},
    {k:'auto',l:'Auto',auto:true,v:{light:0,contrast:6,color:6,warm:0,sharp:30}},
    {k:'vivid',l:'Éclatant',auto:true,v:{light:4,contrast:16,color:28,warm:2,sharp:40}},
    {k:'bright',l:'Lumineux',auto:true,v:{light:18,contrast:4,color:10,warm:0,sharp:25}},
    {k:'soft',l:'Doux',auto:true,v:{light:8,contrast:-14,color:-6,warm:4,sharp:0}},
    {k:'warmp',l:'Chaud',auto:true,v:{light:4,contrast:8,color:12,warm:22,sharp:25}}
  ];
  var preset='auto',useAuto=true,adj=JSON.parse(JSON.stringify(PRESETS[1].v)),curAdj='light',autoParams=null,strength=1;
  /* intensité des styles (Réglages photo du vendeur) : 0,3 = discret … 1 = complet */
  function presetValues(p){var v={};for(var k in p.v)v[k]=Math.round(p.v[k]*strength);return v}

  /* Analyse de la photo : dominante de couleur, niveaux, exposition.
   * 1. balance des blancs « monde gris » sur les tons moyens peu saturés ;
   * 2. niveaux sur la luminance APRÈS correction (noirs à 0,5 %, blancs à 99,5 %),
   *    étirement limité (×1,5 au plus) pour ne jamais brûler ni griser ;
   * 3. photo encore sombre : gamma qui éclaircit les tons moyens. */
  function analyse(d){var n=W*H,step=Math.max(1,Math.floor(n/250000)),sr=0,sg=0,sb=0,cw=0,i,p;
    for(p=0;p<n;p+=step){i=p*4;var r=d[i],g=d[i+1],b=d[i+2],l=(r*299+g*587+b*114)/1000,mx=Math.max(r,g,b),mn=Math.min(r,g,b);
      if(l>35&&l<240&&mx-mn<70){sr+=r;sg+=g;sb+=b;cw++}}
    var gain=[1,1,1],c=Math.ceil(n/step);
    if(cw>c*0.04){var ar=sr/cw,ag=sg/cw,ab=sb/cw,gy=(ar+ag+ab)/3;gain=[1+0.5*(gy/ar-1),1+0.5*(gy/ag-1),1+0.5*(gy/ab-1)];
      for(var k=0;k<3;k++)gain[k]=Math.min(1.15,Math.max(0.87,gain[k]))}
    var hl=new Uint32Array(256),cnt=0;
    for(p=0;p<n;p+=step){i=p*4;var lv=(d[i]*gain[0]*299+d[i+1]*gain[1]*587+d[i+2]*gain[2]*114)/1000;hl[Math.min(255,lv|0)]++;cnt++}
    function pct(q){var t=cnt*q,a=0;for(var v=0;v<256;v++){a+=hl[v];if(a>=t)return v}return 255}
    var lo=Math.min(pct(0.005),40),hi=Math.max(pct(0.995),Math.max(lo+60,170)),med=(pct(0.5)-lo)/Math.max(1,hi-lo),gamma=1;
    if(med>0.05&&med<0.42)gamma=Math.max(0.6,Math.log(0.45)/Math.log(med));
    return{lo:lo,hi:hi,gain:gain,gamma:gamma}}

  function buildLut(ch){var lut=new Uint8ClampedArray(256),a=useAuto?autoParams:null,
      bright=adj.light/50,con=adj.contrast/50,warm=adj.warm/50;
    for(var v=0;v<256;v++){var x=v/255;
      if(a){var x0=x;x=(v*a.gain[ch]-a.lo)/Math.max(1,a.hi-a.lo);x=Math.min(1,Math.max(0,x));if(a.gamma!==1)x=Math.pow(x,a.gamma);x=x0+(x-x0)*strength}
      /* luminosité : courbe douce (les blancs ne brûlent pas) */
      if(bright>0)x=x+bright*1.2*x*(1-x);else if(bright<0)x=x*(1+bright*0.5);
      /* contraste : courbe en S autour du milieu */
      if(con!==0){x=0.5+(x-0.5)*(con>0?1+con*0.9:1+con*0.6);x=x<0?0:x>1?1:x;if(con>0){var t=x;x=t*t*(3-2*t)*con*0.5+x*(1-con*0.5)}}
      /* chaleur : rouge +, bleu − */
      if(ch===0)x+=warm*0.05;if(ch===2)x-=warm*0.07;
      lut[v]=Math.round(Math.min(1,Math.max(0,x))*255)}return lut}

  var enhT=null;function scheduleEnhance(){clearTimeout(enhT);enhT=setTimeout(function(){enhance();redraw()},40)}
  function enhance(){var d=src.data,o=enh.data,n=W*H,lr=buildLut(0),lg=buildLut(1),lb=buildLut(2),
      sat=adj.color/50*0.8;
    for(var p=0;p<n;p++){var i=p*4,r=lr[d[i]],g=lg[d[i+1]],b=lb[d[i+2]];
      if(sat!==0){var l=0.299*r+0.587*g+0.114*b,mx=Math.max(r,g,b),mn=Math.min(r,g,b),cs=(mx-mn)/255,
        /* « vibrance » : renforce surtout les couleurs ternes */
        k=sat>0?1+sat*(1-cs):1+sat;r=l+(r-l)*k;g=l+(g-l)*k;b=l+(b-l)*k}
      o[i]=r;o[i+1]=g;o[i+2]=b;o[i+3]=255}
    var amt=adj.sharp/100*0.9;if(amt>0){sharpen(o,amt)}}
  /* netteté : masque flou (3×3), seuil pour ne pas accentuer le grain */
  function sharpen(o,amt){var c=new Uint8ClampedArray(o);for(var y=1;y<H-1;y++)for(var x=1;x<W-1;x++){var i=(y*W+x)*4;
    for(var ch=0;ch<3;ch++){var j=i+ch,blur=(c[j-4]+c[j+4]+c[j-W*4]+c[j+W*4]+c[j]*4)/8,dd=c[j]-blur;if(dd>3||dd<-3)o[j]=c[j]+dd*amt*2}}}

  function renderPresets(){var box=$('presets');box.innerHTML='';
    PRESETS.forEach(function(p){var b=document.createElement('button');b.className='chip'+(p.k===preset?' on':'');b.type='button';
      var t=document.createElement('div');t.className='thumb';var c=document.createElement('canvas');t.appendChild(c);b.appendChild(t);b.appendChild(document.createTextNode(p.l));
      b.onclick=function(){applyPreset(p.k)};box.appendChild(b);drawThumb(c,p)})}
  /* vignette de chaque style, calculée sur une petite version */
  var small=null;function drawThumb(c,p){if(!small)return;var S=small,sz=S.width;c.width=sz;c.height=sz;
    var save=[adj,useAuto];adj=presetValues(p);useAuto=p.auto;var lr=buildLut(0),lg=buildLut(1),lb=buildLut(2),sat=adj.color/50*0.8;adj=save[0];useAuto=save[1];
    var im=new ImageData(sz,sz),q=im.data,s=S.data;for(var i=0;i<q.length;i+=4){var r=lr[s[i]],g=lg[s[i+1]],b=lb[s[i+2]],l=0.299*r+0.587*g+0.114*b,cs=(Math.max(r,g,b)-Math.min(r,g,b))/255,k=sat>0?1+sat*(1-cs):1+sat;
      q[i]=l+(r-l)*k;q[i+1]=l+(g-l)*k;q[i+2]=l+(b-l)*k;q[i+3]=255}c.getContext('2d').putImageData(im,0,0)}
  function applyPreset(k){var p=PRESETS.filter(function(x){return x.k===k})[0];snapshot();preset=k;useAuto=p.auto;adj=presetValues(p);renderPresets();renderAdj();scheduleEnhance()}
  function renderAdj(){var box=$('adjs');box.innerHTML='';
    ADJ.forEach(function(a){var b=document.createElement('button');b.type='button';b.className='adjb'+(a.k===curAdj?' on':'')+(adj[a.k]!==ZERO[a.k]?' mod':'');
      b.innerHTML='<span class="dot"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+a.i+'</svg>'+a.l;
      b.onclick=function(){curAdj=a.k;renderAdj()};box.appendChild(b)});
    var a=ADJ.filter(function(x){return x.k===curAdj})[0],r=$('adjRange');r.min=a.min;r.max=a.max;r.value=adj[a.k];$('adjLabel').textContent=a.l;$('adjVal').textContent=(adj[a.k]>0&&a.min<0?'+':'')+adj[a.k]}
  /* un pas d'annulation par réglage (pas un par cran du curseur) */
  var lastAdjSnap=0,lastAdjKey='';
  $('adjRange').oninput=function(){if(Date.now()-lastAdjSnap>900||lastAdjKey!==curAdj)snapshot();lastAdjSnap=Date.now();lastAdjKey=curAdj;
    adj[curAdj]=+this.value;preset='custom';
    var bs=document.querySelectorAll('.chip');for(var i=0;i<bs.length;i++)bs[i].classList.remove('on');
    $('adjVal').textContent=(adj[curAdj]>0&&+this.min<0?'+':'')+adj[curAdj];
    var ab=document.querySelectorAll('.adjb');for(var j=0;j<ab.length;j++){var k=ADJ[j].k;ab[j].classList.toggle('mod',adj[k]!==ZERO[k])}
    scheduleEnhance()};

  /* ════════ FOND (même principe que le site) ════════ */
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
  function computeBase(){base=new Uint8Array(W*H);
    if(method==='ai'&&aiAlpha){for(var p=0;p<W*H;p++)base[p]=aiAlpha[p]}
    else{var m=floodBorders(tol);for(var q=0;q<W*H;q++)base[q]=m[q]?0:255}
    magic=new Uint8Array(W*H);var d=src.data;
    for(var k=0;k<magicPts.length;k++){var pt=magicPts[k],pi=pt.y*W+pt.x,ii=pi*4;grow(d,magic,[pi],[d[ii],d[ii+1],d[ii+2]],tol)}}
  function alphaAt(p){if(!removeBg)return 255;var e=edits[p];if(e===1)return 255;if(e===-1)return 0;return magic[p]?0:base[p]}

  /* ════════ Affichage ════════ */
  function paintPixel(p){var i=p*4,o=out.data;
    if(comparing){var d=src.data;o[i]=d[i];o[i+1]=d[i+1];o[i+2]=d[i+2];o[i+3]=255;return}
    var e=enh.data,a=alphaAt(p),vis=removeBg&&tab==='bg'&&tool==='restore'?Math.max(a,52):a;o[i]=e[i];o[i+1]=e[i+1];o[i+2]=e[i+2];o[i+3]=vis}
  function redraw(){if(!src)return;for(var p=0;p<W*H;p++)paintPixel(p);ctx.putImageData(out,0,0);stats()}
  function redrawRect(x0,y0,x1,y1){x0=Math.max(0,x0|0);y0=Math.max(0,y0|0);x1=Math.min(W-1,x1|0);y1=Math.min(H-1,y1|0);
    if(x1<x0||y1<y0)return;for(var y=y0;y<=y1;y++)for(var x=x0;x<=x1;x++)paintPixel(y*W+x);ctx.putImageData(out,0,0,x0,y0,x1-x0+1,y1-y0+1)}
  var statT=null;function stats(){clearTimeout(statT);statT=setTimeout(function(){var t='';
    if(removeBg){var n=0;for(var p=0;p<W*H;p++)if(alphaAt(p)<128)n++;var r=n/(W*H);
      t=r<0.04?'Presque rien n’a été retiré : le fond n’est pas uni. Utilisez la Gomme, ou la Baguette sur le fond.':r>0.95?'Le produit semble effacé : baissez la sensibilité ou utilisez Restaurer.':'';post({type:'stats',ratio:r})}
    msg.textContent=t;msg.style.display=t?'block':'none'},250)}
  function applyT(){wrap.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';$('fit').style.display=Math.abs(scale-fitScale)>0.01?'block':'none'}
  function fit(){var sw=stage.clientWidth,sh=stage.clientHeight,pad=16;fitScale=Math.min((sw-pad*2)/W,(sh-pad*2)/H);
    scale=fitScale;wrap.style.width=W+'px';wrap.style.height=H+'px';tx=(sw-W*scale)/2;ty=(sh-H*scale)/2;applyT()}
  $('fit').onclick=fit;window.addEventListener('resize',function(){if(W)fit()});

  /* ════════ Toucher : un doigt = outil, deux doigts = zoom ════════ */
  function toImg(cx,cy){var r=view.getBoundingClientRect();return{x:(cx-r.left)/r.width*W,y:(cy-r.top)/r.height*H}}
  function brushImg(){var r=view.getBoundingClientRect();return Math.max(1,brush/(r.width/W)/2)}
  var pts={},stroke=null,pinch=null,down=null;
  function snapshot(){undo.push({e:edits?edits.slice():null,m:magicPts.slice(),adj:JSON.parse(JSON.stringify(adj)),auto:useAuto,preset:preset,rb:removeBg});if(undo.length>25)undo.shift();$('undo').disabled=false}
  function dab(ix,iy,rad,val){var r2=rad*rad,x0=Math.floor(ix-rad),x1=Math.ceil(ix+rad),y0=Math.floor(iy-rad),y1=Math.ceil(iy+rad);
    for(var y=Math.max(0,y0);y<=Math.min(H-1,y1);y++)for(var x=Math.max(0,x0);x<=Math.min(W-1,x1);x++){var dx=x-ix,dy=y-iy;if(dx*dx+dy*dy<=r2)edits[y*W+x]=val}return[x0,y0,x1,y1]}
  function strokeTo(cx,cy){var p=toImg(cx,cy),rad=brushImg(),val=tool==='erase'?-1:1,last=stroke.last||p;
    var dx=p.x-last.x,dy=p.y-last.y,len=Math.sqrt(dx*dx+dy*dy),n=Math.max(1,Math.ceil(len/(rad/3))),bx0=1e9,by0=1e9,bx1=-1,by1=-1;
    for(var k=1;k<=n;k++){var b=dab(last.x+dx*k/n,last.y+dy*k/n,rad,val);bx0=Math.min(bx0,b[0]);by0=Math.min(by0,b[1]);bx1=Math.max(bx1,b[2]);by1=Math.max(by1,b[3])}
    if(!stroke.last){var b0=dab(p.x,p.y,rad,val);bx0=Math.min(bx0,b0[0]);by0=Math.min(by0,b0[1]);bx1=Math.max(bx1,b0[2]);by1=Math.max(by1,b0[3])}
    stroke.last=p;redrawRect(bx0,by0,bx1,by1)}
  function showRing(cx,cy){var r=stage.getBoundingClientRect();ring.style.display='block';ring.style.width=ring.style.height=brush+'px';ring.style.left=(cx-r.left)+'px';ring.style.top=(cy-r.top)+'px'}
  var editing=function(){return tab==='bg'&&removeBg};
  stage.addEventListener('pointerdown',function(e){if(!src)return;stage.setPointerCapture(e.pointerId);pts[e.pointerId]={x:e.clientX,y:e.clientY};var ids=Object.keys(pts);
    if(ids.length===2){if(stroke&&stroke.snap){edits=stroke.snap.e;undo.pop();$('undo').disabled=!undo.length;redraw()}stroke=null;down=null;ring.style.display='none';
      var a=pts[ids[0]],b=pts[ids[1]];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),s:scale,mx:(a.x+b.x)/2,my:(a.y+b.y)/2,tx:tx,ty:ty};return}
    if(ids.length>2)return;down={x:e.clientX,y:e.clientY,t:Date.now()};
    if(editing()&&tool!=='magic'){snapshot();stroke={snap:undo[undo.length-1],last:null};showRing(e.clientX,e.clientY);strokeTo(e.clientX,e.clientY)}});
  stage.addEventListener('pointermove',function(e){if(!pts[e.pointerId])return;pts[e.pointerId]={x:e.clientX,y:e.clientY};var ids=Object.keys(pts);
    if(pinch&&ids.length===2){var a=pts[ids[0]],b=pts[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
      var ns=Math.min(fitScale*8,Math.max(fitScale*0.8,pinch.s*d/pinch.d)),r=stage.getBoundingClientRect();
      var ox=pinch.mx-r.left,oy=pinch.my-r.top;tx=ox-(ox-pinch.tx)*ns/pinch.s+(mx-pinch.mx);ty=oy-(oy-pinch.ty)*ns/pinch.s+(my-pinch.my);scale=ns;applyT();return}
    if(stroke){showRing(e.clientX,e.clientY);strokeTo(e.clientX,e.clientY)}});
  function end(e){var wasTap=editing()&&down&&tool==='magic'&&Object.keys(pts).length===1&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<12&&Date.now()-down.t<600;
    delete pts[e.pointerId];if(Object.keys(pts).length<2)pinch=null;
    if(wasTap){var p=toImg(e.clientX,e.clientY);if(p.x>=0&&p.y>=0&&p.x<W&&p.y<H){snapshot();magicPts.push({x:Math.floor(p.x),y:Math.floor(p.y)});busyOn('Effacement…');setTimeout(function(){computeBase();redraw();busyOff()},20)}}
    if(stroke&&!Object.keys(pts).length){stroke=null;ring.style.display='none';stats()}down=null}
  stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);

  /* ════════ Réglages ════════ */
  function setTab(t){tab=t;var bs=document.querySelectorAll('.tab');for(var i=0;i<bs.length;i++)bs[i].classList.toggle('on',bs[i].getAttribute('data-tab')===t);
    $('sheetLook').classList.toggle('hidden',t!=='look');$('sheetBg').classList.toggle('hidden',t!=='bg');if(src)redraw()}
  var tabs=document.querySelectorAll('.tab');for(var ti=0;ti<tabs.length;ti++)tabs[ti].onclick=function(){setTab(this.getAttribute('data-tab'))};
  function setRemove(on){removeBg=on;$('bgOn').checked=on;$('bgTools').classList.toggle('hidden',!on);
    wrap.className=on&&bg!=='white'?'checker':'white';
    if(on&&!base){busyOn(aiAlpha?'Détection du produit…':'Analyse du fond…');setTimeout(function(){if(method!=='ai')autoTol();computeBase();redraw();busyOff()},20)}else redraw()}
  /* Première détection par couleur : sensibilité choisie toute seule — on baisse
   * tant que le « fond » avale presque toute la photo (produit proche du fond). */
  function autoTol(){var tries=[22,16,11,7,5];for(var k=0;k<tries.length;k++){var m=floodBorders(tries[k]),n=0;for(var p=0;p<m.length;p++)n+=m[p];
      if(n/m.length<0.9||k===tries.length-1){tol=tries[k];$('tol').value=tol;$('tolV').textContent=tol;return}}}
  $('bgOn').onchange=function(){snapshot();setRemove(this.checked)};
  function setTool(t){tool=t;var bs=document.querySelectorAll('.tool');for(var i=0;i<bs.length;i++)bs[i].classList.toggle('on',bs[i].getAttribute('data-tool')===t);
    $('rowTol').classList.toggle('hidden',t!=='magic');$('rowSize').classList.toggle('hidden',t==='magic');
    $('hint').textContent=t==='magic'?'Touchez un reste de fond pour l’effacer. Deux doigts : zoomer.':t==='erase'?'Passez le doigt sur ce qu’il faut effacer. Deux doigts : zoomer.':'Passez le doigt sur une partie du produit effacée par erreur.';
    if(src)redraw()}
  var tb=document.querySelectorAll('.tool');for(var i=0;i<tb.length;i++)tb[i].onclick=function(){setTool(this.getAttribute('data-tool'))};
  var tolT=null;$('tol').oninput=function(){tol=+this.value;$('tolV').textContent=tol;clearTimeout(tolT);tolT=setTimeout(function(){computeBase();redraw()},120)};
  $('size').oninput=function(){brush=+this.value;$('sizeV').textContent=brush};
  $('undo').onclick=function(){var s=undo.pop();if(!s)return;
    var lookChanged=JSON.stringify(s.adj)!==JSON.stringify(adj)||s.auto!==useAuto;
    if(s.e)edits=s.e;var magicChanged=s.m.length!==magicPts.length;magicPts=s.m;adj=s.adj;useAuto=s.auto;preset=s.preset;
    if(s.rb!==removeBg){removeBg=s.rb;$('bgOn').checked=s.rb;$('bgTools').classList.toggle('hidden',!s.rb);wrap.className=s.rb&&bg!=='white'?'checker':'white'}
    if(magicChanged&&base)computeBase();renderPresets();renderAdj();if(lookChanged)enhance();redraw();this.disabled=!undo.length};
  function cmp(on){comparing=on;$('badge').style.display=on?'block':'none';redraw()}
  $('cmp').addEventListener('pointerdown',function(){cmp(true)});['pointerup','pointerleave','pointercancel'].forEach(function(ev){$('cmp').addEventListener(ev,function(){if(comparing)cmp(false)})});
  function setBg(b){bg=b;$('bgW').classList.toggle('on',b==='white');$('bgT').classList.toggle('on',b!=='white');wrap.className=removeBg&&b!=='white'?'checker':'white'}
  $('bgW').onclick=function(){setBg('white')};$('bgT').onclick=function(){setBg('transparent')};
  function updMethod(){var b=$('method');if(!aiAlpha){b.style.display='none';return}b.style.display='flex';b.textContent=method==='ai'?'Méthode : IA':'Méthode : couleur';
    $('bgSub').textContent=method==='ai'?'Produit détecté par l’IA du téléphone':'Fond détecté par sa couleur'}
  $('method').onclick=function(){snapshot();method=method==='ai'?'color':'ai';updMethod();computeBase();redraw()};
  function busyOn(t){$('busyText').textContent=t;busy.style.display='flex'}function busyOff(){busy.style.display='none'}

  /* ════════ Chargement ════════ */
  function loadImg(url){return new Promise(function(ok,ko){var im=new Image();im.onload=function(){ok(im)};im.onerror=ko;im.src=url})}
  function load(m){busyOn('Amélioration de la photo…');
    loadImg(m.image).then(function(im){W=im.naturalWidth;H=im.naturalHeight;view.width=W;view.height=H;
      var c=document.createElement('canvas');c.width=W;c.height=H;var cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(im,0,0);src=cx.getImageData(0,0,W,H);
      enh=new ImageData(W,H);out=ctx.createImageData(W,H);edits=new Int8Array(W*H);autoParams=analyse(src.data);
      var ts=96,sc=document.createElement('canvas');sc.width=ts;sc.height=ts;var sx=sc.getContext('2d');var side=Math.min(W,H);sx.drawImage(im,(W-side)/2,(H-side)/2,side,side,0,0,ts,ts);small=sx.getImageData(0,0,ts,ts);
      return m.mask?loadImg(m.mask).then(function(mi){var c2=document.createElement('canvas');c2.width=W;c2.height=H;var x2=c2.getContext('2d',{willReadFrequently:true});x2.drawImage(mi,0,0,W,H);
        var md=x2.getImageData(0,0,W,H).data;aiAlpha=new Uint8Array(W*H);
        for(var p=0;p<W*H;p++){var c0=md[p*4+3]/255,t=Math.min(1,Math.max(0,(c0-0.3)/0.4));aiAlpha[p]=Math.round(255*t*t*(3-2*t))}method='ai'}).catch(function(){aiAlpha=null}):null})
    .then(function(){
      /* Réglages photo du vendeur : style, intensité, fond, cadrage */
      if(typeof m.strength==='number')strength=Math.min(1,Math.max(0.2,m.strength));
      var pk=PRESETS.filter(function(x){return x.k===m.preset})[0]||PRESETS[1];preset=pk.k;useAuto=pk.auto;adj=presetValues(pk);
      if(m.bg==='transparent')setBg('transparent');if(m.crop===false)$('crop').checked=false;
      updMethod();renderPresets();renderAdj();enhance();fit();
      if(m.removeBg||m.startTab==='bg'){removeBg=true;$('bgOn').checked=true;$('bgTools').classList.remove('hidden');wrap.className=bg!=='white'?'checker':'white';
        if(method!=='ai')autoTol();computeBase()}
      if(m.startTab==='bg')setTab('bg');
      redraw();busyOff();
      post({type:'ready',width:W,height:H,method:method});
      /* « Arranger en un toucher » : tout est appliqué, on rend la photo tout de suite */
      if(m.autoExport)window.exportResult()})
    .catch(function(){busyOff();post({type:'error',message:'Impossible d’ouvrir cette photo.'})})}

  /* ════════ Résultat ════════ */
  window.exportResult=function(){if(!src){post({type:'error',message:'Photo pas encore prête.'});return}
    busyOn('Préparation de la photo…');
    setTimeout(function(){try{
      var e=enh.data,mime=removeBg&&bg!=='white'?'image/png':'image/jpeg',o;
      if(!removeBg){o=document.createElement('canvas');o.width=W;o.height=H;o.getContext('2d').putImageData(enh,0,0)}
      else{var a=new Uint8Array(W*H);for(var p=0;p<W*H;p++)a[p]=alphaAt(p);
        var x0=W,y0=H,x1=-1,y1=-1,f=new Uint8Array(W*H);
        for(var y=0;y<H;y++)for(var x=0;x<W;x++){var s=0,c=0;for(var dy=-1;dy<=1;dy++){var yy=y+dy;if(yy<0||yy>=H)continue;for(var dx=-1;dx<=1;dx++){var xx=x+dx;if(xx<0||xx>=W)continue;s+=a[yy*W+xx];c++}}
          var v=Math.round(s/c);f[y*W+x]=v;if(v>40){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
        if(x1<0){busyOff();post({type:'error',message:'Tout a été effacé : restaurez le produit avant de terminer.'});return}
        var img=new ImageData(W,H),q=img.data;
        for(var p2=0;p2<W*H;p2++){var i=p2*4,al=f[p2]/255;
          if(bg==='white'){q[i]=Math.round(e[i]*al+255*(1-al));q[i+1]=Math.round(e[i+1]*al+255*(1-al));q[i+2]=Math.round(e[i+2]*al+255*(1-al));q[i+3]=255}
          else{q[i]=e[i];q[i+1]=e[i+1];q[i+2]=e[i+2];q[i+3]=f[p2]}}
        var full=document.createElement('canvas');full.width=W;full.height=H;full.getContext('2d').putImageData(img,0,0);
        if($('crop').checked){var bw=x1-x0+1,bh=y1-y0+1,side=Math.round(Math.max(bw,bh)*1.18),S=Math.min(side,1600),k=S/side;
          o=document.createElement('canvas');o.width=S;o.height=S;var oc=o.getContext('2d');if(bg==='white'){oc.fillStyle='#fff';oc.fillRect(0,0,S,S)}
          oc.imageSmoothingQuality='high';oc.drawImage(full,x0,y0,bw,bh,(S-bw*k)/2,(S-bh*k)/2,bw*k,bh*k)}
        else o=full}
      post({type:'result',mime:mime,dataUrl:o.toDataURL(mime,0.92),enhanced:preset!=='orig',removedBg:removeBg});busyOff()
    }catch(err){busyOff();post({type:'error',message:'La photo n’a pas pu être préparée.'})}},30)};

  window.__shoneyaLoad=function(m){if(m&&m.image)load(m)};
  function onMsg(ev){var m;try{m=JSON.parse(ev.data)}catch(e){return}if(m&&m.type==='load')load(m)}
  document.addEventListener('message',onMsg);window.addEventListener('message',onMsg);
  post({type:'boot'});
})();
</script></body></html>`;
