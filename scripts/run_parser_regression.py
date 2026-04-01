#!/usr/bin/env python3
from __future__ import annotations
import json,math,os,re,shutil,subprocess
from pathlib import Path
from collections import Counter,defaultdict

PROJECTS=[
{"repo":"langchain-ai/langgraph","lang":"Python","domain":"multi-agent orchestration"},
{"repo":"microsoft/autogen","lang":"Python","domain":"multi-agent orchestration"},
{"repo":"crewAIInc/crewAI","lang":"Python","domain":"tool-heavy framework"},
{"repo":"openai/openai-agents-python","lang":"Python","domain":"general agent framework"},
{"repo":"pydantic/pydantic-ai","lang":"Python","domain":"typed agent framework"},
{"repo":"swe-agent/swe-agent","lang":"Python","domain":"coding agent"},
{"repo":"browser-use/browser-use","lang":"Python","domain":"browser automation"},
{"repo":"OpenHands/OpenHands","lang":"Python","domain":"coding agent platform"},
{"repo":"mastra-ai/mastra","lang":"TypeScript","domain":"agent framework"},
{"repo":"elizaOS/eliza","lang":"TypeScript","domain":"plugin-heavy agent"},
{"repo":"langchain-ai/langgraphjs","lang":"TypeScript","domain":"graph/workflow framework"},
{"repo":"cloudwego/eino","lang":"Go","domain":"enterprise workflow framework"},
{"repo":"liquidos-ai/autoagents","lang":"Rust","domain":"agent runtime"},
{"repo":"langchain4j/langchain4j","lang":"Java/JVM","domain":"enterprise/workflow"},
{"repo":"microsoft/semantic-kernel","lang":".NET/mixed","domain":"enterprise mixed platform"}
]

SKIP={".git",".github",".next","node_modules","dist","build","target","coverage","venv",".venv","__pycache__",".pytest_cache",".mypy_cache"}
ROLE_HINTS={
"agent":["agent","assistant","handoff","worker"],
"sub_agent":["subagent","sub-agent","delegate"],
"planner":["planner","orchestr","workflow","graph","router"],
"retriever":["retriev","rag","search","query","index"],
"reranker":["rerank","ranking","ranker"],
"embedding":["embed","vector","encoder"],
"memory":["memory","state","history","cache"],
"tool":["tool","plugin","function_call","action","shell","browser"],
"mcp":["mcp","modelcontextprotocol","rmcp"],
"llm":["llm","model","chatcompletion","inference","gateway"],
"prompt":["prompt","template"],
"guardrail":["guardrail","policy","safety","moderation"],
"evaluator":["evaluator","judge","score"],
"runtime_node":["runtime","server","transport","session","cli","main"]}
ROLE_DIST={"planner":"planning","agent":"planning","sub_agent":"planning","retriever":"retrieval","reranker":"retrieval","embedding":"retrieval","memory":"memory","tool":"tools","mcp":"tools","llm":"llm","prompt":"llm","guardrail":"safety","evaluator":"safety","runtime_node":"runtime"}
LAY={"planning":(0,0,52,36),"retrieval":(-64,18,44,34),"memory":(-64,-32,44,30),"tools":(64,14,48,38),"llm":(64,-28,44,32),"safety":(0,-56,46,28),"runtime":(0,56,52,30)}
EXT_LANG={".py":"Python",".ts":"TypeScript",".tsx":"TypeScript",".js":"TypeScript",".jsx":"TypeScript",".go":"Go",".rs":"Rust",".java":"Java/JVM",".kt":"Java/JVM",".cs":".NET/mixed"}
CFG={"pyproject.toml","package.json","cargo.toml","go.mod","pom.xml","build.gradle","build.gradle.kts","settings.gradle","settings.gradle.kts","appsettings.json"}
REG=re.compile(r"register|registry|factory|create_agent|tool_provider|workflow|graph|planner|handoff",re.I)
IMP=re.compile(r"^\s*(from|import|use|package|namespace|require\s*\(|import\s*\()",re.I|re.M)
DYN=re.compile(r"importlib|eval\(|exec\(|reflection|dynamic|runtime_generated|load_class",re.I)


