import React from 'react';

const maxCharacters=16000;
const headingFor=line=>/^ {0,3}(#{1,4})\s+(.+)$/.exec(line);
const fenceFor=line=>/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
const quoteFor=line=>/^ {0,3}>\s?(.*)$/.exec(line);
const listFor=line=>/^\s*(?:([-+*])\s+|(\d{1,6})[.)]\s+)(.*)$/.exec(line);
const ruleFor=line=>/^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim().replace(/[ \t]/g,''));

// Inline input is always text. No URL, HTML, image or event parser exists here.
function inline(source,key='inline',strongAllowed=true){
 const nodes=[];let buffer='',index=0;
 const flush=()=>{if(buffer){nodes.push(buffer);buffer='';}};
 while(index<source.length){
  if(source[index]==='\\'&&['`','*','\\'].includes(source[index+1])){buffer+=source[index+1];index+=2;continue;}
  if(source[index]==='`'){
   let end=index+1;while(source[end]==='`')end++;
   const delimiter=source.slice(index,end),close=source.indexOf(delimiter,end);
   if(close>=end){flush();nodes.push(<code className="conversation-rich-inline-code" key={`${key}-code-${index}`}>{source.slice(end,close)}</code>);index=close+delimiter.length;continue;}
   buffer+=delimiter;index=end;continue;
  }
  if(strongAllowed&&source.startsWith('**',index)){
   const close=source.indexOf('**',index+2);
   if(close>index+2){flush();nodes.push(<strong className="conversation-rich-strong" key={`${key}-strong-${index}`}>{inline(source.slice(index+2,close),`${key}-strong-${index}`,false)}</strong>);index=close+2;continue;}
  }
  if(source[index]==='\n'){flush();nodes.push(<br key={`${key}-break-${index}`}/>);index++;continue;}
  buffer+=source[index++];
 }
 flush();return nodes;
}

function tableCells(line){
 let source=line.trim();if(source.startsWith('|'))source=source.slice(1);
 if(source.endsWith('|')&&!source.endsWith('\\|'))source=source.slice(0,-1);
 const cells=[];let cell='',code=false;
 for(let index=0;index<source.length;index++){
  if(source[index]==='\\'&&source[index+1]==='|'){cell+='|';index++;continue;}
  if(source[index]==='`')code=!code;
  if(source[index]==='|'&&!code){cells.push(cell.trim());cell='';}else cell+=source[index];
 }
 cells.push(cell.trim());return cells;
}

function tableFor(lines,index){
 if(!lines[index]?.includes('|')||!lines[index+1])return null;
 const headers=tableCells(lines[index]),separators=tableCells(lines[index+1]);
 return headers.length===separators.length&&separators.every(cell=>/^:?-{3,}:?$/.test(cell))?{headers,separators}:null;
}

const blockStart=(lines,index)=>!lines[index]?.trim()||headingFor(lines[index])||fenceFor(lines[index])||quoteFor(lines[index])||listFor(lines[index])||ruleFor(lines[index])||tableFor(lines,index);

function blocks(lines,prefix='block',depth=0){
 const nodes=[];let index=0;
 while(index<lines.length){
  const line=lines[index],key=`${prefix}-${index}`;
  if(!line.trim()){index++;continue;}
  const fence=fenceFor(line);
  if(fence){
   const code=[];index++;
   while(index<lines.length){
    const closing=fenceFor(lines[index]);
    if(closing&&closing[1][0]===fence[1][0]&&closing[1].length>=fence[1].length&&!closing[2].trim()){index++;break;}
    code.push(lines[index++]);
   }
   nodes.push(<pre className="conversation-rich-code-block" key={key}><code>{code.join('\n')}</code></pre>);continue;
  }
  const heading=headingFor(line);
  if(heading){
   const Heading=`h${heading[1].length}`;
   nodes.push(<Heading className={`conversation-rich-heading conversation-rich-heading-${heading[1].length}`} key={key}>{inline(heading[2].replace(/\s+#+\s*$/,''),key)}</Heading>);index++;continue;
  }
  if(ruleFor(line)){nodes.push(<hr className="conversation-rich-rule" key={key}/>);index++;continue;}
  const quote=quoteFor(line);
  if(quote){
   const quoted=[];while(index<lines.length){const value=quoteFor(lines[index]);if(!value)break;quoted.push(value[1]);index++;}
   nodes.push(<blockquote className="conversation-rich-quote" key={key}>{depth<4?blocks(quoted,key,depth+1):<p className="conversation-rich-paragraph">{inline(quoted.join('\n'),key)}</p>}</blockquote>);continue;
  }
  const table=tableFor(lines,index);
  if(table){
   index+=2;const rows=[];
   while(index<lines.length&&lines[index].trim()&&lines[index].includes('|')&&!headingFor(lines[index])&&!fenceFor(lines[index])&&!quoteFor(lines[index])&&!listFor(lines[index])&&!ruleFor(lines[index]))rows.push(tableCells(lines[index++]));
   nodes.push(<div className="conversation-rich-table-wrap" key={key}><table className="conversation-rich-table"><thead><tr>{table.headers.map((cell,column)=><th key={column} scope="col">{inline(cell,`${key}-head-${column}`)}</th>)}</tr></thead><tbody>{rows.map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,column)=><td key={column}>{inline(cell,`${key}-cell-${rowIndex}-${column}`)}</td>)}</tr>)}</tbody></table></div>);continue;
  }
  const list=listFor(line);
  if(list){
   const ordered=Boolean(list[2]),items=[];let start=ordered?Number(list[2]):undefined;
   while(index<lines.length){const item=listFor(lines[index]);if(!item||Boolean(item[2])!==ordered)break;items.push(item[3]);index++;}
   const List=ordered?'ol':'ul';
   nodes.push(<List className={`conversation-rich-list conversation-rich-${ordered?'ordered':'unordered'}`} start={ordered?start:undefined} key={key}>{items.map((item,itemIndex)=><li key={itemIndex}>{inline(item,`${key}-item-${itemIndex}`)}</li>)}</List>);continue;
  }
  const paragraph=[line];index++;
  while(index<lines.length&&!blockStart(lines,index))paragraph.push(lines[index++]);
  nodes.push(<p className="conversation-rich-paragraph" key={key}>{inline(paragraph.join('\n'),key)}</p>);
 }
 return nodes;
}

/** A small React-only Markdown view; raw HTML and all links stay literal text. */
export default function ConversationRichText({text=''}){
 const source=typeof text==='string'?text:'';
 if(source.length>maxCharacters)throw new RangeError('对话内容最多16000字符');
 return <div className="conversation-rich-text">{blocks(source.replace(/\r\n?/g,'\n').split('\n'))}</div>;
}
