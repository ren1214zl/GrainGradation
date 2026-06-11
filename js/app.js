var RANGES = [
  {label:'100~60', from:60, to:100, sieve:60},
  {label:'60~20', from:20, to:60, sieve:20},
  {label:'20~5', from:5, to:20, sieve:5},
  {label:'5~2', from:2, to:5, sieve:2},
  {label:'2~0.5', from:0.5, to:2, sieve:0.5},
  {label:'0.5~0.25', from:0.25, to:0.5, sieve:0.25},
  {label:'0.25~0.075', from:0.075, to:0.25, sieve:0.075},
  {label:'0.075~0.005', from:0.005, to:0.075, sieve:0.005},
  {label:'<0.005', from:0, to:0.005, sieve:null}
];
var SIEVES = [100, 60, 20, 5, 2, 0.5, 0.25, 0.075, 0.005];
var sampleCounter = 0;
var chartInstances = {};
var sampleColors = ['#e4393c','#096dd9','#2b8c5e','#e67e22','#8e44ad','#1abc9c','#16a085','#c0392b'];

function cubicSplineInterp(x,y,tx){
  var n=x.length;if(n===1)return tx.map(function(){return y[0]});
  if(n===2)return tx.map(function(t){return y[0]+(y[1]-y[0])*(t-x[0])/(x[1]-x[0])});
  var h=[];for(var i=0;i<n-1;i++)h.push(x[i+1]-x[i]);
  var alpha=[0];for(var i=1;i<n-1;i++)alpha.push(3/h[i]*(y[i+1]-y[i])-3/h[i-1]*(y[i]-y[i-1]));
  var l=[1],mu=[0],z=[0];
  for(var i=1;i<n-1;i++){l.push(2*(x[i+1]-x[i-1])-h[i-1]*mu[i-1]);mu.push(h[i]/l[i]);z.push((alpha[i]-h[i-1]*z[i-1])/l[i]);}
  l.push(1);z.push(0);
  var c=new Array(n).fill(0),b=new Array(n-1),d=new Array(n-1);
  for(var j=n-2;j>=0;j--){c[j]=z[j]-mu[j]*c[j+1];b[j]=(y[j+1]-y[j])/h[j]-h[j]*(c[j+1]+2*c[j])/3;d[j]=(c[j+1]-c[j])/(3*h[j]);}
  var out=[];
  for(var k=0;k<tx.length;k++){
    var t=tx[k];if(t<=x[0]){out.push(y[0]);continue}if(t>=x[n-1]){out.push(y[n-1]);continue}
    for(var i=0;i<n-1;i++){if(t>=x[i]&&t<=x[i+1])break}
    var dx=t-x[i];out.push(y[i]+b[i]*dx+c[i]*dx*dx+d[i]*dx*dx*dx);
  }
  return out;
}

function buildCurveSegments(data,num){
  if(data.length<2)return[];num=num||600;
  var sorted=data.slice().sort(function(a,b){return a.sieve-b.sieve});
  var segs=[];var cur=[sorted[0]];
  for(var i=1;i<sorted.length;i++){
    var pi=SIEVES.indexOf(sorted[i-1].sieve);
    var ci=SIEVES.indexOf(sorted[i].sieve);
    if(pi===ci+1){cur.push(sorted[i]);}
    else{segs.push(cur);cur=[sorted[i]];}
  }
  segs.push(cur);
  var out=[];
  segs.forEach(function(seg){
    if(seg.length<2)return;
    var logX=seg.map(function(d){return Math.log10(d.sieve)});
    var y=seg.map(function(d){return d.pct});
    var segMaxLog=Math.max.apply(null,logX);
    var segMinLog=Math.min.apply(null,logX);
    var step=(segMinLog-segMaxLog)/(num-1);
    var tLog=[];for(var i=0;i<num;i++)tLog.push(segMaxLog+i*step);
    var iy=cubicSplineInterp(logX,y,tLog);
    var pts=[];for(var i=0;i<tLog.length;i++){var v=Math.max(0,Math.min(100,iy[i]));pts.push([Math.pow(10,tLog[i]),v]);}
    out.push(pts);
  });
  return out;
}

