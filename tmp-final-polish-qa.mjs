import puppeteer from 'puppeteer-core';

const base='http://127.0.0.1:8000';
const browser=await puppeteer.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const expectedViews=['overview','needs','timeline','dashboard','volunteer','map'];
const results=[];
const activate=async(page,view)=>{const tab=await page.$(`[data-view="${view}"]`);if(!tab)throw new Error(`missing view ${view}`);await tab.click();await new Promise(r=>setTimeout(r,180));};
try {
  for (const spec of [{name:'desktop',w:1440,h:1000,mobile:false},{name:'mobile',w:390,h:844,mobile:true}]) {
    const page=await browser.newPage();
    await page.setViewport({width:spec.w,height:spec.h,isMobile:spec.mobile,deviceScaleFactor:1});
    const pageErrors=[]; const consoleErrors=[];
    page.on('pageerror',e=>pageErrors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
    const res=await page.goto(`${base}/ehime_kumamoto_support_geocoded_shelters_20260802.html`,{waitUntil:'networkidle2',timeout:60000});
    if(!res?.ok()) throw new Error(`${spec.name}: dashboard HTTP ${res?.status()}`);
    for(const view of expectedViews) await activate(page,view);
    const common=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,presentViews:[...document.querySelectorAll('[data-view]')].map(x=>x.getAttribute('data-view'))}));
    if(common.overflow) throw new Error(`${spec.name}: horizontal overflow`);
    for(const view of expectedViews) if(!common.presentViews.includes(view)) throw new Error(`${spec.name}: absent view ${view}`);

    await activate(page,'needs');
    const needs=await page.evaluate(()=>{
      const n=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
      const h=s=>n(s)?.getBoundingClientRect().height??null,fs=s=>n(s)?parseFloat(getComputedStyle(n(s)).fontSize):null;
      const tiny=all('#needsView *').filter(visible).filter(el=>el.children.length===0&&(el.textContent||'').trim()).filter(el=>parseFloat(getComputedStyle(el).fontSize)<10).map(el=>({cls:String(el.className||''),size:parseFloat(getComputedStyle(el).fontSize),text:(el.textContent||'').trim().slice(0,55)}));
      const shadows=all('#needsView .needs-intro,#needsView .needs-section,#needsView .needs-list-panel,#needsView .needs-kpi').filter(visible).filter(el=>getComputedStyle(el).boxShadow!=='none').length;
      const controls=all('#needsView button,#needsView input,#needsView select').filter(visible).map(el=>({cls:String(el.className||''),h:el.getBoundingClientRect().height,text:(el.textContent||el.value||'').trim().slice(0,45)}));
      const heads=all('#needsView .needs-section-head').filter(visible).map(el=>el.getBoundingClientRect().x); const xSpread=heads.length?Math.max(...heads)-Math.min(...heads):0;
      return {h2:fs('.needs-intro h2'),tinyCount:tiny.length,tiny:tiny.slice(0,20),phase:h('.needs-phasebar button'),field:h('.needs-field input'),shadows,xSpread,lowControls:controls.filter(x=>x.h<39.5).slice(0,30)};
    });

    await activate(page,'volunteer');
    const volunteer=await page.evaluate(()=>{
      const n=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
      const h=s=>n(s)?.getBoundingClientRect().height??null,fs=s=>n(s)?parseFloat(getComputedStyle(n(s)).fontSize):null;
      const fields=all('#volunteerView .vol-field input,#volunteerView .vol-field select,#volunteerView .vol-planning-select,#volunteerView .vol-cost-row input,#volunteerView .vol-cost-row select').filter(visible).map(el=>el.getBoundingClientRect().height);
      return {
        open:fs('.vol-summary-open'),jump:h('.vol-summary-jump'),help:h('.vol-summary-help'),municipality:h('.vol-municipality-button'),alertClose:h('.vol-alert-close'),check:h('.vol-check'),detailOpen:h('.vol-row-details>summary'),fieldMin:fields.length?Math.min(...fields):null,
        sourceLink:h('.vol-link')
      };
    });

    await activate(page,'dashboard');
    const dashboard=await page.evaluate(()=>{const n=s=>document.querySelector(s);return {matrix:n('.matrix-label')?parseFloat(getComputedStyle(n('.matrix-label')).fontSize):null,category:n('.category-row')?.getBoundingClientRect().height??null,region:n('.region-chip')?parseFloat(getComputedStyle(n('.region-chip')).fontSize):null};});
    await activate(page,'map');
    const map=await page.evaluate(()=>{const n=s=>document.querySelector(s);return {tab:n('.tabs > .tab')?.getBoundingClientRect().height??null,radius:n('.tabs > .tab')?parseFloat(getComputedStyle(n('.tabs > .tab')).borderTopLeftRadius)||0:null,note:n('.map-note')?parseFloat(getComputedStyle(n('.map-note')).fontSize):null};});
    await activate(page,'overview');
    const overview=await page.evaluate(()=>{const n=s=>document.querySelector(s);return {status:n('.page-recheck-status')?parseFloat(getComputedStyle(n('.page-recheck-status')).fontSize):null,source:n('.page-recheck-source')?parseFloat(getComputedStyle(n('.page-recheck-source')).fontSize):null};});
    await activate(page,'timeline');
    const timeline=await page.evaluate(()=>{const n=s=>document.querySelector(s);const el=n('.timeline-detail-actions a,.timeline-detail-actions button');return {action:el?.getBoundingClientRect().height??null};});

    const target=spec.mobile?43.5:39.5;
    const optionalHeightOkay=v=>v===null||v>=target;
    if(needs.h2<(spec.mobile?22:28)||needs.tinyCount!==0||needs.phase<target||needs.field<target||needs.shadows!==0||needs.xSpread>2) throw new Error(`${spec.name}: Needs ${JSON.stringify(needs)}`);
    if(volunteer.open<11||volunteer.jump<target||volunteer.help<target||!optionalHeightOkay(volunteer.municipality)||!optionalHeightOkay(volunteer.alertClose)||!optionalHeightOkay(volunteer.check)||!optionalHeightOkay(volunteer.detailOpen)||!optionalHeightOkay(volunteer.fieldMin)) throw new Error(`${spec.name}: Volunteer ${JSON.stringify(volunteer)}`);
    if(dashboard.matrix<10||dashboard.category<target||dashboard.region<10) throw new Error(`${spec.name}: Dashboard ${JSON.stringify(dashboard)}`);
    if(map.tab<(spec.mobile?43.5:35.5)||map.radius>8||map.note<10) throw new Error(`${spec.name}: Map ${JSON.stringify(map)}`);
    if(overview.status<10||overview.source<10) throw new Error(`${spec.name}: Overview ${JSON.stringify(overview)}`);
    if(timeline.action!==null&&timeline.action<target) throw new Error(`${spec.name}: Timeline ${JSON.stringify(timeline)}`);
    if(pageErrors.length||consoleErrors.length) throw new Error(`${spec.name}: dashboard runtime page=${pageErrors.length} console=${consoleErrors.length}`);
    results.push({name:`dashboard-${spec.name}`,needs,volunteer,dashboard,map,overview,timeline,pageErrors,consoleErrors});
    await page.close();

    const sender=await browser.newPage();
    await sender.setViewport({width:spec.w,height:spec.h,isMobile:spec.mobile,deviceScaleFactor:1});
    const senderErrors=[];const senderConsole=[];sender.on('pageerror',e=>senderErrors.push(String(e)));sender.on('console',m=>{if(m.type()==='error')senderConsole.push(m.text())});
    const sr=await sender.goto(`${base}/sender-municipalities.html`,{waitUntil:'networkidle2',timeout:60000});if(!sr?.ok())throw new Error(`${spec.name}: sender HTTP ${sr?.status()}`);
    await sender.waitForFunction(()=>document.querySelectorAll('#nationalBody tr[data-entity]').length===316,{timeout:30000});
    const senderState=await sender.evaluate(()=>({ehime:document.querySelectorAll('#ehimeBody tr[data-entity]').length,national:document.querySelectorAll('#nationalBody tr[data-entity]').length,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));
    await sender.select('#state','CURRENT');await sender.waitForFunction(()=>document.querySelectorAll('#nationalBody tr[data-entity]').length>0,{timeout:30000});const current=await sender.$$eval('#nationalBody tr[data-entity]',r=>r.length);
    if(senderState.ehime!==20||senderState.national!==316||current!==12||senderState.overflow||senderErrors.length||senderConsole.length)throw new Error(`${spec.name}: sender ${JSON.stringify({senderState,current,senderErrors,senderConsole})}`);
    results.push({name:`sender-${spec.name}`,...senderState,current,pageErrors:senderErrors,consoleErrors:senderConsole});await sender.close();
  }
} finally {await browser.close()}
for(const row of results) console.log(JSON.stringify(row));
console.log('FINAL_VISUAL_POLISH_QA_PASS');
