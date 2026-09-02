import puppeteer from 'puppeteer-core';

const base='http://127.0.0.1:8000';
const browser=await puppeteer.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const expectedViews=['overview','needs','timeline','dashboard','volunteer','map'];
const results=[];
try {
  for (const spec of [{name:'desktop',w:1440,h:1000,mobile:false},{name:'mobile',w:390,h:844,mobile:true}]) {
    const page=await browser.newPage();
    await page.setViewport({width:spec.w,height:spec.h,isMobile:spec.mobile,deviceScaleFactor:1});
    const pageErrors=[]; const consoleErrors=[];
    page.on('pageerror',e=>pageErrors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
    const res=await page.goto(`${base}/ehime_kumamoto_support_geocoded_shelters_20260802.html`,{waitUntil:'networkidle2',timeout:60000});
    if(!res?.ok()) throw new Error(`${spec.name}: dashboard HTTP ${res?.status()}`);
    for(const view of expectedViews){
      const tab=await page.$(`[data-view="${view}"]`);
      if(!tab) throw new Error(`${spec.name}: missing view ${view}`);
      await tab.click(); await new Promise(r=>setTimeout(r,150));
    }
    const measured=await page.evaluate(()=>{
      const n=s=>document.querySelector(s), all=s=>[...document.querySelectorAll(s)];
      const fs=s=>n(s)?parseFloat(getComputedStyle(n(s)).fontSize):null;
      const h=s=>n(s)?.getBoundingClientRect().height??null;
      const radius=s=>n(s)?parseFloat(getComputedStyle(n(s)).borderTopLeftRadius)||0:null;
      const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
      const needsTiny=all('#needsView *').filter(visible).filter(el=>el.children.length===0&&(el.textContent||'').trim()).filter(el=>parseFloat(getComputedStyle(el).fontSize)<10).map(el=>({cls:String(el.className||''),size:parseFloat(getComputedStyle(el).fontSize),text:(el.textContent||'').trim().slice(0,50)}));
      const needsShadow=all('#needsView .needs-intro,#needsView .needs-section,#needsView .needs-list-panel,#needsView .needs-kpi').filter(visible).filter(el=>getComputedStyle(el).boxShadow!=='none').length;
      const xHeads=all('.overview-section-head,.dashboard-section-head,.vol-section-head,.needs-section-head').filter(visible).map(el=>el.getBoundingClientRect().x);
      const xSpread=xHeads.length?Math.max(...xHeads)-Math.min(...xHeads):0;
      return {
        overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
        needsH2:fs('.needs-intro h2'),needsTinyCount:needsTiny.length,needsTiny:needsTiny.slice(0,20),needsPhase:h('.needs-phasebar button'),needsField:h('.needs-field input'),needsShadow,
        volunteerOpen:fs('.vol-summary-open'),volJump:h('.vol-summary-jump'),volHelp:h('.vol-summary-help'),volMunicipality:h('.vol-municipality-button'),
        matrixLabel:fs('.matrix-label'),categoryRow:h('.category-row'),regionChip:fs('.region-chip'),
        mapTab:h('.tabs > .tab'),mapTabRadius:radius('.tabs > .tab'),mapNote:fs('.map-note'),
        recheckStatus:fs('.page-recheck-status'),recheckSource:fs('.page-recheck-source'),
        timelineAction:h('.timeline-detail-actions button'),xSpread
      };
    });
    const controlTarget=spec.mobile?43.5:39.5;
    if(measured.overflow) throw new Error(`${spec.name}: horizontal overflow`);
    if(measured.needsH2<(spec.mobile?22:28)) throw new Error(`${spec.name}: Needs H2 ${measured.needsH2}`);
    if(measured.needsTinyCount!==0) throw new Error(`${spec.name}: Needs <10px ${JSON.stringify(measured.needsTiny)}`);
    if(measured.needsPhase<controlTarget||measured.needsField<controlTarget) throw new Error(`${spec.name}: Needs controls ${JSON.stringify(measured)}`);
    if(measured.needsShadow!==0) throw new Error(`${spec.name}: Needs routine shadows ${measured.needsShadow}`);
    if(measured.volunteerOpen<11||measured.volJump<controlTarget||measured.volHelp<controlTarget||measured.volMunicipality<controlTarget) throw new Error(`${spec.name}: Volunteer controls ${JSON.stringify(measured)}`);
    if(measured.matrixLabel<10||measured.categoryRow<controlTarget||measured.regionChip<10) throw new Error(`${spec.name}: Dashboard detail ${JSON.stringify(measured)}`);
    if(measured.mapTab<(spec.mobile?43.5:35.5)||measured.mapTabRadius>8||measured.mapNote<10) throw new Error(`${spec.name}: Map ${JSON.stringify(measured)}`);
    if(measured.recheckStatus<10||measured.recheckSource<10) throw new Error(`${spec.name}: Overview metadata ${JSON.stringify(measured)}`);
    if(measured.timelineAction!==null&&measured.timelineAction<controlTarget) throw new Error(`${spec.name}: Timeline action ${JSON.stringify(measured)}`);
    if(pageErrors.length||consoleErrors.length) throw new Error(`${spec.name}: dashboard runtime page=${pageErrors.length} console=${consoleErrors.length}`);
    results.push({name:`dashboard-${spec.name}`,...measured,pageErrors,consoleErrors});
    await page.close();

    const sender=await browser.newPage();
    await sender.setViewport({width:spec.w,height:spec.h,isMobile:spec.mobile,deviceScaleFactor:1});
    const senderErrors=[];const senderConsole=[];
    sender.on('pageerror',e=>senderErrors.push(String(e)));
    sender.on('console',m=>{if(m.type()==='error')senderConsole.push(m.text())});
    const sr=await sender.goto(`${base}/sender-municipalities.html`,{waitUntil:'networkidle2',timeout:60000});
    if(!sr?.ok()) throw new Error(`${spec.name}: sender HTTP ${sr?.status()}`);
    await sender.waitForFunction(()=>document.querySelectorAll('#nationalBody tr[data-entity]').length===316,{timeout:30000});
    const senderState=await sender.evaluate(()=>({ehime:document.querySelectorAll('#ehimeBody tr[data-entity]').length,national:document.querySelectorAll('#nationalBody tr[data-entity]').length,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));
    await sender.select('#state','CURRENT');
    await sender.waitForFunction(()=>document.querySelectorAll('#nationalBody tr[data-entity]').length>0,{timeout:30000});
    const current=await sender.$$eval('#nationalBody tr[data-entity]',r=>r.length);
    if(senderState.ehime!==20||senderState.national!==316||current!==12||senderState.overflow||senderErrors.length||senderConsole.length) throw new Error(`${spec.name}: sender regression ${JSON.stringify({senderState,current,senderErrors,senderConsole})}`);
    results.push({name:`sender-${spec.name}`,...senderState,current,pageErrors:senderErrors,consoleErrors:senderConsole});
    await sender.close();
  }
} finally {await browser.close()}
for(const row of results) console.log(JSON.stringify(row));
console.log('FINAL_VISUAL_POLISH_QA_PASS');
