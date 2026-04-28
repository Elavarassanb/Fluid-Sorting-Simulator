/*
 * Fluid Sorting Simulator v3.0 — Warehouse Theme
 * app.js — All game logic, history, sounds, Arduino, responsive sizing
 */
(() => {

  /* ═══ SECTION 1: DOM REFERENCES ═══ */
  const screenLogin   = document.getElementById('screen-login');
  const screenMenu    = document.getElementById('screen-menu');
  const screenGame    = document.getElementById('screen-game');
  const screenResults = document.getElementById('screen-results');
  const screenHistory = document.getElementById('screen-history');

  const loginInput       = document.getElementById('login-id-input');
  const btnLoginSubmit   = document.getElementById('btn-login-submit');
  const loginError       = document.getElementById('login-error');
  const menuUserDisplay  = document.getElementById('menu-user-display');
  const serialStatusWeb  = document.getElementById('serial-status-web');
  const btnConnectSerial = document.getElementById('btn-connect-serial');
  const conveyorTrack    = document.getElementById('conveyor-track');
  const hudLevel         = document.getElementById('hud-level');
  const hudProgress      = document.getElementById('hud-progress');
  const hudStatus        = document.getElementById('hud-status');
  const hudTimer         = document.getElementById('hud-timer');
  const btnPick          = document.getElementById('btn-pick');
  const btnRestart       = document.getElementById('btn-restart');
  const btnExportCsv     = document.getElementById('btn-export-csv');
  const btnGotoHistory   = document.getElementById('btn-goto-history');
  const historyBody      = document.getElementById('history-body');
  const btnBackFromHist  = document.getElementById('btn-back-from-history');
  const btnViewHistory   = document.getElementById('btn-view-history');
  const btnExportHistory = document.getElementById('btn-export-history');

  /* ═══ SECTION 2: STATE ═══ */
  let serialPort = null, serialReader = null, serialConnected = false;
  let currentUser = '', config = null, gameImages = [], level = 1, speedSec = 10;
  let isPicked = false, pickedLabel = null, animationId = null, conveyorX = 0;
  let lastTimestamp = 0, paused = false, gameStartTime = 0, gameEndTime = 0;
  let results = [], spilloverChecked = new Set();

  /* ═══ SECTION 3: RESPONSIVE DIMENSIONS ═══ */
  function getResponsiveDimensions() {
    const vw = window.innerWidth;
    const labelW = Math.min(Math.round(vw * 0.45), 600);
    const labelH = Math.round(labelW * 1.25);
    const gap = Math.round(labelW * 0.1);
    const total = labelW + gap;
    const pickTolerance = Math.round(labelW * 0.55);
    const root = document.documentElement.style;
    root.setProperty('--label-w', labelW + 'px');
    root.setProperty('--label-h', labelH + 'px');
    root.setProperty('--label-gap', gap + 'px');
    root.setProperty('--pick-zone-offset', pickTolerance + 'px');
    return { labelW, labelH, gap, total, pickTolerance };
  }
  let DIM = getResponsiveDimensions();
  window.addEventListener('resize', () => { DIM = getResponsiveDimensions(); });

  /* ═══ SECTION 4: SOUND FEEDBACK ═══ */
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  function playBeep() {
    try { ensureAudio(); const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type='sine'; o.frequency.value=880; g.gain.value=0.3; o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+0.1); } catch(e){}
  }
  function playDing() {
    try { ensureAudio(); const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type='sine'; o.frequency.value=1200; g.gain.setValueAtTime(0.35,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.01,audioCtx.currentTime+0.3); o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+0.3); } catch(e){}
  }
  function playBuzz() {
    try { ensureAudio(); const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type='sawtooth'; o.frequency.value=150; g.gain.setValueAtTime(0.3,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.01,audioCtx.currentTime+0.25); o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+0.25); } catch(e){}
  }

  /* ═══ SECTION 5: CONFIG ═══ */
  config = {
    "images": [
      {"file":"label_01.png","node":1},{"file":"label_05.png","node":1},{"file":"label_11.png","node":1},{"file":"label_17.png","node":1},{"file":"label_23.png","node":1},{"file":"label_29.png","node":1},{"file":"label_39.png","node":1},
      {"file":"label_02.png","node":2},{"file":"label_06.png","node":2},{"file":"label_13.png","node":2},{"file":"label_19.png","node":2},{"file":"label_25.png","node":2},{"file":"label_31.png","node":2},
      {"file":"label_03.png","node":3},{"file":"label_08.png","node":3},{"file":"label_14.png","node":3},{"file":"label_20.png","node":3},{"file":"label_26.png","node":3},{"file":"label_33.png","node":3},
      {"file":"label_04.png","node":4},{"file":"label_10.png","node":4},{"file":"label_16.png","node":4},{"file":"label_21.png","node":4},{"file":"label_28.png","node":4},{"file":"label_35.png","node":4},
      {"file":"label_07.png","node":null},{"file":"label_09.png","node":null},{"file":"label_12.png","node":null},{"file":"label_15.png","node":null},{"file":"label_18.png","node":null},{"file":"label_22.png","node":null},{"file":"label_24.png","node":null},{"file":"label_27.png","node":null},{"file":"label_30.png","node":null},{"file":"label_32.png","node":null},{"file":"label_34.png","node":null},{"file":"label_36.png","node":null},{"file":"label_37.png","node":null},{"file":"label_38.png","node":null},{"file":"label_40.png","node":null}
    ],
    "levels": {"1":{"name":"Easy","speedSec":10},"2":{"name":"Medium","speedSec":7},"3":{"name":"Hard","speedSec":5},"4":{"name":"Expert","speedSec":3}}
  };

  /* ═══ SECTION 6: IMAGE PRELOAD ═══ */
  function preloadImages() {
    let loaded = 0; const total = config.images.length;
    return new Promise(resolve => {
      config.images.forEach(d => {
        const img = new Image();
        img.onload = () => { loaded++; if (loaded >= total) resolve(true); };
        img.onerror = () => { const r = new Image(); r.onload = r.onerror = () => { loaded++; if (loaded >= total) resolve(true); }; r.src = `images/${d.file}`; };
        img.src = `images/${d.file}`;
      });
      setTimeout(() => resolve(true), 10000);
    });
  }

  /* ═══ SECTION 7: ARDUINO ═══ */
  async function connectArduino() {
    if (!('serial' in navigator)) { alert('Web Serial API not supported. Use Chrome/Edge.'); return; }
    try { serialPort = await navigator.serial.requestPort(); await serialPort.open({baudRate:9600,dataBits:8,stopBits:1,parity:'none'}); serialConnected = true; updateSerialStatus(true); startSerialReader(); }
    catch (e) { updateSerialStatus(false, e.message); }
  }
  async function startSerialReader() {
    if (!serialPort || !serialPort.readable) return;
    const td = new TextDecoderStream(); serialPort.readable.pipeTo(td.writable); serialReader = td.readable.getReader();
    try { while (true) { const {value,done} = await serialReader.read(); if (done) break; value.split('\n').forEach(l => { const c=l.trim(); if (c==='P') doPick(); else if (['1','2','3','4'].includes(c)) doDrop(parseInt(c)); }); } }
    catch (e) { serialConnected = false; updateSerialStatus(false, 'Connection lost — click to reconnect'); }
    finally { if (serialReader) serialReader.releaseLock(); }
  }
  async function disconnectArduino() {
    try { if (serialReader) { await serialReader.cancel(); serialReader=null; } if (serialPort) { await serialPort.close(); serialPort=null; } } catch(e){}
    serialConnected = false; updateSerialStatus(false);
  }
  function updateSerialStatus(connected, error) {
    if (connected) { serialStatusWeb.textContent='✅ Connected'; serialStatusWeb.className='status-pill on'; btnConnectSerial.textContent='📴 Disconnect'; }
    else { serialStatusWeb.textContent=error?`❌ ${error}`:'❌ Not Connected'; serialStatusWeb.className='status-pill off'; btnConnectSerial.textContent='🔌 Connect Arduino'; }
  }

  /* ═══ SECTION 8: SCREENS & UTILS ═══ */
  function showScreen(s) { [screenLogin,screenMenu,screenGame,screenResults,screenHistory].forEach(x=>{if(x)x.classList.remove('active');}); s.classList.add('active'); }
  function shuffle(a) { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }

  /* ═══ SECTION 9: CONVEYOR & ANIMATION ═══ */
  function buildConveyor() {
    conveyorTrack.innerHTML = '';
    gameImages.forEach((img, idx) => {
      const div = document.createElement('div'); div.className = 'conveyor-label'; div.dataset.index = idx;
      if (img.node === null) div.classList.add('irrelevant');
      const el = document.createElement('img'); el.src = `images/${img.file}`; el.alt = img.file;
      el.onerror = () => { el.style.display='none'; div.style.background='#21262d'; div.innerHTML+=`<span style="color:#f0b429;font-size:1.2rem;">⚠️ ${img.file}</span>`; };
      div.appendChild(el); conveyorTrack.appendChild(div);
    });
  }
  function getLabelInPickZone() {
    const cr = document.getElementById('conveyor').getBoundingClientRect(), cx = cr.left+cr.width/2;
    for (const l of conveyorTrack.querySelectorAll('.conveyor-label')) { const r=l.getBoundingClientRect(); if (Math.abs(r.left+r.width/2-cx)<DIM.pickTolerance) return l; }
    return null;
  }
  function animate(ts) {
    if (!lastTimestamp) lastTimestamp=ts; const d=(ts-lastTimestamp)/1000; lastTimestamp=ts;
    if (!paused) {
      conveyorX -= (DIM.total/speedSec)*d;
      conveyorTrack.style.transform = `translateY(-50%) translateX(${conveyorX}px)`;
      updatePickZoneHighlight(); checkSpillover();
      if (Math.abs(conveyorX) > gameImages.length*DIM.total+300) { endGame(); return; }
    }
    hudTimer.textContent = `⏱ ${speedSec}s/label`;
    animationId = requestAnimationFrame(animate);
  }
  function updatePickZoneHighlight() {
    const cr=document.getElementById('conveyor').getBoundingClientRect(), cx=cr.left+cr.width/2;
    conveyorTrack.querySelectorAll('.conveyor-label').forEach(l => {
      const r=l.getBoundingClientRect();
      if (Math.abs(r.left+r.width/2-cx)<DIM.pickTolerance && !l.classList.contains('picked') && !l.classList.contains('missed')) l.classList.add('in-pick-zone');
      else l.classList.remove('in-pick-zone');
    });
  }
  function checkSpillover() {
    const cr=document.getElementById('conveyor').getBoundingClientRect(), pzr=cr.left+cr.width/2+DIM.pickTolerance;
    conveyorTrack.querySelectorAll('.conveyor-label').forEach(l => {
      const idx=parseInt(l.dataset.index), img=gameImages[idx], r=l.getBoundingClientRect();
      if (r.right<pzr-200 && !spilloverChecked.has(idx)) {
        spilloverChecked.add(idx);
        if (img.node!==null && !l.classList.contains('picked')) { l.classList.add('missed'); results.push({file:img.file,node:img.node,action:'spillover',droppedNode:null}); }
        if (img.node===null && !l.classList.contains('picked')) results.push({file:img.file,node:null,action:'ignored',droppedNode:null});
      }
    });
    hudProgress.textContent = `${results.length} / ${gameImages.length}`;
  }

  /* ═══ SECTION 10: PICK & DROP ═══ */
  function doPick() {
    if (isPicked) return; const l=getLabelInPickZone(); if (!l) return;
    const idx=parseInt(l.dataset.index), img=gameImages[idx]; if (spilloverChecked.has(idx)) return;
    isPicked=true; paused=true; pickedLabel={idx,img,element:l}; spilloverChecked.add(idx);
    l.classList.add('picked'); l.classList.remove('in-pick-zone');
    hudStatus.textContent='📦 ITEM HELD — SELECT BIN'; hudStatus.className='status-picked';
    playBeep();
  }
  function doDrop(node) {
    if (!isPicked||!pickedLabel) return; const img=pickedLabel.img;
    if (img.node===null) { results.push({file:img.file,node:null,action:'falsepick',droppedNode:node}); flashNode(node,'wrong'); playBuzz(); }
    else if (img.node===node) { results.push({file:img.file,node:img.node,action:'correct',droppedNode:node}); flashNode(node,'highlight'); playDing(); }
    else { results.push({file:img.file,node:img.node,action:'missorted',droppedNode:node}); flashNode(node,'wrong'); playBuzz(); }
    isPicked=false; paused=false; pickedLabel=null; lastTimestamp=0;
    hudStatus.textContent='WATCHING'; hudStatus.className='status-idle';
    hudProgress.textContent=`${results.length} / ${gameImages.length}`;
  }
  function flashNode(n,c) { const b=document.querySelector(`.node-box[data-node="${n}"]`); if(b){b.classList.add(c);setTimeout(()=>b.classList.remove(c),800);} }

  /* ═══ SECTION 11: HISTORY ═══ */
  const HISTORY_KEY = 'fluid_sorting_history';
  function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY))||[]; } catch(e){ return []; } }
  function saveSession(s) { const h=loadHistory(); h.push(s); try{localStorage.setItem(HISTORY_KEY,JSON.stringify(h));}catch(e){} }

  function renderHistory() {
    const h=loadHistory(); if(!historyBody) return; historyBody.innerHTML='';
    if (!h.length) { historyBody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:2rem;color:#8b949e;">No sessions yet. Play a game first!</td></tr>'; return; }
    [...h].reverse().forEach(s => {
      const acc=parseInt(s.accuracy)||0;
      const dotClass = acc>=90?'green':acc>=75?'blue':acc>=50?'orange':'red';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.user||'—'}</td><td>${s.date||'—'}</td><td>${s.level||'—'}</td><td>${s.correct||0}</td><td>${s.missorted||0}</td><td>${s.spillover||0}</td><td>${s.falsepick||0}</td><td><span class="accuracy-dot ${dotClass}"></span>${s.accuracy||'0%'}</td><td>${s.time||'0:00'}</td>`;
      historyBody.appendChild(tr);
    });
  }

  function exportHistoryCSV() {
    const h=loadHistory(); if(!h.length){alert('No history to export.');return;}
    const hdr=['Associate ID','Date','Level','Correct','Mis-Sorted','Spillover','False Picks','Accuracy','Time'];
    let csv=hdr.join(',')+'\n';
    h.forEach(s=>{csv+=[s.user,s.date,s.level,s.correct,s.missorted,s.spillover,s.falsepick,s.accuracy,s.time].map(v=>`"${v}"`).join(',')+'\n';});
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}), url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=`sorting_history_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  /* ═══ SECTION 12: GAME LIFECYCLE ═══ */
  function handleLogin() {
    const id=loginInput.value.trim();
    if(!id){loginError.textContent='⚠️ Please type your name or ID first!';loginError.style.display='block';return;}
    currentUser=id; loginError.style.display='none'; menuUserDisplay.textContent=`👤 ${currentUser}`; showScreen(screenMenu);
  }

  function startGame(selectedLevel) {
    level=selectedLevel; speedSec=config.levels[level].speedSec; DIM=getResponsiveDimensions();
    gameImages=shuffle(config.images); isPicked=false; pickedLabel=null; paused=false;
    conveyorX=window.innerWidth; lastTimestamp=0; results=[]; spilloverChecked=new Set(); gameStartTime=Date.now();
    hudLevel.textContent=`Level: ${config.levels[level].name}`; hudProgress.textContent=`0 / ${gameImages.length}`;
    hudStatus.textContent='WATCHING'; hudStatus.className='status-idle';
    buildConveyor(); conveyorTrack.style.transform=`translateY(-50%) translateX(${conveyorX}px)`;
    showScreen(screenGame); setTimeout(()=>{animationId=requestAnimationFrame(animate);},1000);
  }

  function endGame() {
    if(animationId) cancelAnimationFrame(animationId);
    gameImages.forEach((img,idx)=>{
      if(!spilloverChecked.has(idx)){
        if(img.node!==null) results.push({file:img.file,node:img.node,action:'spillover',droppedNode:null});
        else results.push({file:img.file,node:null,action:'ignored',droppedNode:null});
      }
    });
    showResults();
  }

  function showResults() {
    gameEndTime=Date.now();
    const totalTimeSec=Math.round((gameEndTime-gameStartTime)/1000);
    const minutes=Math.floor(totalTimeSec/60), seconds=totalTimeSec%60;
    const timeStr=`${minutes}:${seconds.toString().padStart(2,'0')}`;

    const correct=results.filter(r=>r.action==='correct').length;
    const missorted=results.filter(r=>r.action==='missorted').length;
    const spillover=results.filter(r=>r.action==='spillover').length;
    const falsepick=results.filter(r=>r.action==='falsepick').length;
    const ignored=results.filter(r=>r.action==='ignored').length;
    const totalRelevant=gameImages.filter(i=>i.node!==null).length;
    const accuracy=totalRelevant>0?Math.round((correct/totalRelevant)*100):0;
    const itemsPerMin=totalTimeSec>0?Math.round((gameImages.length/totalTimeSec)*60):0;

    // Populate the new results layout
    document.getElementById('res-correct').textContent=correct;
    document.getElementById('res-ignored').textContent=ignored;
    document.getElementById('res-missorted').textContent=missorted;
    document.getElementById('res-spillover').textContent=spillover;
    document.getElementById('res-falsepick').textContent=falsepick;
    document.getElementById('res-good-total').textContent=`Total Good: ${correct+ignored} out of ${gameImages.length}`;
    document.getElementById('res-bad-total').textContent=`Total Mistakes: ${missorted+spillover+falsepick}`;

    document.getElementById('res-total-time').textContent=timeStr;
    document.getElementById('res-speed').textContent=itemsPerMin+' items/min';
    document.getElementById('res-accuracy').textContent=accuracy+'%';
    document.getElementById('res-accuracy-bar-label').textContent=accuracy+'%';
    document.getElementById('res-accuracy-bar').style.width=accuracy+'%';

    // Reaction emoji
    const reaction=document.getElementById('results-reaction');
    if(accuracy>=90) reaction.textContent='🤩';
    else if(accuracy>=75) reaction.textContent='👏';
    else if(accuracy>=50) reaction.textContent='🙂';
    else reaction.textContent='💪';

    // Quality stamp
    const stamp=document.getElementById('quality-stamp');
    const emoji=document.getElementById('stamp-emoji');
    const grade=document.getElementById('stamp-grade');
    let stampClass,stampEmoji,stampGrade,activeIdx;
    if(accuracy>=90){stampClass='excellent';stampEmoji='🤩';stampGrade='EXCELLENT';activeIdx=3;}
    else if(accuracy>=75){stampClass='good';stampEmoji='😊';stampGrade='GOOD';activeIdx=2;}
    else if(accuracy>=50){stampClass='average';stampEmoji='🙂';stampGrade='AVERAGE';activeIdx=1;}
    else{stampClass='poor';stampEmoji='😟';stampGrade='NEEDS WORK';activeIdx=0;}
    stamp.className='quality-stamp '+stampClass; emoji.textContent=stampEmoji; grade.textContent=stampGrade;

    // Quality ranges with "You are here" indicator
    const ranges=document.getElementById('quality-ranges');
    const rangeData=[
      {dot:'#da3633',text:'Below 50% — 😟 Needs Improvement'},
      {dot:'#f0b429',text:'50% – 74% — 🙂 Average'},
      {dot:'#58a6ff',text:'75% – 89% — 😊 Good'},
      {dot:'#2ea043',text:'90% – 100% — 🤩 Excellent'}
    ];
    ranges.innerHTML='';
    rangeData.forEach((r,i)=>{
      const row=document.createElement('div');
      row.className='scale-row'+(i===activeIdx?' active-range':'');
      row.innerHTML=`<span class="scale-dot" style="background:${r.dot};"></span> <strong>${r.text}</strong>${i===activeIdx?' ← You are here':''}`;
      ranges.appendChild(row);
    });

    // Save to history
    saveSession({user:currentUser,date:new Date().toLocaleString(),level:config.levels[level].name,correct,missorted,spillover,falsepick,accuracy:accuracy+'%',time:timeStr});
    showScreen(screenResults);
  }

  /* ═══ SECTION 13: EVENT LISTENERS ═══ */
  btnLoginSubmit.addEventListener('click', handleLogin);
  loginInput.addEventListener('keydown', e => { if(e.key==='Enter') handleLogin(); });

  btnConnectSerial.addEventListener('click', () => { serialConnected ? disconnectArduino() : connectArduino(); });

  // Level cards (new grid layout uses .level-card instead of .btn-level)
  document.querySelectorAll('.level-card[data-level]').forEach(card => {
    card.addEventListener('click', () => startGame(parseInt(card.dataset.level)));
  });

  btnRestart.addEventListener('click', () => showScreen(screenMenu));
  if(btnExportCsv) btnExportCsv.addEventListener('click', exportHistoryCSV);
  if(btnGotoHistory) btnGotoHistory.addEventListener('click', () => { renderHistory(); showScreen(screenHistory); });
  if(btnViewHistory) btnViewHistory.addEventListener('click', () => { renderHistory(); showScreen(screenHistory); });
  if(btnBackFromHist) btnBackFromHist.addEventListener('click', () => showScreen(screenMenu));
  if(btnExportHistory) btnExportHistory.addEventListener('click', exportHistoryCSV);

  btnPick.addEventListener('click', () => doPick());
  document.querySelectorAll('.drop-btn').forEach(b => { b.addEventListener('click', () => doDrop(parseInt(b.dataset.node))); });

  document.addEventListener('keydown', e => {
    if(e.code==='Space'){e.preventDefault();doPick();}
    else if(['Digit1','Digit2','Digit3','Digit4'].includes(e.code)) doDrop(parseInt(e.code.replace('Digit','')));
  });

  // Auto-pause on tab blur
  document.addEventListener('visibilitychange', () => {
    if(document.hidden && animationId && !isPicked) paused=true;
    else if(!document.hidden && paused && !isPicked){paused=false;lastTimestamp=0;}
  });

  /* ═══ SECTION 14: INIT ═══ */
  preloadImages().then(() => {
    updateSerialStatus(false);
    const lastUser = sessionStorage.getItem('fss_current_user');
    if(lastUser){currentUser=lastUser;menuUserDisplay.textContent=`👤 ${currentUser}`;showScreen(screenMenu);}
    else showScreen(screenLogin);
  });
  window.addEventListener('beforeunload', () => { if(currentUser) sessionStorage.setItem('fss_current_user',currentUser); });

})();