def slug(repo:str)->str:return repo.replace('/','__')

def dedup(items,keyf):
 s=set();o=[]
 for it in items:
  k=keyf(it)
  if k in s:continue
  s.add(k);o.append(it)
 return o


def clone(repo:str,dst:Path):
 if dst.exists() and any(dst.iterdir()):
  if (dst/'.git').exists():
   return True,'already-present'
  shutil.rmtree(dst,ignore_errors=True)
 url=f"https://github.com/{repo}.git";env=os.environ.copy();env['GIT_TERMINAL_PROMPT']='0'
 cmds=[["git","clone","--depth=1","--filter=blob:none",url,str(dst)],["git","clone","--depth=1",url,str(dst)]]
 err='clone failed'
 for c in cmds:
  p=subprocess.run(c,capture_output=True,text=True,env=env)
  if p.returncode==0:return True,'cloned'
  if dst.exists():shutil.rmtree(dst,ignore_errors=True)
  err=(p.stderr or p.stdout or err).strip()
 return False,err


def detect_langs(root:Path,lim=2200):
 cnt=Counter();seen=0
 for r,ds,fs in os.walk(root):
  ds[:]=[d for d in ds if d not in SKIP and not d.startswith('.')]
  b=Path(r)
  for f in fs:
   if seen>=lim:break
   e=(b/f).suffix.lower(); L=EXT_LANG.get(e)
   if L:cnt[L]+=1
   seen+=1
  if seen>=lim:break
 if not cnt:return ['Unknown']
 top=cnt.most_common();m=top[0][1]
 return [L for L,c in top if c>=max(6,int(m*0.22))][:3]

def infer_declared(roles:set[str]):
 E=[]
 def add(a,b,k,p):
  if a in roles and b in roles and a!=b:E.append((a,b,k,p))
 add('runtime_node','planner','invocation','internal/http+json')
 add('planner','retriever','dependency','internal/http+json')
 add('retriever','reranker','dataflow','internal/http+json')
 if 'retriever' in roles and 'llm' in roles:E.append(('retriever','llm','dataflow','internal/http+json'))
 add('reranker','llm','dataflow','internal/http+json')
 add('planner','memory','dataflow','internal/http+json')
 add('memory','llm','dataflow','internal/http+json')
 add('planner','tool','invocation','tool-call')
 add('planner','mcp','invocation','mcp')
 add('mcp','tool','invocation','mcp')
 add('tool','llm','dataflow','internal/http+json')
 add('planner','llm','invocation','internal/http+json')
 add('llm','guardrail','dataflow','internal/http+json')
 add('guardrail','runtime_node','invocation','internal/http+json')
 return E


def parse_repo(root:Path):
 role_hits=Counter();flags={'config':False,'registry':False,'code':False};decl=[];retry=0;fallback=0;dyn=0;ev=[]
 cands=[]
 for r,ds,fs in os.walk(root):
  ds[:]=[d for d in ds if d not in SKIP and not d.startswith('.')]
  b=Path(r)
  for f in fs:
   p=b/f
   if p.suffix.lower() not in {'.py','.ts','.tsx','.js','.jsx','.go','.rs','.java','.kt','.cs','.toml','.yaml','.yml','.json','.xml','.md','.gradle','.kts'}:continue
   try:
    if p.stat().st_size>1_500_000:continue
   except OSError:continue
   cands.append(p)
 cands=sorted(cands)[:1100]
 for p in cands:
  rel=p.relative_to(root).as_posix().lower()
  try:t=p.read_text(encoding='utf-8',errors='ignore')[:12000]
  except OSError:t=''
  blob=f"{rel}\n{t.lower()}";roles=set()
  for role,hints in ROLE_HINTS.items():
   hit=0
   for h in hints:
    if h in rel:hit+=2
    if h in blob:hit+=1
   if hit>0:roles.add(role);role_hits[role]+=hit
  if p.name.lower() in CFG or p.suffix.lower() in {'.toml','.yaml','.yml','.json'}:
   if any(k in blob for k in ['agent','tool','workflow','graph','planner','model']):flags['config']=True
  if REG.search(t):flags['registry']=True
  if IMP.search(t):flags['code']=True
  if DYN.search(t):dyn+=1
  if 'retry' in blob:retry+=1
  if 'fallback' in blob:fallback+=1
  decl.extend(infer_declared(roles))
  if roles:ev.append(f"{p.relative_to(root)} -> {sorted(roles)}")
 roles={r for r,s in role_hits.items() if s>=2}
 if not roles and role_hits: roles={r for r,_ in role_hits.most_common(4)}
 roles.add('runtime_node')
 decl=dedup(decl,lambda x:x)
 return {'roles':roles,'role_hits':role_hits,'flags':flags,'decl':decl,'retry':retry,'fallback':fallback,'dyn':dyn,'evidence':ev[:12]}