function calcPassingFromRanges(sid){
  var vals={};var total=0;
  RANGES.forEach(function(r,idx){
    var row=document.getElementById('rng-row-'+sid+'-'+idx);
    if(row&&row.classList.contains('deleted')){vals[r.label]=0;return;}
    var el=document.getElementById('rng-'+sid+'-'+idx);if(!el)return;
    var v=parseFloat(el.value)||0;vals[r.label]=v;total+=v;
  });
  var sieveVals={};var cum=100;
  sieveVals[100]=100;
  RANGES.forEach(function(r,idx){
    var row=document.getElementById('rng-row-'+sid+'-'+idx);
    if(row&&row.classList.contains('deleted'))return;
    if(r.sieve!==null){cum-=vals[r.label]||0;sieveVals[r.sieve]=Math.max(0,cum);}
  });
  sieveVals[0.005]=Math.max(0,cum-(vals['<0.005']||0));
  return {sieveVals:sieveVals,total:total,vals:vals};
}

function getSampleName(sid){
  var el=document.getElementById('sn-'+sid);
  return el?el.value||('试样'+(sid+1)):'试样'+(sid+1);
}

function isSampleChecked(sid){
  var el=document.getElementById('chk-'+sid);
  return el?el.checked:true;
}

function toggleRangeDelete(sid,idx){
  var row=document.getElementById('rng-row-'+sid+'-'+idx);
  if(!row)return;row.classList.toggle('deleted');
  var input=document.getElementById('rng-'+sid+'-'+idx);
  if(row.classList.contains('deleted')){input.dataset.orig=input.value;input.disabled=true;input.value=0;}
  else{input.disabled=false;input.value=input.dataset.orig||'';}
  updatePassing(sid);
  generateOne(sid);
}

function toggleSieveDelete(sid,s){
  var row=document.getElementById('pv-row-'+sid+'-'+s);
  if(!row)return;row.classList.toggle('deleted');
  generateOne(sid);
}

function handleRangeKeydown(e,sid,idx){
  if(e.key==='ArrowDown'||e.key==='Enter'){
    e.preventDefault();
    var next=document.getElementById('rng-'+sid+'-'+(idx+1));
    if(next){next.focus();next.select();}
  }else if(e.key==='ArrowUp'){
    e.preventDefault();
    var prev=document.getElementById('rng-'+sid+'-'+(idx-1));
    if(prev){prev.focus();prev.select();}
  }
}

function openPasteModal(){
  document.getElementById('pasteModal').classList.add('show');
  document.getElementById('pasteArea').value='';document.getElementById('pasteArea').focus();
}

function closePasteModal(){
  document.getElementById('pasteModal').classList.remove('show');
}

function applyPasteData(){
  var text=document.getElementById('pasteArea').value.trim();
  if(!text)return;var lines=text.split('\n');var count=0;
  lines.forEach(function(line){
    line=line.trim();if(!line)return;
    var parts=line.split('\t');if(parts.length<2)return;
    var first=parseFloat(parts[0]);var name,values;
    if(isNaN(first)){name=parts[0];values=parts.slice(1);}
    else{name='试样'+(sampleCounter+1);values=parts;}
    var contents=[];for(var i=0;i<9;i++)contents.push(i<values.length?values[i]:'');
    addSample({name:name,contents:contents});count++;
  });
  closePasteModal();if(count>0){generateAll();}
}

