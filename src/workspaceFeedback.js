export function workspaceFeedback(workspace) {
  if (!workspace) return null;
  const {status,error,cacheError,conflicts=0}=workspace;
  let tone='neutral',label='正在连接存储…',detail='',retry=false;
  if(status==='saved') {
    tone=cacheError?'warning':'success';
    label=cacheError?'已保存，离线缓存不可用':'已保存到本地服务';
    detail=cacheError?'本地服务已保存当前内容，但此设备的离线缓存未能更新。请导出备份。':'';
  } else if(status==='saving'||status==='pending') {
    tone=cacheError?'warning':'neutral';
    label=status==='saving'?'正在保存…':'等待保存…';
    detail=cacheError?'此设备的离线缓存不可用，请保留当前页面并导出备份。':'更改尚未全部写入本地服务。';
  } else if(status==='offline') {
    tone=cacheError?'error':'warning';
    label=cacheError?'尚未同步，缓存不可用':'离线缓存待同步';
    detail=cacheError?'连接不可用，且此设备的缓存未能更新。请保持页面打开并导出备份。':'本地服务暂未连接；已写入此设备缓存的内容会在恢复连接后同步。';
    retry=true;
  } else if(status==='space-mismatch') {
    tone='warning';label='账号已切换，同步停止';
    detail='请重新登录当前账号。原空间的待同步内容不会写入其他账号。';
    if(cacheError)detail+=' 此设备缓存不可用，请保持页面打开并导出备份。';
  } else if(cacheError) {
    tone='warning';detail='此设备缓存不可用，请保持页面打开并导出备份。';
  }
  if(error&&status!=='saved')detail+=`${detail?' ':''}${error}`;
  if(conflicts>0)detail+=`${detail?' ':''}并发修改已保留为副本。`;
  return {status,tone,label,detail,retry};
}
