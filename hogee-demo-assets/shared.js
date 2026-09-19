const $=id=>document.getElementById(id);
function toast(m){const t=$("toast");if(!t)return;t.innerHTML="✦ "+m;t.classList.add("on");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("on"),2400)}
function getCredit(){try{return +(localStorage.getItem("hogee-credit")||940)}catch(e){return 940}}
function setCredit(v){try{localStorage.setItem("hogee-credit",v)}catch(e){}const el=$("creditNum");if(el)el.textContent=v}
function spend(n){const c=getCredit();if(c<n){toast("积分不足 ◆"+c+"，请开通会员");return false}setCredit(c-n);return true}
function goNext(url,fee){if(fee&&!spend(fee))return;location.href=url}
function openModal(id){$(id).classList.add("on")}
function closeModal(id){$(id).classList.remove("on")}
function setTheme(t){document.body.classList.toggle("light",t==="light");const b=$("themeBtn");if(b)b.textContent=t==="light"?"🌙":"☀️";try{localStorage.setItem("hogee-theme",t)}catch(e){}}
function resetDemo(){setCredit(940);try{localStorage.removeItem("hogee-prog");localStorage.removeItem("hogee-store")}catch(e){}paintProg();toast("演示已重置：积分 ◆940 · 工作流进度与存储已清空")}
(function(){
  const b=$("themeBtn");if(b)b.onclick=()=>setTheme(document.body.classList.contains("light")?"dark":"light");
  try{if(localStorage.getItem("hogee-theme")==="light")setTheme("light")}catch(e){}
  const c=$("creditNum");if(c)c.textContent=getCredit();
  document.querySelectorAll("#sideNav .navItem").forEach(n=>n.classList.toggle("on",n.dataset.nav===document.body.dataset.page));
  const team=document.querySelector('#sideNav .navItem[data-nav="team"]');
  if(team)team.onclick=()=>toast("原型演示：「团队」模块规划中（成员 / 邀请 / 权限）");
})();
/* 模型选择弹出框 */
const MODELS=[
 {n:"Seedance 2.5",d:"均衡 · 运镜稳定 · 适合短剧对峙戏",tag:"推荐"},
 {n:"Minimax H3 Max",d:"高保真 · 表演细腻 · 高积分消耗"},
 {n:"Wan 3.0",d:"轻量快速 · 低积分 · 草稿迭代"}
];
function popupModel(anchor){
  closeModelMenu();
  const cur=anchor.querySelector("b").textContent;
  const m=document.createElement("div");m.className="modelMenu";m.id="modelMenu";
  MODELS.forEach(x=>{
    const btn=document.createElement("button");
    btn.innerHTML=`<span class="mn">${x.tag?'<span class="mTag">'+x.tag+"</span>":""}${x.n}${x.n===cur?'<span class="cur">✓ 当前</span>':""}</span><span class="md">${x.d}</span>`;
    btn.onclick=()=>{anchor.querySelector("b").textContent=x.n;closeModelMenu();toast("模型已切换："+x.n+"（影响后续生成调用）")};
    m.appendChild(btn);
  });
  document.body.appendChild(m);
  const r=anchor.getBoundingClientRect();
  m.style.top=Math.min(r.bottom+6,innerHeight-210)+"px";
  m.style.left=Math.min(Math.max(8,r.left),innerWidth-270)+"px";
}
function closeModelMenu(){const m=$("modelMenu");if(m)m.remove()}
document.addEventListener("click",e=>{const m=$("modelMenu");if(m&&!m.contains(e.target))closeModelMenu()});
/* ============ T1: 工作流进度 ============ */
const ORDER=["create","outline","assets","episodes","studio"];
function getProg(){try{return JSON.parse(localStorage.getItem("hogee-prog")||"{}")}catch(e){return{}}}
function setUnlocked(i){const p=getProg();if((p.unlocked||0)<i){p.unlocked=i;try{localStorage.setItem("hogee-prog",JSON.stringify(p))}catch(e){}}paintProg()}
const _goNext=goNext;
goNext=function(url,fee){if(fee&&!spend(fee))return;const i=ORDER.indexOf(url.replace(".html",""));if(i>-1)setUnlocked(i);location.href=url};
function paintProg(){
  const page=document.body.dataset.page;
  const cur=ORDER.indexOf(page==="studio"?"episodes":page);
  document.querySelectorAll(".step3").forEach(s=>{
    const i=ORDER.indexOf(s.dataset.step);
    s.classList.toggle("done",i>-1&&i<cur);
  });
  const hp=$("homeProgress");
  if(hp){const names=["待开始","1/3 · 剧情大纲","2/3 · 资产生成","3/3 · 分集视频","3/3 · 片段生产中"];
    hp.textContent=names[Math.min(getProg().unlocked||0,4)]}
}
/* 通用选项弹窗（风格/比例/清晰度等） */
function popupOpts(anchor,title,opts,cb){
  closeModelMenu();
  const m=document.createElement("div");m.className="modelMenu";m.id="modelMenu";
  if(title){const h=document.createElement("div");h.className="mmTitle";h.textContent=title;m.appendChild(h)}
  opts.forEach(x=>{const b=document.createElement("button");
    b.innerHTML=`<span class="mn">${x.n}${x.cur?'<span class="cur">✓ 当前</span>':""}</span>${x.d?`<span class="md">${x.d}</span>`:""}`;
    b.onclick=()=>{closeModelMenu();cb(x.n)};m.appendChild(b)});
  document.body.appendChild(m);
  const r=anchor.getBoundingClientRect();
  m.style.top=Math.min(r.bottom+6,innerHeight-320)+"px";
  m.style.left=Math.min(Math.max(8,r.left),innerWidth-270)+"px";
}
/* 通知中心 */
const NOTIFS=[
 {i:"✅",t:"片段 1 视频已生成（480P · 13s）",d:"2 分钟前"},
 {i:"🎭",t:"形象资产已生成：4 角色 + 1 场景，一致性已锁定",d:"1 小时前"},
 {i:"◆",t:"积分消耗 ◆60 · 进入片段编辑器",d:"1 小时前"},
 {i:"🎬",t:"分集拆分完成：第1集 · 异世囚笼（3 片段 / 37s）",d:"昨天"},
 {i:"📢",t:"系统公告：Seedance 2.5 视频模型已全量开放",d:"昨天"},
 {i:"💡",t:"新模板上架：爆款拆解《逃跑男友》结构已可套用",d:"2 天前"}
];
function toggleNotif(e){
  e.stopPropagation();
  const old=$("notifPanel");if(old){old.remove();return}
  const p=document.createElement("div");p.id="notifPanel";
  p.innerHTML=`<div class="nh2">🔔 通知中心<button onclick="this.closest('#notifPanel').remove();toast('已全部标记为已读')">全部已读</button></div>
  <div class="list">${NOTIFS.map(n=>`<div class="ni"><span class="ic">${n.i}</span><div><div class="t">${n.t}</div><div class="d">${n.d}</div></div></div>`).join("")}</div>`;
  document.body.appendChild(p);
  const r=e.currentTarget.getBoundingClientRect();
  p.style.top=Math.min(r.bottom+8,innerHeight-360)+"px";
  p.style.left=Math.max(8,Math.min(r.right-308,innerWidth-316))+"px";
}
document.addEventListener("click",e=>{const p=$("notifPanel");if(p&&!p.contains(e.target))p.remove()});
/* 成片演示下载 */
function downloadDemo(name){const a=document.createElement("a");a.href="clip1.mp4";a.download=name||"逆命木叶_第1集_720P.mp4";document.body.appendChild(a);a.click();a.remove();toast("已开始下载："+a.download)}
paintProg();