function addSample(savedData){
  var sid=sampleCounter++;var color=sampleColors[sid%sampleColors.length];
  var dName=savedData&&savedData.name?savedData.name:'试样'+(sid+1);
  var checked=(!savedData||savedData.printChecked===undefined||savedData.printChecked);
  var container=document.getElementById('samplesContainer');
  var card=document.createElement('div');card.className='sample-card';card.id='sc-'+sid;

  var rangeRows='';
  RANGES.forEach(function(r,idx){
    var val=savedData&&savedData.contents&&savedData.contents[idx]!==undefined?savedData.contents[idx]:'';
    rangeRows+='<tr id="rng-row-'+sid+'-'+idx+'"><td>'+r.label+'</td><td><input id="rng-'+sid+'-'+idx+'" type="number" step="any" value="'+val+'" oninput="updatePassing('+sid+')" onkeydown="handleRangeKeydown(event,'+sid+','+idx+')"></td><td><button class="btn-xxs" onclick="toggleRangeDelete('+sid+','+idx+')">✕</button></td></tr>';
  });
  rangeRows+='<tr class="sum-row"><td>合计</td><td id="sum-'+sid+'">0</td><td></td></tr>';

  var passRows='';
  SIEVES.forEach(function(s){
    passRows+='<tr id="pv-row-'+sid+'-'+s+'"><td>'+s+'</td><td class="pass-val" id="pv-'+sid+'-'+s+'">-</td><td><button class="btn-xxs" onclick="toggleSieveDelete('+sid+','+s+')">✕</button></td></tr>';
  });

  card.innerHTML=
    '<div class="sample-header">'+
      '<div class="left">'+
        '<input type="checkbox" id="chk-'+sid+'" '+(checked?'checked':'')+'>'+
        '<input id="sn-'+sid+'" value="'+dName+'" placeholder="试样名称" style="border-left:3px solid '+color+';padding-left:8px">'+
        '<label for="chk-'+sid+'" style="font-size:12px;color:#888">打印</label>'+
      '</div>'+
      '<button class="btn btn-danger btn-sm" onclick="removeSample('+sid+')">删除</button>'+
    '</div>'+
    '<div class="sample-body">'+
      '<div class="col-range">'+
        '<div style="font-size:13px;font-weight:600;color:#555;margin-bottom:4px">粒组含量</div>'+
        '<table class="static-table"><thead><tr><th>粒径范围(mm)</th><th>含量(%)</th><th style="width:22px"></th></tr></thead><tbody>'+rangeRows+'</tbody></table>'+
      '</div>'+
      '<div class="col-pass">'+
        '<div style="font-size:13px;font-weight:600;color:#555;margin-bottom:4px">通过率</div>'+
        '<table class="static-table"><thead><tr><th>孔径(mm)</th><th>通过率(%)</th><th style="width:22px"></th></tr></thead><tbody>'+passRows+'</tbody></table>'+
      '</div>'+
      '<div class="col-chart" style="border-left:3px solid '+color+'">'+
        '<div class="chart-instance" id="ci-'+sid+'"></div>'+
        '<div class="indicator-box" id="ind-'+sid+'"></div>'+
      '</div>'+
    '</div>';
  container.appendChild(card);

  if(savedData){
    if(savedData.deletedRanges)savedData.deletedRanges.forEach(function(idx){var row=document.getElementById('rng-row-'+sid+'-'+idx);if(row){row.classList.add('deleted');var inp=document.getElementById('rng-'+sid+'-'+idx);if(inp){inp.disabled=true;inp.dataset.orig=inp.value;inp.value=0;}}});
    if(savedData.deletedSieved)savedData.deletedSieved.forEach(function(s){var row=document.getElementById('pv-row-'+sid+'-'+s);if(row)row.classList.add('deleted');});
    if(savedData.contents)updatePassing(sid);
  }
  return sid;
}

function removeSample(sid){
  if(chartInstances[sid]){chartInstances[sid].dispose();delete chartInstances[sid];}
  var el=document.getElementById('sc-'+sid);if(el)el.remove();
}

function updatePassing(sid){
  var result=calcPassingFromRanges(sid);
  document.getElementById('sum-'+sid).textContent=result.total.toFixed(1);
  SIEVES.forEach(function(s){
    var el=document.getElementById('pv-'+sid+'-'+s);
    if(el)el.textContent=result.sieveVals[s]!==undefined?result.sieveVals[s].toFixed(1):'-';
  });
}

function collectData(sid){
  var result=calcPassingFromRanges(sid);
  var data=[];
  SIEVES.forEach(function(s){
    var row=document.getElementById('pv-row-'+sid+'-'+s);
    if(row&&row.classList.contains('deleted'))return;
    if(result.sieveVals[s]!==undefined&&result.sieveVals[s]>=0)data.push({sieve:s,pct:result.sieveVals[s]});
  });
  return data;
}

function generateOne(sid){
  var data=collectData(sid);if(data.length<2)return;
  var segs=buildCurveSegments(data,300);var color=sampleColors[sid%sampleColors.length];var name=getSampleName(sid);
  if(chartInstances[sid]){chartInstances[sid].dispose();}
  chartInstances[sid]=renderChart('ci-'+sid,segs,data,color,name);
  updateIndicators(sid,data);
}

function generateAll(){
  var err=document.getElementById('errorMsg');err.classList.remove('show');
  var cards=document.querySelectorAll('.sample-card');var any=false;
  cards.forEach(function(c){
    var id=parseInt(c.id.replace('sc-',''));updatePassing(id);
    var data=collectData(id);if(data.length>=2){any=true;generateOne(id);}
  });
  if(!any){
    if(cards.length===0){err.textContent='请先添加试样并输入数据';err.classList.add('show');}
    else{err.textContent='请检查粒组合计是否为100%';err.classList.add('show');}
  }
}

