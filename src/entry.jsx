import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './main';
import {seoResources} from './seo-resource-index.mjs';

const root=document.getElementById('root');
const path=location.pathname;
const contentPage=seoResources.some(page=>page.path===(path.endsWith('/')?path:path+'/'));
// The static public HTML and the interactive page share the same React tree.
// Hash-based private screens are deliberately mounted only after the client starts.
const publicHash=!location.hash||location.hash==='#home';
export let mountedRoot;
function mount(app){
 const hydrate=root.dataset.prerendered===path&&(contentPage||publicHash);
 mountedRoot=hydrate?hydrateRoot(root,app):createRoot(root);
 if(!hydrate)mountedRoot.render(app);
}
// Production reading pages use native links/details and need no app JavaScript.
// Keep this lazy enhancement for the development server only.
if(contentPage)import('./SeoContentPage.jsx').then(({default:Page})=>mount(<Page path={path}/>));
else mount(<App/>);

function updateIndexingPolicy(){
 const privateScreen=path==='/'&&location.hash&&!['#home'].includes(location.hash);
 const tag=document.querySelector('meta[name="robots"]');
 if(tag)tag.content=privateScreen?'noindex, nofollow, nosnippet':'index, follow, max-image-preview:large';
}
updateIndexingPolicy();
window.addEventListener('hashchange',updateIndexingPolicy);
