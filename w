const http=require('http');
const PID='cmqhuhahi00jzsiyk6bovq9ix';
function ap(p,b){return new Promise(r=>{const d=b?JSON.stringify(b):'';const q=http.request({hostname:'localhost',port:3000,path:p,method:b?'POST':'GET',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(d)}},res=>{let y='';res.on('data',c=>y+=c);res.on('end',()=>{try{r({s:res.statusCode,d:JSON.parse(y)})}catch{r({s:res.statusCode,d:y})}})});if(d)q.write(d);q.end()})}
(async()=>{
const l=await ap('/api/login',{username:'admin',password:'Admin@123'});
const [pj,wf]=await Promise.all([ap('/api/projects/'+PID),ap('/api/projects/'+PID+'/workflow')]);
const p=pj.d,st=wf.d?.stages||[];
console.log('===============================================================');
console.log('  PROJECT WORKFLOW AUDIT');
console.log('===============================================================');
console.log('Project: '+(p?.projectCode||'N/A')+' - '+(p?.name||'N/A'));
console.log('  Status: '+p?.status+' | Progress: '+p?.progress+'%');
console.log('  Start: '+String(p?.startDate).substring(0,10)+' -> End: '+String(p?.endDate).substring(0,10));
console.log('');
console.log('-- Workflow Stages: '+st.length+' -----------------------');
let issues=[],ts=0,ct=0,cs=0;
for(const s of st){
const tasks=s.tasks||[],cl=s.checklists||[],ap2=s.approvals||[],ph=s.photos||[];
const dts=tasks.filter(t=>(t.status||'').toUpperCase()==='COMPLETED').length;
const allDone=dts===tasks.length&&tasks.length>0;
const ss=(s.status||'').toUpperCase();
if(ss==='COMPLETED')cs++;
ct+=dts;ts+=tasks.length;
console.log('  Stage '+(s.sequence||'?')+': '+s.name);
console.log('    Status: '+s.status+(ss==='COMPLETED'?' [DONE]':' [PENDING]'));
console.log('    Tasks: '+tasks.length+' ('+dts+' done)');
console.log('    Checklist: '+cl.length+' ('+cl.filter(c=>c.isChecked||c.checked).length+' checked)');
console.log('    Approvals: '+ap2.length+' ('+ap2.filter(a=>(a.status||'').toUpperCase()==='APPROVED').length+' approved)');
console.log('    Photos: '+ph.length);
if(ss==='COMPLETED'&&!allDone&&tasks.length>0)issues.push('Stage ['+s.name+'] COMPLETED but '+(tasks.length-dts)+' tasks incomplete');
if(allDone&&ss!=='COMPLETED')issues.push('Stage ['+s.name+'] all tasks done but status='+s.status);
if(s.reqChecklist&&cl.length===0)issues.push('Stage ['+s.name+'] requires checklist but 0 items');
if(s.reqApproval&&ap2.length===0)issues.push('Stage ['+s.name+'] requires approval but 0 records');
const mu=cl.filter(c=>(c.isMandatory||c.mandatory)&&!(c.isChecked||c.checked));
if(mu.length>0&&ss==='COMPLETED')issues.push('Stage ['+s.name+'] COMPLETED but '+mu.length+' mandatory items unchecked');
const pa=ap2.filter(a=>(a.status||'').toUpperCase()!=='APPROVED');
if(pa.length>0&&ss==='COMPLETED')issues.push('Stage ['+s.name+'] COMPLETED but '+pa.length+' approvals pending');
for(const t of tasks){const ti=(t.status||'').toUpperCase();console.log('    '+(ti==='COMPLETED'?'[Y]':ti==='IN_PROGRESS'?'[~]':'[ ]')+' '+t.name+' ['+t.status+']')}
console.log('')
}
console.log('===============================================================');
console.log('  AUDIT SUMMARY');
console.log('===============================================================');
console.log('  Stages: '+st.length+' ('+cs+' completed)');
console.log('  Tasks: '+ts+' ('+ct+' completed)');
console.log('  Issues: '+issues.length);
if(issues.length>0){console.log('');console.log('  -- ISSUES --');issues.forEach((x,i)=>console.log('  '+(i+1)+'. '+x))}else{console.log('  OK - NO ISSUES FOUND!')}
const sc=st.length>0?Math.round(cs/st.length*100):0;
const tc=ts>0?Math.round(ct/ts*100):0;
console.log('');console.log('  Stage Completion: '+sc+'%');
console.log('  Task Completion: '+tc+'%');
console.log('  Project Progress: '+(p?.progress||0)+'%');
if(sc!==(p?.progress||0))console.log('  ! MISMATCH: Stage ('+sc+'%) != Progress ('+(p?.progress||0)+'%)');
else console.log('  OK - Stage completion matches project progress');
if(sc===100&&(p?.status||'').toUpperCase()!=='COMPLETED')issues.push('All stages done but project status='+p?.status);
if(sc<100&&(p?.status||'').toUpperCase()==='COMPLETED')issues.push('Project COMPLETED but only '+sc+'% stages done');
if(issues.length>0){console.log('');console.log('  -- FINAL ISSUES --');issues.forEach((x,i)=>console.log('  '+(i+1)+'. '+x))}
else{console.log('  OK - ALL CHECKS PASSED!')}
console.log('');console.log('===============================================================');
})().catch(e=>console.error('Audit failed:',e));