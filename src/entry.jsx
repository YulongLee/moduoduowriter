import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './main';
import SeoContentPage from './SeoContentPage.jsx';
import {getSeoPage} from './seo-content.mjs';

const root=document.getElementById('root');
const path=location.pathname;
const contentPage=getSeoPage(path);
const app=contentPage?<SeoContentPage path={path}/>:<App/>;
// The static public HTML and the interactive page share the same React tree.
// Hash-based private screens are deliberately mounted only after the client starts.
const publicHash=!location.hash||location.hash==='#home';
const hydrate=root.dataset.prerendered===path&&(contentPage||publicHash);
export const mountedRoot=hydrate?hydrateRoot(root,app):createRoot(root);
if(!hydrate)mountedRoot.render(app);

function updateIndexingPolicy(){
 const privateScreen=path==='/'&&location.hash&&!['#home'].includes(location.hash);
 const tag=document.querySelector('meta[name="robots"]');
 if(tag)tag.content=privateScreen?'noindex, nofollow, nosnippet':'index, follow, max-image-preview:large';
}
updateIndexingPolicy();
window.addEventListener('hashchange',updateIndexingPolicy);
