import React, {useEffect, useState} from 'react';
import {LoaderCircle, RefreshCw, Save, Settings2, ShieldCheck, Sparkles} from 'lucide-react';
import {useAccount} from './Account.jsx';
import {requestApi, useGeneration} from './Generation';
import {LoginServiceSettings} from './LoginServiceSettings.jsx';

export function CreationSettings() {
  const generation = useGeneration();
  useEffect(() => {generation.refresh?.();}, []);
  const available = generation.settings?.configured;
  return <div className="settings-block">
    <h3><Sparkles size={17}/>智能创作</h3>
    <p role="status">{available === undefined ? '正在检查服务状态…' : available ? '创作服务已就绪，可以生成大纲、人物与正文。' : '智能创作暂不可用，可以先体验示例或继续手动写作。'}</p>
    <label className="field">创作方式<select aria-label="AI 工作模式" value={generation.mode} onChange={event => generation.setMode?.(event.target.value)}><option value="demo">示例体验 · 使用预置内容</option><option value="ai" disabled={available === false}>智能创作 · 根据你的需求生成</option></select></label>
    <p className="form-footnote">示例体验不会发起生成请求；智能创作会结合你选择的文稿与设定生成内容。</p>
  </div>;
}

// Operator page: role checks also run on every management API request.
export function ServiceAdmin() {
  const account=useAccount(),allowed=!account?.configured||account?.user?.role==='admin';
  const generation = useGeneration();
  const [form,setForm] = useState({baseUrl:'',model:'',protocol:'chat',apiKey:'',jsonMode:false,defaultMode:'demo'});
  const [busy,setBusy] = useState(false), [ready,setReady] = useState(false), [message,setMessage] = useState('');
  const load = async () => {
    setBusy(true);setReady(false);setMessage('');
    try {const data = await requestApi('/api/settings',undefined,{method:'GET'});setForm({...data,apiKey:''});setReady(true);}
    catch (error) {setMessage(error.message);}
    finally {setBusy(false);}
  };
  useEffect(() => {if(allowed)load();}, [allowed]);
  const save = async () => {
    setBusy(true);setMessage('');
    try {const data = await requestApi('/api/settings',form,{method:'PUT'});setForm({...data,apiKey:''});await generation.refresh?.();setMessage('配置已保存，密钥仅保存在本机服务端。');}
    catch (error) {setMessage(error.message);}
    finally {setBusy(false);}
  };
  const test = async () => {
    setBusy(true);setMessage('');
    try {await requestApi('/api/test',{});setMessage('连接成功，创作服务已返回文字。');}
    catch (error) {setMessage(error.message);}
    finally {setBusy(false);}
  };
  if(!allowed)return <section className="surface service-admin"><h1>服务管理</h1><p role="status">此页面仅供管理员维护服务连接。你可以继续使用创作和备份功能。</p></section>;
  return <section className="surface service-admin">
    <span className="modal-symbol"><Settings2/></span><h1>本机服务管理</h1>
    <p className="modal-desc">在本机维护创作服务连接。普通创作页面只展示服务状态。</p>
    <fieldset className="settings-block" disabled={busy || !ready}>
      <legend>AI 生成服务</legend>
      <label className="field">默认创作方式<select value={form.defaultMode} onChange={event => setForm({...form,defaultMode:event.target.value})}><option value="demo">示例体验</option><option value="ai">智能创作</option></select></label>
      <label className="field">接口基础地址<input aria-label="接口基础地址" value={form.baseUrl} onChange={event => setForm({...form,baseUrl:event.target.value})} placeholder="https://服务商域名/v1"/></label>
      <div className="settings-fields">
        <label className="field">接口格式<select value={form.protocol} onChange={event => setForm({...form,protocol:event.target.value})}><option value="chat">Chat Completions 兼容</option><option value="responses">OpenAI Responses</option></select></label>
        <label className="field">模型名称<input aria-label="模型名称" value={form.model} onChange={event => setForm({...form,model:event.target.value})} placeholder="填写服务商提供的模型 ID"/></label>
      </div>
      <label className="field">API 密钥<input type="password" autoComplete="new-password" aria-label="API 密钥" value={form.apiKey} onChange={event => setForm({...form,apiKey:event.target.value,clearKey:false})} placeholder={form.hasKey ? '已保存；留空保留原密钥' : '仅保存在本机，不写入浏览器存储'}/></label>
      <label className="settings-check"><input type="checkbox" checked={form.jsonMode} onChange={event => setForm({...form,jsonMode:event.target.checked})}/>服务商支持 JSON 输出模式</label>
      {typeof form.enableThinking === 'boolean' && <label className="settings-check"><input type="checkbox" checked={form.enableThinking} onChange={event => setForm({...form,enableThinking:event.target.checked})}/>开启模型深度思考（可能增加等待与用量）</label>}
      {form.hasKey && <label className="settings-check"><input type="checkbox" checked={!!form.clearKey} onChange={event => setForm({...form,clearKey:event.target.checked})}/>保存时清除已有密钥</label>}
      <div className="soft-notice"><ShieldCheck size={16}/>智能创作会将所选文稿与设定发送至配置的服务商。生成费用由服务商账户承担，墨点为演示账本。</div>
      <p className="form-footnote">连接测试会发送一句测试文本，可能产生少量服务商费用。</p>
      <div className="settings-actions"><button className="button secondary" onClick={test}>测试已保存配置</button><button className="button primary" onClick={save}>{busy ? <LoaderCircle size={15} className="spin"/> : <Save size={15}/>}保存配置</button></div>
    </fieldset>
    <button className="text-button" disabled={busy} onClick={load}><RefreshCw size={14}/>重新载入配置</button>
    {message && <p className="settings-message" role="status">{message}</p>}
    {account?.user?.role==='admin'&&<LoginServiceSettings/>}
  </section>;
}