function calcIndicators(data){
  if(!data||data.length<2)return null;
  function getPctAt(sieve){
    var sorted=data.slice().sort(function(a,b){return a.sieve-b.sieve});
    var logX=sorted.map(function(d){return Math.log10(d.sieve)});
    var y=sorted.map(function(d){return d.pct});
    var iv=cubicSplineInterp(logX,y,[Math.log10(sieve)]);return iv[0];
  }
  function findD(pct){
    var cand=[];for(var i=0;i<500;i++){var logV=-3+(2-(-3))*i/499;var v=Math.pow(10,logV);var p=getPctAt(v);if(p!==null)cand.push({sieve:v,pct:p});}
    var best=cand[0];for(var i=1;i<cand.length;i++){if(Math.abs(cand[i].pct-pct)<Math.abs(best.pct-pct))best=cand[i];}
    return best.sieve;
  }
  var d10=findD(10),d30=findD(30),d60=findD(60);
  return{d10:d10,d30:d30,d60:d60,Cu:d60/d10,Cc:d30*d30/(d10*d60)};
}

function renderChart(containerId,segments,rawData,lineColor,seriesName){
  var dom=document.getElementById(containerId);if(!dom)return null;
  var chart=echarts.init(dom,null,{renderer:'canvas',devicePixelRatio:2});
  var series=[];
  segments.forEach(function(seg){
    if(seg&&seg.length>0)series.push({name:seriesName,type:'line',data:seg,smooth:true,symbol:'none',lineStyle:{width:2.5,color:lineColor},animation:false});
  });
  var scData=(rawData||[]).map(function(d){return[d.sieve,d.pct]});
  if(scData.length>0){
    series.push({name:seriesName,type:'scatter',data:scData,symbol:'circle',symbolSize:10,itemStyle:{color:lineColor,borderColor:'#fff',borderWidth:2.5},animation:false});
  }
  chart.setOption({
    tooltip:{trigger:'axis',confine:true,formatter:function(p){if(!p||!p.length)return'';var d=p[0];return'<b>'+d.axisValueLabel+' mm</b><br/>'+d.marker+' '+seriesName+'：<b>'+(d.value[1]!==undefined?d.value[1].toFixed(1):'')+'</b>%';}},
    grid:{left:80,right:22,top:18,bottom:52},
    xAxis:{type:'log',logBase:10,min:0.001,max:100,inverse:true,name:'粒径 (mm)',nameLocation:'middle',nameGap:24,nameTextStyle:{fontSize:16,fontWeight:'bold',padding:[0,0,0,0]},axisLabel:{showMinLabel:true,showMaxLabel:true,formatter:function(v){if(v>=1)return v>=10?''+v:''+v;if(v>=0.1)return v.toFixed(1);if(v>=0.01)return v.toFixed(2);if(v>=0.001)return '0.001';return''+v;},fontSize:14},splitLine:{show:true,lineStyle:{type:'dashed',color:'#e8e8e8'}},axisLine:{lineStyle:{color:'#444'}},minorTick:{show:true,splitNumber:9},minorSplitLine:{show:true,lineStyle:{type:'dotted',color:'#f0f0f0'}}},
    yAxis:{type:'value',min:0,max:100,interval:10,name:'小于某粒径的土重含量(%)',nameLocation:'middle',nameGap:40,nameTextStyle:{fontSize:16,fontWeight:'bold',padding:[0,0,0,10]},axisLabel:{formatter:'{value}',fontSize:14},splitLine:{show:true,lineStyle:{type:'dashed',color:'#d0d0d0'}},axisLine:{lineStyle:{color:'#444'}}},
    series:series
  });
  return chart;
}

function updateIndicators(sid,data){
  var ind=calcIndicators(data);if(!ind)return;
  document.getElementById('ind-'+sid).innerHTML=
    '<span>d₁₀='+ind.d10.toFixed(3)+'mm</span><span>d₃₀='+ind.d30.toFixed(3)+'mm</span><span>d₆₀='+ind.d60.toFixed(3)+'mm</span><span>Cu='+ind.Cu.toFixed(2)+'</span><span>Cc='+ind.Cc.toFixed(2)+'</span><span>级配：'+(ind.Cu>=5&&ind.Cc>=1&&ind.Cc<=3?'良好':'不良')+'</span>';
}

