# 可粘贴片段 · HTML 演示大纲进度条

把下面三段分别放进演示 HTML：`style`、`body` 末（canvas 外）、`script`。

## 1. CSS

```css
.nav-outline{position:fixed;right:10px;top:50%;transform:translateY(-50%);z-index:100;display:flex;flex-direction:column;align-items:flex-end;gap:4px;padding:16px 10px 16px 12px;max-height:90vh;overflow:visible;background:transparent;border:none;box-shadow:none;pointer-events:auto}
.nav-item{position:relative;display:flex;align-items:center;justify-content:flex-end;gap:8px;width:auto;min-height:16px;padding:4px 2px 4px 8px;margin:0;background:transparent;border:none;cursor:pointer;overflow:visible}
.nav-item.nav-sec{margin-top:6px}
.nav-item.nav-sec:first-child{margin-top:0}
.nav-item .nav-lbl{position:static;flex:0 1 auto;max-width:0;opacity:0;overflow:hidden;white-space:nowrap;pointer-events:none;font-family:inherit;font-size:12px;line-height:1.25;color:#e8e8ea;background:rgba(12,14,18,.94);border:1px solid rgba(255,255,255,.14);padding:0;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.4);transition:max-width .2s ease,opacity .15s ease,padding .15s ease;text-align:right}
.nav-item.nav-sec .nav-lbl{font-size:12px;font-weight:600;color:#fff}
.nav-item.nav-page .nav-lbl{font-size:11px;color:#c8c9ce}
.nav-item:hover .nav-lbl,.nav-item:focus-visible .nav-lbl,.nav-outline:hover .nav-item.active .nav-lbl{max-width:260px;opacity:1;padding:5px 10px}
.nav-item .nav-tick{position:relative;display:block;width:14px;height:2px;border-radius:2px;background:rgba(255,255,255,.35);flex-shrink:0;transition:width .2s,height .2s,background .2s,box-shadow .2s}
.nav-item .nav-tick::after{content:"";position:absolute;inset:-8px -10px}
.nav-item.nav-sec .nav-tick{width:18px;height:2px;background:rgba(255,255,255,.5)}
.nav-item.done .nav-tick{background:rgba(86,131,218,.45)}
.nav-item.nav-sec.done .nav-tick{background:rgba(86,131,218,.6)}
.nav-item.active .nav-tick,.nav-item.nav-sec.in-section .nav-tick{width:20px;height:3px;background:#5683da;box-shadow:0 0 10px rgba(86,131,218,.8)}
.nav-item.active .nav-lbl,.nav-item.nav-sec.in-section .nav-lbl{color:#5683da}
```

## 2. HTML（放在主 deck 容器外）

```html
<div class="nav-outline" id="navDots" aria-label="页面导航"></div>
```

## 3. JS（与翻页逻辑对接；按稿改 navSpec）

```js
(function(){
  var slides=document.querySelectorAll('.slide');
  var total=slides.length;
  var current=0;
  var navDots=document.getElementById('navDots');
  /* sec=大章节长标题；page=小节短标题；idx 与 .slide 下标一致 */
  var navSpec=[
    {kind:'sec', start:0, end:0, label:'示例大章 · 封面'},
    {kind:'page', idx:0, label:'封面'},
    {kind:'sec', start:1, end:2, label:'示例大章 · 痛点与对比'},
    {kind:'page', idx:1, label:'痛点'},
    {kind:'page', idx:2, label:'对比'}
    // …按实际页数续写
  ];
  var pageBtns={}, secBtns=[];
  navSpec.forEach(function(spec){
    var b=document.createElement('button');
    b.type='button';
    if(spec.kind==='sec'){
      b.className='nav-item nav-sec';
      b.setAttribute('aria-label',spec.label);
      b.innerHTML='<span class="nav-lbl">'+spec.label+'</span><span class="nav-tick" aria-hidden="true"></span>';
      b.onclick=function(){go(spec.start)};
      navDots.appendChild(b);
      secBtns.push({el:b,start:spec.start,end:spec.end});
    }else{
      b.className='nav-item nav-page'+(spec.idx===0?' active':'');
      b.setAttribute('aria-label',spec.label);
      b.innerHTML='<span class="nav-lbl">'+spec.label+'</span><span class="nav-tick" aria-hidden="true"></span>';
      (function(idx){b.onclick=function(){go(idx)}})(spec.idx);
      navDots.appendChild(b);
      pageBtns[spec.idx]=b;
    }
  });
  function syncNav(idx){
    for(var i=0;i<total;i++){
      var el=pageBtns[i]; if(!el) continue;
      el.classList.remove('active','done');
      if(i===idx) el.classList.add('active');
      else if(i<idx) el.classList.add('done');
    }
    for(var s=0;s<secBtns.length;s++){
      var sec=secBtns[s];
      sec.el.classList.remove('in-section','done');
      if(idx>=sec.start && idx<=sec.end) sec.el.classList.add('in-section');
      else if(idx>sec.end) sec.el.classList.add('done');
    }
  }
  function go(idx){
    if(idx<0||idx>=total)return;
    slides[current].classList.remove('active');
    current=idx;
    slides[current].classList.add('active');
    syncNav(current);
    // 若有页码 DOM：pgNum.textContent=String(current+1).padStart(2,'0');
  }
  // 把现有键盘/滚轮翻页也改成调用 go(current±1)
  window.__htmlDemoNavGo=go;
})();
```

## 文案写法

- 大章：一句话讲清本节目的（可含顿号/间隔号）  
- 小节：2～4 字，能扫读即可（选型、提效、扫码…）