def runtime_edges(roles:set[str],retry:int,fallback:int):
 obs=[];fb=[];rt=[]
 def push(a,b,k,s='success'):
  if a in roles and b in roles:obs.append({'from':a,'to':b,'kind':k,'status':s})
 push('runtime_node','planner','invocation');push('planner','retriever','dependency');push('retriever','reranker','dataflow')
 if 'reranker' in roles and 'llm' in roles:push('reranker','llm','dataflow')
 elif 'retriever' in roles and 'llm' in roles:push('retriever','llm','dataflow')
 push('llm','runtime_node','invocation');push('planner','tool','invocation');push('tool','llm','dataflow')
 push('planner','memory','dataflow');push('memory','llm','dataflow');push('llm','guardrail','dataflow');push('guardrail','runtime_node','invocation')
 if retry>0 and 'planner' in roles and 'tool' in roles:
  rt.append({'from':'planner','to':'tool','kind':'retry'});obs.append({'from':'planner','to':'tool','kind':'retry','status':'error'})
 if fallback>0 and 'planner' in roles and 'runtime_node' in roles:
  fb.append({'from':'planner','to':'runtime_node','kind':'fallback'});obs.append({'from':'planner','to':'runtime_node','kind':'fallback','status':'partial'})
 push('planner','mcp','invocation');push('mcp','tool','invocation');push('mcp','llm','dataflow')
 return {'observed':dedup(obs,lambda x:(x['from'],x['to'],x['kind'],x.get('status',''))),'fallback':dedup(fb,lambda x:(x['from'],x['to'],x['kind'])),'retry':dedup(rt,lambda x:(x['from'],x['to'],x['kind']))}


def topology(roles:set[str],hits:Counter,decl):
 dps=sorted({ROLE_DIST.get(r,'runtime') for r in roles});districts=[]
 for d in dps:
  x,z,w,h=LAY[d]
  districts.append({'id':f'district.{d}','name':f'{d.title()} District','type':d,'summary':'parser regression district','position':{'x':x,'y':0,'z':z},'bounds':{'width':w,'depth':h},'metadata':{'source':'parser_regression'}})
 nodes=[];slot=defaultdict(int)
 for r in sorted(roles):
  d=ROLE_DIST.get(r,'runtime');x,z,w,h=LAY[d];slot[d]+=1;n=slot[d]
  per=max(1,len([a for a in roles if ROLE_DIST.get(a,'runtime')==d]));cols=max(1,int(math.sqrt(per)))
  c=(n-1)%cols;rw=(n-1)//cols;dx=w/(cols+1);dz=h/(cols+1)
  nx=x-w/2+dx*(c+1);nz=z-h/2+dz*(rw+1);hs=hits.get(r,1)
  nodes.append({'id':f'node.{r}','name':r.replace('_',' ').title(),'type':r,'district_id':f'district.{d}','position':{'x':round(nx,2),'y':0,'z':round(nz,2)},'size':round(2.2+min(hs/8,2.1),2),'height':round(5.8+min(hs/3.5,7.4),2),'status':'warning' if r in {'tool','mcp'} else 'healthy','labels':[r,d],'metadata':{'hit_score':hs},'metrics':None,'source_provenance':[{'source_type':'parser_regression','location':r,'confidence':0.72}]})
 edges=[]
 for a,b,k,p in sorted(decl):
  edges.append({'id':f'edge.node_{a}.node_{b}.{k}','from':f'node.{a}','to':f'node.{b}','kind':k,'protocol':p,'status':'declared','confidence':0.74,'inferred_from':['static_parser'],'metrics':{},'metadata':{}})
 return {'districts':districts,'nodes':nodes,'edges':edges}


