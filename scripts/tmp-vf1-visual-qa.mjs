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
    const response=await landing.goto(`${base}/`,{waitUntil:'networkidle2',timeout:60000});
    assert(response?.ok(),`${spec.name} landing HTTP ${response?.status()}`);
    const landingState=await landing.evaluate(()=>{
      const body=getComputedStyle(document.body);
      const card=document.querySelector('.card'); const cardStyle=card?getComputedStyle(card):null;
      return {
        cards:document.querySelectorAll('.card').length,
        overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
        bodyBackground:body.backgroundColor,
        cardShadow:cardStyle?.boxShadow,
        cardRadius:cardStyle?.borderRadius,
        h1:document.querySelector('h1')?.textContent?.trim(),
      };
    });
    assert(landingState.cards===2,`${spec.name}: landing cards changed`);
    assert(!landingState.overflow,`${spec.name}: landing overflow`);
    assert(landingState.bodyBackground==='rgb(255, 255, 255)',`${spec.name}: landing canvas is not white`);
    assert(landingState.cardShadow==='none',`${spec.name}: landing routine shadow remains`);
    assert(landingState.cardRadius==='6px',`${spec.name}: landing card radius is ${landingState.cardRadius}`);
    assert(!landingErrors.pageErrors.length&&!landingErrors.consoleErrors.length,`${spec.name}: landing runtime errors`);
    console.log(JSON.stringify({page:`landing-${spec.name}`,...landingState,...landingErrors}));
    await landing.screenshot({path:`/tmp/vf1-landing-${spec.name}.png`,fullPage:true});
    await landing.close();

    const dashboard=await browser.newPage();
    await dashboard.setViewport({width:spec.width,height:spec.height,isMobile:spec.mobile,deviceScaleFactor:1});
    const dashErrors=await collectErrors(dashboard);
    const dres=await dashboard.goto(`${base}/ehime_kumamoto_support_geocoded_shelters_20260802.html`,{waitUntil:'networkidle2',timeout:60000});
    assert(dres?.ok(),`${spec.name}: dashboard HTTP ${dres?.status()}`);
    await dashboard.waitForSelector('.view-tab[data-view="overview"]',{timeout:30000});
    const baseState=await dashboard.evaluate((views)=>{
      const tabs=[...document.querySelectorAll('.view-tab[data-view]')];
      const root=getComputedStyle(document.documentElement);
      const header=getComputedStyle(document.querySelector('header'));
      const metric=document.querySelector('.overview-kpi,.dashboard-metric,.metric');
      const metricStyle=metric?getComputedStyle(metric):null;
      const badge=document.querySelector('.badge');
      return {
        views:views.filter(v=>tabs.some(t=>t.dataset.view===v)),
        overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
        canvas:root.getPropertyValue('--canvas').trim(),
        line:root.getPropertyValue('--line').trim(),
        headerShadow:header.boxShadow,
        metricShadow:metricStyle?.boxShadow,
        metricRadius:metricStyle?.borderRadius,
        badgeVisible:badge?getComputedStyle(badge).display!=='none':false,
      };
    },expectedViews);
    assert(baseState.views.length===expectedViews.length,`${spec.name}: missing dashboard views`);
    assert(!baseState.overflow,`${spec.name}: dashboard overflow`);
    assert(baseState.canvas==='#fff',`${spec.name}: visual foundation token missing`);
    assert(baseState.headerShadow==='none',`${spec.name}: header shadow remains`);
    assert(baseState.metricShadow==='none',`${spec.name}: routine metric shadow remains`);
    if(spec.mobile) assert(!baseState.badgeVisible,`${spec.name}: badge should be hidden`); else assert(baseState.badgeVisible,`${spec.name}: desktop badge hidden`);
    for(const view of expectedViews){
      await dashboard.click(`.view-tab[data-view="${view}"]`);
      await new Promise(r=>setTimeout(r,150));
      const active=await dashboard.$eval(`.view-tab[data-view="${view}"]`,el=>el.getAttribute('aria-selected')==='true'&&el.classList.contains('active'));
      assert(active,`${spec.name}: ${view} switch failed`);
    }
    assert(!dashErrors.pageErrors.length&&!dashErrors.consoleErrors.length,`${spec.name}: dashboard runtime errors: ${[...dashErrors.pageErrors,...dashErrors.consoleErrors].join(' | ')}`);
    console.log(JSON.stringify({page:`dashboard-${spec.name}`,...baseState,...dashErrors}));
    await dashboard.screenshot({path:`/tmp/vf1-dashboard-${spec.name}.png`,fullPage:false});
    await dashboard.close();

    const sender=await browser.newPage();
    await sender.setViewport({width:spec.width,height:spec.height,isMobile:spec.mobile,deviceScaleFactor:1});
    const senderErrors=await collectErrors(sender);
    const sres=await sender.goto(`${base}/sender-municipalities.html`,{waitUntil:'networkidle2',timeout:60000});
    assert(sres?.ok(),`${spec.name}: sender HTTP ${sres?.status()}`);
    await sender.waitForFunction(count=>document.querySelectorAll('#ehimeBody tr[data-entity]').length===count,{timeout:30000},expectedEhime);
    await sender.waitForFunction(count=>document.querySelectorAll('#nationalBody tr[data-entity]').length===count,{timeout:30000},expectedSender);
    const senderState=await sender.evaluate(()=>{
      const body=getComputedStyle(document.body); const section=getComputedStyle(document.querySelector('.section'));
      return {ehimeRows:document.querySelectorAll('#ehimeBody tr[data-entity]').length,nationalRows:document.querySelectorAll('#nationalBody tr[data-entity]').length,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,bodyBackground:body.backgroundColor,sectionShadow:section.boxShadow,sectionRadius:section.borderRadius};
    });
    assert(!senderState.overflow,`${spec.name}: sender page overflow`);
    assert(senderState.bodyBackground==='rgb(255, 255, 255)',`${spec.name}: sender canvas not white`);
    assert(senderState.sectionShadow==='none',`${spec.name}: sender routine shadow remains`);
    await sender.select('#state','CURRENT');
    await sender.waitForFunction(()=>document.querySelectorAll('#nationalBody tr[data-entity]').length===12,{timeout:30000});
    assert(!senderErrors.pageErrors.length&&!senderErrors.consoleErrors.length,`${spec.name}: sender runtime errors`);
    console.log(JSON.stringify({page:`sender-${spec.name}`,...senderState,currentRows:12,...senderErrors}));
    await sender.screenshot({path:`/tmp/vf1-sender-${spec.name}.png`,fullPage:false});
    await sender.close();
  }
}finally{await browser.close()}
console.log('VF1_BROWSER_QA_PASS');
