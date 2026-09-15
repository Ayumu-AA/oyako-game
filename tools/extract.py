"""body.html から データ定数を src/data/*.ts に切り出す（生成物。手で直さない）"""
import re,sys
SRC='/home/claude/app/body.html'
OUT='/home/claude/oyako-v2/src/data/'
L=open(SRC,encoding='utf-8').read().split('\n')
# script 部分の トップレベル文の 開始行（1-origin）
starts=[]
for i in range(1408,len(L)):
    s=L[i]
    if re.match(r'^(const |let |var |function |async function |\$\(|document\.|window\.|\(function|if\(|state\.|segPick|bindClearRec|refreshBest\(\)|/\*|\*/|</script>)',s):
        starts.append(i+1)
starts=sorted(set(starts))
def block(name):
    """const NAME= / function NAME( の宣言を、次のトップレベル文の直前まで返す"""
    pat=re.compile(r'^(const|let|var|function) '+re.escape(name)+r'\b')
    st=None
    for i in range(1408,len(L)):
        if pat.match(L[i]): st=i+1; break
    if st is None: raise SystemExit('not found: '+name)
    nxt=[x for x in starts if x>st]
    en=(nxt[0]-1) if nxt else len(L)
    lines=L[st-1:en]
    while lines and (lines[-1].strip()=='' or lines[-1].lstrip().startswith('/*') and lines[-1].rstrip().endswith('*/')):
        lines.pop()
    return lines
def export(lines):
    s='\n'.join(lines)
    s=re.sub(r'^(const|let|var|function) ',r'export \1 ',s,count=1)
    return s
def write(fname,header,names,footer=''):
    parts=[header.rstrip()+'\n']
    for n in names:
        parts.append(export(block(n)))
    parts.append(footer)
    open(OUT+fname,'w',encoding='utf-8').write('\n'.join(parts)+'\n')
    print(fname,'ok')

write('flags.ts','// @ts-nocheck\n/* 生成物: tools/extract.py が body.html から切り出した。国旗の描画（すべてSVGで手描き） */',
      ['pts','star','trigram','unionJack','usStars','chakra','sunRays','MAPLE','FLAGS'],
      'export function flagSVG(code){\n  return \'<svg viewBox="0 0 60 40" role="img" aria-label="国旗">\'+FLAGS[code]()+\'</svg>\';\n}')
write('maps.ts','// @ts-nocheck\n/* 生成物: 地図データ。日本: jp-atlas (MIT)／国土数値情報、世界: world-atlas (ISC)／Natural Earth */',
      ['GEO_ICON','JPBOX','JPINSET','JPMAP','JPCEN','JPCAP','JPADJ','WBOX','WLAND','WMAP','WCEN','JPREG'])
write('images.ts','// @ts-nocheck\n/* 生成物: えいごの絵（WebP base64）。あとで public/eigo/ の実ファイルに切りかえる予定 */',
      ['IMAGES'])
write('questions.ts','// @ts-nocheck\n/* 生成物: お題データ。[こたえ, よみ, チップ, ヒント3つ, へぇ, 学年, 絵のキー] */',
      ['PCODE','PREF','FLAG','ART','KOKUGO','RIKA','REKISHI','EIGO','MATH_TIPS','LV1_PREF','LV1_FLAG','HINT2'])
write('cross.ts','// @ts-nocheck\n/* 生成物: クロスワードの盤面と 50音キーボード */',
      ['CROSS','KBD','DAKU','HANDAKU','SMALL'])
write('texts.ts','// @ts-nocheck\n/* 生成物: 画面の文言・アイコン・ランクの しきい値 */',
      ['CONFIG','MODE_NAME','MODE_SUB','MODE_TAG','MODE_LABEL','GROUPS','HOW_LEDE','STEPS_MISS','STEPS_HINT','GEO_TIPS_NAME','GEO_TIPS','STEPS_GEO','STEPS_NUM','STEPS_CROSS','STEPS_BATTLE','STEPS_MATH','RANKS','RANK_PACE','RANK_MSG','NC_TIPS','FXCOL'])
