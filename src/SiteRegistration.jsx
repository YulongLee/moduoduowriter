import React from 'react';
import './site-registration.css';

// Public site information supplied by the operator; shared across page footers.
export const siteRegistration={number:'浙ICP备2026052190号-6',url:'https://beian.miit.gov.cn/'};

export function SiteRegistration() {
 return <div className="site-registration" aria-label="网站备案信息"><a href={siteRegistration.url} target="_blank" rel="noopener noreferrer" title="工信部备案查询（新窗口打开）">{siteRegistration.number}</a></div>;
}
