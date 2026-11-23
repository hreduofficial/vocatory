import sys,json,os
D=os.path.dirname(os.path.abspath(__file__))
s=open(os.path.join(D,'app/app.html')).read();data=open(os.path.join(D,'app/data.json')).read()
A=json.load(open(os.path.join(D,'app/assets.json')))
for k,v in A.items(): s=s.replace('__A_'+k+'__',v)
inline = len(sys.argv)<3 or sys.argv[2]!='artifact'
if not inline:
    open(sys.argv[1],'w').write(s);sys.exit()
lines=s.split('\n')
html='<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'+lines[0]+'\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}body{margin:0}</style>\n<script>window.VOCA_DATA='+data+';</script>\n</head><body>\n'+'\n'.join(lines[1:])+'\n</body></html>'
open(sys.argv[1],'w').write(html)
