import sys
s=open('app/app.html').read();data=open('app/data.json').read();lines=s.split('\n')
html='<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'+lines[0]+'\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}</style>\n<script>window.VOCA_DATA='+data+';</script>\n</head><body>\n'+'\n'.join(lines[1:])+'\n</body></html>'
open(sys.argv[1],'w').write(html)