function buildPrintPages(){
  generateAll();
  var pn=document.getElementById('projName').value||'';var un=document.getElementById('unitName').value||'';
  var dv=document.getElementById('testDate').value||'__________';
  var tester=document.getElementById('tester').value||'__________';
  var checker=document.getElementById('checker').value||'__________';

  var selected=[];
  document.querySelectorAll('.sample-card').forEach(function(c){
    var id=parseInt(c.id.replace('sc-',''));
    if(!isSampleChecked(id))return;
    var data=collectData(id);if(data.length<2)return;
    selected.push({id:id,data:data});
  });

  var section=document.getElementById('printSection');
  section.innerHTML='';
  if(selected.length===0){alert('请至少勾选一个试样（点击试样名称旁的复选框）');return;}

  var pages=Math.ceil(selected.length/3);
  for(var p=0;p<pages;p++){
    var pageDiv=document.createElement('div');
    pageDiv.className='print-page';
    var pageHtml=
      '<div class="pp-title">颗粒分析成果图表</div>'+
      '<div class="pp-sub"><span>工程名称：'+pn+'</span><span>试验单位：'+un+'</span><span>日期：'+dv+'</span></div>'+
      '<div class="pp-grid" id="ppGrid-'+p+'"></div>';
    if(p===0)pageHtml+='<div class="pp-footer"><span>试验者：'+tester+'</span><span>检查者：'+checker+'</span><span>试验日期：'+dv+'</span></div>';
    pageDiv.innerHTML=pageHtml;
    section.appendChild(pageDiv);

    var grid=document.getElementById('ppGrid-'+p);
    for(var i=0;i<3;i++){
      var idx=p*3+i;
      if(idx>=selected.length)break;
      var s=selected[idx];
      var name=getSampleName(s.id);var color=sampleColors[s.id%sampleColors.length];
      var sorted=s.data.slice().sort(function(a,b){return b.sieve-a.sieve;});
      var th='<table><tr><th>孔径(mm)</th><th>通过率(%)</th></tr>';
      sorted.forEach(function(d){
        var row=document.getElementById('pv-row-'+s.id+'-'+d.sieve);
        var isDel=row&&row.classList.contains('deleted');
        th+='<tr'+(isDel?' style="opacity:0.3;text-decoration:line-through"':'')+'><td>'+d.sieve+'</td><td>'+(isDel?'—':d.pct.toFixed(1))+'</td></tr>';
      });th+='</table>';

      var rangeHtml='<table><tr><th>粒径(mm)</th><th>含量(%)</th></tr>';
      RANGES.forEach(function(r,ri){
        var row=document.getElementById('rng-row-'+s.id+'-'+ri);
        var isDel=row&&row.classList.contains('deleted');
        var el=document.getElementById('rng-'+s.id+'-'+ri);
        var v=el?parseFloat(el.value)||0:0;
        rangeHtml+='<tr'+(isDel?' style="opacity:0.3;text-decoration:line-through"':'')+'><td>'+r.label+'</td><td>'+(isDel?'—':v.toFixed(1))+'</td></tr>';
      });rangeHtml+='</table>';

      var ind=calcIndicators(s.data);var indHtml='';
      if(ind)indHtml='d₁₀='+ind.d10.toFixed(3)+' d₃₀='+ind.d30.toFixed(3)+' d₆₀='+ind.d60.toFixed(3)+' Cu='+ind.Cu.toFixed(2)+' Cc='+ind.Cc.toFixed(2)+' 级配：'+(ind.Cu>=5&&ind.Cc>=1&&ind.Cc<=3?'良好':'不良');

      var card=document.createElement('div');card.className='pp-card';
      card.innerHTML=
        '<div class="pp-hdr" style="border-left:3px solid '+color+';padding-left:4px">'+name+'</div>'+
        '<div class="pp-body">'+
          '<div class="pp-tab">'+rangeHtml+'</div>'+
          '<div class="pp-tab">'+th+'</div>'+
          '<div class="pp-chart" id="ppc-'+s.id+'-'+p+'"></div>'+
        '</div>'+
        '<div class="pp-ind"><span>'+indHtml+'</span></div>';
      grid.appendChild(card);
    }
    var remaining=3-(selected.length-p*3);
    if(remaining>0&&remaining<3){for(var j=0;j<remaining;j++){var dummy=document.createElement('div');dummy.style.cssText='border:1px solid transparent';grid.appendChild(dummy);}}
  }

  setTimeout(function(){
    selected.forEach(function(s){
      var chart=chartInstances[s.id];
      if(chart){
        var url=chart.getDataURL({type:'png',pixelRatio:3,backgroundColor:'#fff'});
        var boxes=document.querySelectorAll('[id^="ppc-'+s.id+'-"]');
        boxes.forEach(function(box){
          var img=document.createElement('img');img.src=url;
          img.style.cssText='width:100%;height:100%;object-fit:contain';
          box.appendChild(img);
        });
      }
    });
    setTimeout(function(){window.print();},300);
  },500);
}

