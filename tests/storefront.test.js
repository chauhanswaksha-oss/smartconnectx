import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import * as commerce from '../commerce.js';

const source=(await readFile(new URL('../storefront.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const factory=new AsyncFunction('document','location','history','navigator','FormData','setTimeout','QRCode','db','result','rpc','currentUser','e','money','validUpi','validReference','upiUrl','statusLabel','safeNext','rupeesToPaise',source);
const plan={code:'pro-monthly',name:'Pro monthly',amount_paise:9900,period_months:1,active:true};
const order={id:'aabbccdd-1234-4234-9234-aabbccddeeff',owner_id:'customer',plan_code:plan.code,plan_name:plan.name,amount_paise:9900,period_months:1,currency:'INR',status:'awaiting_payment',upi_id:'merchant@bank',merchant_name:'SmartConnect X',created_at:'2026-10-26T00:00:00Z'};
async function render(path,{signedIn=false,admin=false,enabled=false,orders=[]}={}){
  const window=new Window({url:`https://test.invalid${path}`});
  window.document.body.innerHTML='<div id="app"></div>';
  const calls=[],qrs=[];
  const account={is_admin:admin,pro_active:false,card_limit:1};
  const tables={scx_plans:[plan,{...plan,code:'pro-yearly',name:'Pro yearly',amount_paise:49900,period_months:12}],scx_settings:{id:true,checkout_enabled:enabled,upi_id:enabled?'merchant@bank':'',merchant_name:'SmartConnect X'},scx_orders:orders,scx_profiles:[],scx_support:[]};
  const db={from(table){const filters=[];let single=false;const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},limit(){return q},single(){single=true;return q},then(resolve,reject){let data=tables[table];if(Array.isArray(data)) {data=data.filter(row=>filters.every(([k,v])=>row[k]===v));if(single)data=data[0];}return Promise.resolve({data,error:null}).then(resolve,reject)}};return q;},auth:{signOut:async()=>({data:{},error:null})}};
  const rpc=async(name,args)=>{calls.push({name,args});if(name==='scx_account')return account;if(name==='scx_submit_payment')return {...order,status:'pending_review',utr:args.p_utr};if(name==='scx_create_order')return order;return null;};
  await factory(window.document,window.location,window.history,window.navigator,window.FormData,()=>0,{toCanvas:async(_,payload)=>qrs.push(payload)},db,async p=>{const r=await p;if(r.error)throw r.error;return r.data},rpc,async()=>signedIn?{id:'customer',email:'customer@example.invalid'}:null,commerce.escapeHtml,commerce.money,commerce.validUpi,commerce.validReference,commerce.upiUrl,commerce.statusLabel,commerce.safeNext,commerce.rupeesToPaise);
  return {window,document:window.document,calls,qrs,close:()=>window.happyDOM.close()};
}
async function settle(){await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));}
test('home and plan routes expose real catalog and manual-renewal terms',async()=>{
  const home=await render('/');
  assert.match(home.document.body.textContent,/Meet people/);
  assert.equal(home.document.querySelectorAll('.plan').length,3);
  assert.equal(home.qrs.length,1);
  await home.close();
  const plans=await render('/plans');
  assert.match(plans.document.body.textContent,/No automatic debits|no automatic debits/);
  assert.match(plans.document.body.textContent,/Paid checkout is being set up/);
  await plans.close();
});
test('signed-out checkout preserves selected plan through account creation',async()=>{
  const page=await render('/checkout?plan=pro-yearly');
  const signup=page.document.querySelector('.auth-switch a');
  assert.equal(new URL(signup.href).searchParams.get('next'),'/checkout?plan=pro-yearly');
  await page.close();
});
test('closed checkout cannot create a payment order',async()=>{
  const page=await render('/checkout?plan=pro-monthly',{signedIn:true});
  assert.equal(page.document.querySelector('#create-order button').disabled,true);
  assert.match(page.document.body.textContent,/Payments are not open yet/);
  assert.equal(page.calls.some(c=>c.name==='scx_create_order'),false);
  await page.close();
});
test('UPI submission shows pending review, not payment success or active access',async()=>{
  const page=await render(`/checkout?order=${order.id}`,{signedIn:true,enabled:true,orders:[order]});
  const intent=new URL(page.qrs[0]);assert.equal(intent.searchParams.get('am'),'99.00');
  const form=page.document.querySelector('#submit-payment');
  form.elements.utr.value='123456789012';
  form.dispatchEvent(new page.window.Event('submit',{bubbles:true,cancelable:true}));await settle();
  assert.equal(page.calls.filter(c=>c.name==='scx_submit_payment').length,1);
  assert.match(page.document.body.textContent,/We’re checking your payment/);
  assert.doesNotMatch(page.document.body.textContent,/Your payment is verified/);
  await page.close();
});
test('customer sees no owner controls and owner must acknowledge bank verification',async()=>{
  const customer=await render('/admin',{signedIn:true});
  assert.match(customer.document.body.textContent,/Owner access required/);
  assert.equal(customer.document.querySelector('#settings-form'),null);
  await customer.close();
  const page=await render('/admin',{signedIn:true,admin:true,enabled:true,orders:[{...order,status:'pending_review',utr:'123456789012'}]});
  const form=page.document.getElementById(`review-${order.id}`);
  form.dispatchEvent(new page.window.Event('submit',{bubbles:true,cancelable:true}));await settle();
  assert.match(form.textContent,/Check your bank records/);
  assert.equal(page.calls.filter(c=>c.name==='scx_review_payment').length,0);
  form.elements.verified.checked=true;
  form.dispatchEvent(new page.window.Event('submit',{bubbles:true,cancelable:true}));await settle();
  assert.equal(page.calls.filter(c=>c.name==='scx_review_payment').length,1);
  await page.close();
});