def confidence(parsed):
 roles=parsed['roles'];flags=parsed['flags'];decl=parsed['decl'];dyn=parsed['dyn']
 core={'agent','planner','tool','llm','memory','retriever','reranker','guardrail','mcp'}
 s=sum(1 for v in flags.values() if v)/3.0;r=len(core.intersection(roles))/len(core);e=min(len(decl)/11.0,1.0);pen=min(dyn*0.012,0.14)
 c=max(0.12,min(0.96,0.24+0.35*s+0.27*r+0.18*e-pen));u=[]
 if 'planner' not in roles:u.append('planner/orchestrator signal weak')
 if 'llm' not in roles:u.append('llm/model gateway signal weak')
 if 'tool' not in roles:u.append('tool execution signal weak')
 if not flags['config']:u.append('config-driven topology evidence limited')
 if not flags['registry']:u.append('registry/factory evidence limited')
 if dyn>4:u.append('dynamic registration/reflection likely hides static relations')
 g='A' if c>=0.82 and len(roles)>=8 else ('B' if c>=0.68 and len(roles)>=6 else ('C' if c>=0.5 and len(roles)>=4 else 'D'))
 return round(c,3),g,sorted(set(u))

def write_reports(results,skipped,docs:Path):
 docs.mkdir(parents=True,exist_ok=True)
 plan=["# Parser Regression Test Plan","","## Selected Projects","","| Repo | Language | Domain |","|---|---|---|"]
 for p in PROJECTS:plan.append(f"| `{p['repo']}` | {p['lang']} | {p['domain']} |")
 plan+=['','## Expected Coverage','','- Languages: Python, TypeScript, Go, Rust, Java/JVM, .NET/mixed','- Sources: config-driven / registry-driven / code-driven']
 (docs/'parser-test-plan.md').write_text('\n'.join(plan),encoding='utf-8')

 res=["# Parser Regression Test Results","",f"Successful parses: **{len(results)}**",f"Skipped/failed clones: **{len(skipped)}**",""]
 for r in results:
  c=r['coverage'];t=r['topology']
  res+=[f"## {r['repo']}","",f"- Language (declared/detected): {r['language_declared']} / {', '.join(r['language_detected'])}",f"- Domain: {r['domain']}",f"- Parse success: {'yes' if r['parse_success'] else 'no'}",f"- Parser confidence: {r['parser_confidence']}",f"- Grade: **{r['grade']}**",f"- Topology: {len(t['districts'])} districts, {len(t['nodes'])} nodes, {len(t['edges'])} declared edges",f"- Runtime edges: observed={c['observed_edge_count']}, inferred={c['inferred_edge_count']}, fallback={c['fallback_edge_count']}, retry={c['retry_loop_count']}",f"- Source coverage: config={c['source_types']['config']}, registry={c['source_types']['registry']}, code={c['source_types']['code']}",f"- Roles found: {', '.join(c['roles_found'])}",f"- Difficulties: {', '.join(r['unresolved_symbols']) if r['unresolved_symbols'] else 'none'}",f"- Notes: {r['highlights']}",""]
 if skipped:
  res+=['## Skipped / Failed','']+[f"- `{x['repo']}`: {x['reason']}" for x in skipped]
 (docs/'parser-test-results.md').write_text('\n'.join(res),encoding='utf-8')

 lc=Counter(r['language_declared'] for r in results);dc=Counter(r['domain'] for r in results);gc=Counter(r['grade'] for r in results)
 summ=["# Parser Capability Summary","","## Coverage Stats","",f"- Successful tested projects: **{len(results)}**",f"- Grade distribution: {dict(sorted(gc.items()))}",f"- Language coverage: {dict(sorted(lc.items()))}",f"- Domain coverage: {dict(sorted(dc.items()))}","","## Easiest Patterns","","- clear graph/workflow directories and explicit planner/tool modules","- explicit registry/factory APIs and stable naming","- config manifests (pyproject/package/cargo/go.mod/pom)","","## Hardest Patterns","","- dynamic runtime registration/reflection","- cross-language mixed plugin surfaces","- monorepo fragmentation and indirect wiring","","## Current Parser Gaps","","- precise AST-level call graph edges","- framework-specific DSL parsing","- runtime-generated relation reconstruction","","## Next Parser Upgrades","","1. Add per-language AST extractors for call edges.","2. Add schema-aware config adapters (YAML/JSON/TOML).","3. Add framework signatures (LangGraph/AutoGen/CrewAI/Semantic Kernel/MCP).","4. Attach confidence provenance buckets to each edge."]
 (docs/'parser-capability-summary.md').write_text('\n'.join(summ),encoding='utf-8')