function showPrintPreview(){
  buildPrintPages();
}

function collectAllData(){
  var result=[];
  document.querySelectorAll('.sample-card').forEach(function(c){
    var id=parseInt(c.id.replace('sc-',''));var name=getSampleName(id);var contents=[];var deletedRanges=[];var deletedSieved=[];
    RANGES.forEach(function(r,idx){
      var el=document.getElementById('rng-'+id+'-'+idx);contents.push(el?el.value:'');
      var row=document.getElementById('rng-row-'+id+'-'+idx);
      if(row&&row.classList.contains('deleted'))deletedRanges.push(idx);
    });
    SIEVES.forEach(function(s){
      var row=document.getElementById('pv-row-'+id+'-'+s);
      if(row&&row.classList.contains('deleted'))deletedSieved.push(s);
    });
    result.push({name:name,contents:contents,printChecked:isSampleChecked(id),deletedRanges:deletedRanges,deletedSieved:deletedSieved});
  });
  return result;
}

function saveData(){
  var data={projName:document.getElementById('projName').value,unitName:document.getElementById('unitName').value,tester:document.getElementById('tester').value,checker:document.getElementById('checker').value,testDate:document.getElementById('testDate').value,sampleNo:document.getElementById('sampleNo').value,samples:collectAllData()};
  try{localStorage.setItem('grainAnalysisData',JSON.stringify(data));}catch(e){}
  var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='颗粒分析成果数据.json';document.body.appendChild(a);a.click();
  document.body.removeChild(a);URL.revokeObjectURL(a.href);
  alert('数据已保存（含工程信息）！');
}

function loadSaved(){
  try{
    var raw=localStorage.getItem('grainAnalysisData');if(!raw){alert('没有已保存的数据');return;}
    var data=JSON.parse(raw);clearAll();
    if(data.projName)document.getElementById('projName').value=data.projName;
    if(data.unitName)document.getElementById('unitName').value=data.unitName;
    if(data.tester)document.getElementById('tester').value=data.tester;
    if(data.checker)document.getElementById('checker').value=data.checker;
    if(data.testDate)document.getElementById('testDate').value=data.testDate;
    if(data.sampleNo)document.getElementById('sampleNo').value=data.sampleNo;
    if(data.samples)data.samples.forEach(function(s){addSample(s);});
    generateAll();
    alert('数据已恢复！');
  }catch(e){alert('恢复失败：'+e.message);}
}

function clearAll(){
  Object.keys(chartInstances).forEach(function(k){chartInstances[k].dispose();delete chartInstances[k];});
  document.getElementById('samplesContainer').innerHTML='';sampleCounter=0;document.getElementById('printSection').innerHTML='';
}

var SAMPLE_VALUES={
  1:{a:[0,5,12,18,25,20,12,6,2],b:[0,2,8,15,28,24,14,7,2]},
  2:{a:[0,8,15,22,20,15,12,6,2],b:[0,3,10,18,25,20,14,8,2]},
  3:{a:[0,10,18,25,22,12,8,4,1],b:[0,5,12,20,25,18,12,6,2]}
};

function loadSample(idx){
  clearAll();var s=SAMPLE_VALUES[idx];if(!s)return;
  addSample({name:'试样A',contents:s.a});
  addSample({name:'试样B',contents:s.b});
  generateAll();
}

window.addEventListener('resize',function(){Object.keys(chartInstances).forEach(function(k){if(chartInstances[k])chartInstances[k].resize();});});

(function init(){
  var t=new Date();document.getElementById('testDate').value=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
  try{var raw=localStorage.getItem('grainAnalysisData');if(raw){var d=JSON.parse(raw);if(d.samples&&d.samples.length>0){loadSaved();return;}}}catch(e){}
  loadSample(1);
})();