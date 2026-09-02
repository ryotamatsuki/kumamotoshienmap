import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';

const base='http://127.0.0.1:8000';
const manifest=JSON.parse(readFileSync('sender-municipality-audit.json','utf8'));
const expectedSender=manifest.summary.nationwide.adjudicated_basic_municipality_senders;
const expectedEhime=manifest.summary.ehime.adjudicated_count;
const expectedViews=['overview','needs','timeline','dashboard','volunteer','map'];
const specs=[
  {name:'desktop',width:1440,height:1000,mobile:false},
  {name:'mobile',width:390,height:844,mobile:true},
];

function assert(condition,message){if(!condition) throw new Error(message)}
function responseOK(response){const s=response?.status?.() ?? 0; return s>=200 && s<400}
async function collectErrors(page){
  const pageErrors=[]; const consoleErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error') consoleErrors.push(m.text())});
  return {pageErrors,consoleErrors};
}

const browser=await puppeteer.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
try{
  for(const spec of specs){
    const landing=await browser.newPage();
    await landing.setViewport({width:spec.width,height:spec.height,isMobile:spec.mobile,deviceScaleFactor:1});
    const landingErrors=await collectErrors(landing);
    const lres=await landing.goto(`${base}/`,{waitUntil:'networkidle2',timeout:60000});
    assert(responseOK(lres),`${spec.name}: landing HTTP ${lres?.status()}`);
    const landingState=await landing.evaluate(()=>({
      cards:document.querySelectorAll('.card').length,
      routes:document.querySelectorAll('.route').length,
      headings:[...document.querySelectorAll('h1')].map(x=>x.textContent.trim()),
      heroDisplay:getComputedStyle(document.querySelector('.hero')).display,
      primaryTitle:document.querySelector('.route.primary .route-title')?.textContent?.trim(),
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
    }));
    assert(landingState.cards===0,`${spec.name}: landing still uses old cards`);
    assert(landingState.routes===2,`${spec.name}: landing must expose 2 editorial routes`);
    assert(landingState.primaryTitle==='支援・受援状況',`${spec.name}: primary route unclear`);
    assert(!landingState.overflow,`${spec.name}: landing overflow`);
    assert(!landingErrors.pageErrors.length,`${spec.name}: landing page errors`);
    console.log(JSON.stringify({page:`landing-${spec.name}`,...landingState,pageErrors:landingErrors.pageErrors,consoleErrors:landingErrors.consoleErrors}));
    await landing.screenshot({path:`/tmp/stage2-landing-${spec.name}.png`,fullPage:true});
    await landing.close();

    const page=await browser.newPage();
    await page.setViewport({width:spec.width,height:spec.height,isMobile:spec.mobile,deviceScaleFactor:1});
    const dashErrors=await collectErrors(page);
    const dres=await page.goto(`${base}/ehime_kumamoto_support_geocoded_shelters_20260802.html`,{waitUntil:'networkidle2',timeout:60000});
    assert(responseOK(dres),`${spec.name}: dashboard HTTP ${dres?.status()}`);
    await page.waitForSelector('.view-tab[data-view="overview"]',{timeout:30000});
    const state=await page.evaluate((views)=>{
      const tabs=[...document.querySelectorAll('.view-tab[data-view]')];
      const viewSwitch=getComputedStyle(document.querySelector('.view-switch'));
      const active=getComputedStyle(document.querySelector('.view-tab.active'));
      const hero=getComputedStyle(document.querySelector('.overview-hero'));
      const heroTitle=getComputedStyle(document.querySelector('.overview-title h2'));
      const kpi=getComputedStyle(document.querySelector('.overview-kpi'));
      const section=getComputedStyle(document.querySelector('.overview-section'));
      const actor=getComputedStyle(document.querySelector('.overview-actor'));
      const decision=getComputedStyle(document.querySelector('.decision-board'));
      return {
        views:views.filter(v=>tabs.some(t=>t.dataset.view===v)),
        overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
        navBackground:viewSwitch.backgroundColor,
        navBorderTop:viewSwitch.borderTopWidth,
        navRadius:viewSwitch.borderRadius,
        activeBackground:active.backgroundColor,
        activeRadius:active.borderRadius,
        heroDisplay:hero.display,
        heroBorderBottom:hero.borderBottomWidth,
        heroTitleSize:parseFloat(heroTitle.fontSize),
        kpiRadius:kpi.borderRadius,
        kpiShadow:kpi.boxShadow,
        kpiBackground:kpi.backgroundColor,
        sectionRadius:section.borderRadius,
        sectionBorderLeft:section.borderLeftWidth,
        actorDisplay:actor.display,
        actorRadius:actor.borderRadius,
        actorBackground:actor.backgroundColor,
        decisionRadius:decision.borderRadius,
        badgeVisible:document.querySelector('.badge')?getComputedStyle(document.querySelector('.badge')).display!=='none':false,
      };
    },expectedViews);
    assert(state.views.length===expectedViews.length,`${spec.name}: missing dashboard views`);
    assert(!state.overflow,`${spec.name}: dashboard overflow`);
    assert(state.navBackground==='rgba(0, 0, 0, 0)',`${spec.name}: navigation remains filled (${state.navBackground})`);
    assert(state.navBorderTop==='0px',`${spec.name}: navigation remains boxed`);
    assert(state.navRadius==='0px',`${spec.name}: navigation remains pill/rounded (${state.navRadius})`);
    assert(state.activeBackground==='rgba(0, 0, 0, 0)',`${spec.name}: active tab remains filled`);
    assert(state.activeRadius==='0px',`${spec.name}: active tab remains rounded`);
    assert(state.kpiRadius==='0px',`${spec.name}: KPI remains card-like`);
    assert(state.kpiShadow==='none',`${spec.name}: KPI shadow remains`);
    assert(state.sectionRadius==='0px',`${spec.name}: section remains card-like`);
    assert(state.actorRadius==='0px',`${spec.name}: actor remains card-like`);
    assert(state.actorBackground==='rgba(0, 0, 0, 0)',`${spec.name}: actor remains filled`);
    assert(state.decisionRadius==='0px',`${spec.name}: decision board remains card-like`);
    if(spec.mobile) assert(!state.badgeVisible,`${spec.name}: responsive badge should stay hidden`);
    for(const view of expectedViews){
      await page.click(`.view-tab[data-view="${view}"]`);
      await new Promise(r=>setTimeout(r,150));
      const activeState=await page.$eval(`.view-tab[data-view="${view}"]`,el=>el.getAttribute('aria-selected')==='true'&&el.classList.contains('active'));
      assert(activeState,`${spec.name}: ${view} switch failed`);
    }
    assert(!dashErrors.pageErrors.length&&!dashErrors.consoleErrors.length,`${spec.name}: dashboard runtime errors: ${[...dashErrors.pageErrors,...dashErrors.consoleErrors].join(' | ')}`);
    console.log(JSON.stringify({page:`dashboard-${spec.name}`,...state,...dashErrors}));
    await page.screenshot({path:`/tmp/stage2-dashboard-${spec.name}.png`,fullPage:false});
    await page.close();

    const sender=await browser.newPage();
    await sender.setViewport({width:spec.width,height:spec.height,isMobile:spec.mobile,deviceScaleFactor:1});
    const senderErrors=await collectErrors(sender);
    const sres=await sender.goto(`${base}/sender-municipalities.html`,{waitUntil:'networkidle2',timeout:60000});
    assert(responseOK(sres),`${spec.name}: sender HTTP ${sres?.status()}`);
    await sender.waitForFunction(count=>document.querySelectorAll('#ehimeBody tr[data-entity]').length===count,{timeout:30000},expectedEhime);
    await sender.waitForFunction(count=>document.querySelectorAll('#nationalBody tr[data-entity]').length===count,{timeout:30000},expectedSender);
    const senderState=await sender.evaluate(()=>({
      ehimeRows:document.querySelectorAll('#ehimeBody tr[data-entity]').length,
      nationalRows:document.querySelectorAll('#nationalBody tr[data-entity]').length,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
    }));
    assert(!senderState.overflow,`${spec.name}: sender overflow`);
    await sender.select('#state','CURRENT');
    await sender.waitForFunction(()=>document.querySelectorAll('#nationalBody tr[data-entity]').length===12,{timeout:30000});
    assert(!senderErrors.pageErrors.length&&!senderErrors.consoleErrors.length,`${spec.name}: sender runtime errors`);
    console.log(JSON.stringify({page:`sender-${spec.name}`,...senderState,currentRows:12,...senderErrors}));
    await sender.screenshot({path:`/tmp/stage2-sender-${spec.name}.png`,fullPage:false});
    await sender.close();
  }
} finally { await browser.close(); }
console.log('STAGE2_BROWSER_QA_PASS');
