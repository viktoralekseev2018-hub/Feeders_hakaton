#!/usr/bin/env python3
"""Run release checks and retain readable logs. Requires Go, Node, Python."""
import json, os, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
LOGS=ROOT/'docs/validation'
LOGS.mkdir(parents=True,exist_ok=True)
checks=[
 ('go-tests',['go','test','-json','-count=1','-mod=vendor','./...']),
 ('go-vet',['go','vet','-mod=vendor','./...']),
 ('go-race',['go','test','-race','-count=1','-mod=vendor','./internal/game','./internal/npc','./internal/agents','./internal/server','./internal/storage']),
 ('world-assets',['node','scripts/verify-world.mjs']),
 ('crew-corpus',['python3','scripts/build_crew_corpus.py','--check']),
 ('release-binary',['go','run','-mod=vendor','./cmd/smoke-release','./bin/game-server'])
]
results=[]
for name,args in checks:
 result=subprocess.run(args,cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 (LOGS/(name+'.log')).write_text(result.stdout)
 entry={'check':name,'exit_code':result.returncode,'passed':result.returncode==0,'log':name+'.log'}
 if name=='go-tests':
  events=[]
  for line in result.stdout.splitlines():
   try: events.append(json.loads(line))
   except ValueError: pass
  entry['tests_passed']=sum(x.get('Action')=='pass' and bool(x.get('Test')) for x in events)
  entry['tests_skipped']=[x.get('Test') for x in events if x.get('Action')=='skip' and x.get('Test')]
 results.append(entry)
 print(json.dumps(entry),flush=True)
 if result.returncode:
  (LOGS/'checks-release.json').write_text(json.dumps(results,indent=2)+'\n')
  sys.exit(result.returncode)
syntax=[]
for path in sorted((ROOT/'web/src').rglob('*.js')):
 result=subprocess.run(['node','--check',str(path)],capture_output=True,text=True)
 if result.returncode: print(result.stderr);sys.exit(result.returncode)
 syntax.append(str(path.relative_to(ROOT)))
results.append({'check':'javascript-syntax','passed':True,'files':syntax})
(LOGS/'checks-release.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print('All release checks passed.',flush=True)