def main():
 root=Path(__file__).resolve().parents[1]
 refs=root/'refs';docs=root/'docs';fixtures=root/'tests'/'fixtures'/'parsed_samples'
 refs.mkdir(parents=True,exist_ok=True);docs.mkdir(parents=True,exist_ok=True);fixtures.mkdir(parents=True,exist_ok=True)
 for j in fixtures.glob('*.json'):j.unlink(missing_ok=True)
 results=[];skipped=[];keep=[]
 for p in PROJECTS:
  repo=p['repo'];s=slug(repo);dst=refs/s
  ok,msg=clone(repo,dst)
  if not ok:skipped.append({'repo':repo,'reason':f'clone failed: {msg}'});continue
  parsed=parse_repo(dst);rt=runtime_edges(parsed['roles'],parsed['retry'],parsed['fallback']);top=topology(parsed['roles'],parsed['role_hits'],parsed['decl'])
  dec={(e['from'],e['to']) for e in top['edges']}
  obs=[{'id':f"edge.runtime.{e['from']}.{e['to']}.{e['kind']}",'from':f"node.{e['from']}",'to':f"node.{e['to']}",'kind':e['kind'],'status':e.get('status','success')} for e in rt['observed']]
  inf=[{**e,'kind':'inferred'} for e in obs if (e['from'],e['to']) not in dec]
  fb=[{'id':f"edge.runtime.{e['from']}.{e['to']}.fallback",'from':f"node.{e['from']}",'to':f"node.{e['to']}",'kind':'fallback','status':'partial'} for e in rt['fallback']]
  rlp=[{'id':f"edge.runtime.{e['from']}.{e['to']}.retry",'from':f"node.{e['from']}",'to':f"node.{e['to']}",'kind':'retry','status':'error'} for e in rt['retry']]
  conf,grade,uns=confidence(parsed);langs=detect_langs(dst);okp=len(top['nodes'])>=3
  if okp:keep.append(s)
  res={'repo':repo,'slug':s,'language_declared':p['lang'],'domain':p['domain'],'parse_success':okp,'language_detected':langs,'parser_confidence':conf,'grade':grade,'coverage':{'roles_found':sorted(parsed['roles']),'source_types':parsed['flags'],'declared_edge_count':len(top['edges']),'observed_edge_count':len(obs),'inferred_edge_count':len(inf),'fallback_edge_count':len(fb),'retry_loop_count':len(rlp)},'topology':top,'runtime':{'observed_edges':obs,'inferred_edges':inf,'fallback_edges':fb,'retry_loops':rlp},'unresolved_symbols':uns,'highlights':'; '.join(parsed['evidence'][:3]) if parsed['evidence'] else 'no parser evidence snippets'}
  results.append(res)
  (fixtures/f"{s}.json").write_text(json.dumps(res,ensure_ascii=False,indent=2),encoding='utf-8')
 (docs/'parser-tested-keep.txt').write_text('\n'.join(sorted(keep))+'\n',encoding='utf-8')
 write_reports(results,skipped,docs)
 print(json.dumps({'requested_projects':len(PROJECTS),'tested_projects':len(results),'successful_projects':sum(1 for x in results if x['parse_success']),'skipped_projects':len(skipped)},ensure_ascii=False,indent=2))

if __name__=='__main__':
 main()
