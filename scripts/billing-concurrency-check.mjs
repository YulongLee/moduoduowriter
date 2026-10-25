import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {createServer} from 'vite';
import {newBillingAccount,applyDemoPurchase} from '../src/billing.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.location={hash:'#membership'};
const base=newBillingAccount(),paid=applyDemoPurchase(base,{kind:'pack',id:'small'},'order-one'),newest=applyDemoPurchase(paid,{kind:'pack',id:'small'},'order-two');
let purchaseRelease,readRelease,delayRead=false,readCount=0;
globalThis.fetch=async(url,options={})=>{
 if(url==='/api/billing/purchase')return new Promise(resolve=>{purchaseRelease=()=>resolve(Response.json({account:paid,revision:2}));});
 if(url==='/api/billing'){
  readCount++;
  if(delayRead)return new Promise(resolve=>{readRelease=()=>resolve(Response.json({account:base,revision:1}));});
  return Response.json({account:readCount>2?newest:base,revision:readCount>2?3:1});
 }
 throw Error('Unexpected endpoint');
};
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
let tree,api;
try{
 const {useServerBilling}=await server.ssrLoadModule('/src/serverBillingClient.js');
 function Harness(){api=useServerBilling({spaceId:'local'});return null;}
 await act(async()=>{tree=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,0));});
 assert.equal(api.balance,300);
 let buying;await act(async()=>{buying=api.purchase({kind:'pack',id:'small'},'order-one');});
 await act(async()=>{await api.refresh();});assert.equal(api.balance,300);
 await act(async()=>{purchaseRelease();await buying;});assert.equal(api.balance,1300,'A newer committed purchase must win even when requested before a read');
 delayRead=true;let reading;await act(async()=>{reading=api.refresh();});
 delayRead=false;await act(async()=>{await api.refresh();});assert.equal(api.balance,2300);
 await act(async()=>{readRelease();await reading;});assert.equal(api.balance,2300,'A late old response cannot replace a newer ledger revision');
 console.log('PASS ledger server revision handles out-of-order committed purchases and stale reads');
}finally{if(tree)await act(async()=>tree.unmount());await server.close();}
