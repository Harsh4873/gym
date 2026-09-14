"""Build scalable, original position diagrams for the supplemental stretch guides."""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INK = '#29463e'
ACCENT = '#dc704e'
parts = []

def line(points, color=INK, width=13):
    parts.append(f'<polyline points="{points}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>')

def head(x, y):
    parts.append(f'<circle cx="{x}" cy="{y}" r="17" fill="#e5b996" stroke="{INK}" stroke-width="3"/>')

def torso(points):
    line(points, INK, 24)

def focus(x,y):
    parts.append(f'<circle cx="{x}" cy="{y}" r="24" fill="{ACCENT}" opacity=".17"/>')

def arrow(points):
    parts.append(f'<polyline points="{points}" fill="none" stroke="{ACCENT}" stroke-width="3" stroke-linecap="round" marker-end="url(#arrow)"/>')

def chair(x=200,y=185,w=110):
    line(f'{x},{y-65} {x},{y} {x+w},{y}', '#9cae9e',7)
    line(f'{x+10},{y} {x+10},266', '#9cae9e',7)
    line(f'{x+w-10},{y} {x+w-10},266', '#9cae9e',7)

def standing():
    head(233, 60)
    torso('235,89 239,158')
    line('230,166 215,213 210,263 193,263')
    line('248,166 270,213 275,263 292,263')

def seated():
    chair(190,188,120)
    head(228,72)
    torso('235,101 247,179')


def draw(id):
    global parts
    parts=[]
    view='Side view'
    if id == 'doorway':
        view='Angled view'
        line('160,38 160,264','#9cae9e',9)
        standing();line('220,100 163,119 163,69');line('250,108 282,152 282,181')
        focus(222,111);arrow('264,101 298,94 311,108')
    elif id == 'butterfly':
        view='Front view';head(240, 70);torso('240,101 240,182')
        line('230,191 153,227 235,252',ACCENT);line('250,191 327,227 245,252',ACCENT)
        line('222,112 199,177 230,244');line('258,112 281,177 250,244')
        arrow('164,185 150,205');arrow('316,185 330,205')
    elif id == 'standing-quad':
        line('345,78 345,267','#9cae9e',7)
        head(244,59);torso('243,89 242,157');line('250,170 272,215 278,263 295,263')
        line('232,166 224,217 181,183',ACCENT);line('258,100 300,107 345,99');line('228,106 204,144 184,181')
        focus(229,192);arrow('204,196 220,178')
    elif id == 'couch':
        chair(110,161, 80)
        head(256,73);torso('253,103 244,170')
        line('236,178 219,245 185,167',ACCENT);line('252,177 310,187 324,263 346,263')
        line('266,113 285,151 307,174');line('242,114 260,149 286,173')
        line('199,255 246,255','#a8c8a8',9);arrow('281,119 281,80')
    elif id in ['seated-figure-four','toe-extension']:
        view='Angled view';seated()
        line('252,184 307,201 309,263 330,263')
        line('235,183 184,207 298,206',ACCENT)
        line('221,110 211,160 264,203');line('248,107 272,161 298,204')
        if id=='toe-extension':
            focus(294,205);arrow('322,218 305,192')
        else: focus(239,183);arrow('283,113 302,146')
    elif id=='standing-figure-four':
        view='Angled view';chair(325,185, 70)
        head(230, 90);torso('225,120 195,180')
        line('208,185 270,213 256,263 279,263')
        line('195,185 164,212 266,211',ACCENT)
        line('240,124 280,167 330,167');line('211,126 265,168 325,168');focus(200,183)
    elif id=='chair-hamstring':
        chair(156,184,115);head(257,91);torso('245,118 214,178')
        line('220,184 273,194 279,263 301,263');line('218,189 302,220 383,260 383,238',ACCENT)
        line('257,128 269,161 274,187');line('233,130 239,165 264,191');arrow('284,116 310,142')
    elif id=='half-split':
        head(248,108);torso('227,131 183,190')
        line('180,195 171,251 115,257');line('192,196 276,224 361,258 361,237',ACCENT)
        line('234,144 267,201 273,255');line('216,144 225,210 222,253');arrow('162,168 131,177')
    elif id=='adductor-rockback':
        view='Angled view';head(262,111);torso('244,136 199,183')
        line('196,192 187,242 139,257');line('207,193 290,226 372,257',ACCENT)
        line('256,146 291,194 309,252');line('235,150 245,199 247,255');arrow('187,151 154,166')
    elif id=='frog':
        view='Top view';head(240,69);torso('240,100 240,166')
        line('228,174 151,181 152,245',ACCENT);line('252,174 329,181 328,245',ACCENT)
        line('222,107 189,92 186,48');line('258,107 291,92 294,48')
        arrow('240,196 240,231')
    elif id=='ninety-ninety-front':
        view='Angled view';head(236,88);torso('237,117 262,182')
        line('256,190 171,221 229,261',ACCENT);line('271,191 341,202 352,263')
        line('224,128 195,184 167,246');line('253,128 264,188 289,255');arrow('203,118 183,147')
    elif id=='ninety-ninety-switch':
        view='Front view';head(240,73);torso('240,104 240,181')
        line('229,188 161,203 200,258',ACCENT);line('251,188 309,204 339,258',ACCENT)
        line('224,115 186,172 167,248');line('256,115 294,172 321,248');arrow('183,165 235,146 287,165')
    elif id=='supported-pigeon':
        view='Angled view';head(229,94);torso('235,122 265,199')
        parts.append('<rect x="246" y="221" width="58" height="32" rx="12" fill="#bad0ae"/>')
        line('254,204 174,232 246,251',ACCENT);line('277,206 346,232 416,261')
        line('219,134 197,193 197,255');line('248,136 294,195 316,256');focus(258,210)
    elif id=='kneeling-lat':
        chair(322,147,76);head(267,169);torso('241,170 169,196')
        line('168,204 191,250 126,256');line('181,205 207,253 155,260')
        line('236,159 287,145 342,146',ACCENT);line('250,177 303,157 356,146',ACCENT);arrow('147,188 115,201')
    elif id=='puppy':
        head(318,236);torso('289,216 210,161')
        line('202,168 200,252 135,259');line('221,170 225,254 166,260')
        line('286,210 350,241 404,256',ACCENT);line('287,223 346,255 383,261',ACCENT);arrow('275,188 289,209')
    elif id=='thread-the-needle':
        view='Angled view';head(293,239);torso('270,217 209,162')
        line('201,171 197,250 137,259');line('222,173 236,249 183,258')
        line('271,213 304,185 350,245');line('266,226 223,248 299,260',ACCENT);arrow('228,272 306,272')
    elif id=='levator':
        view='Angled view';chair(186,199,119)
        head(265,93);line('249,110 243,123');torso('241,126 241,191')
        line('231,199 218,227 217,264 200,264');line('252,199 270,227 277,264 298,264')
        line('224,135 205,164 196,190');line('257,135 278,168 277,194');focus(245,116);arrow('290,86 293,116')
    elif id in ['wrist-extensor','wrist-flexor']:
        head(168,62);torso('170,91 179,164');line('172,177 158,220 159,264 141,264');line('189,177 211,221 222,264 242,264')
        line('184,102 259,115 333,116',ACCENT);line('333,116 345,148')
        line('160,112 243,150 337,145');focus(332,119);arrow('362,132 352,156')
        view='Palm down' if id=='wrist-extensor' else 'Palm up'
        parts.append(f'<text x="264" y="92" fill="{INK}" font-size="13">{view}</text>')
    elif id=='wall-biceps':
        line('141,68 141,266','#9cae9e',9);standing()
        line('220,104 181,131 141,143',ACCENT);line('250,106 278,154 280,189');arrow('270,105 305,118')
    elif id=='knee-to-wall':
        line('354,49 354,267','#9cae9e',9);head(279,74);torso('270,105 236,177')
        line('242,185 331,204 303,263 340,263',ACCENT);line('228,184 185,226 150,263 175,263')
        line('277,114 315,131 351,116');line('259,118 298,157 351,146');arrow('324,184 345,184')
    elif id=='side-reach-child':
        view='Top view';head(201,99);torso('221,118 243,179')
        line('231,186 191,231 231,245');line('252,186 293,231 250,245')
        line('210,124 162,90 136,48',ACCENT);line('234,113 193,73 172,44',ACCENT)
        arrow('269,80 224,53')
    elif id=='wall-thoracic':
        view='Angled view';line('153,50 153,264','#9cae9e',9);standing()
        line('221,104 190,105 154,100');line('251,104 299,110 350,97',ACCENT);arrow('285,81 328,64 358, 80')
    else: raise ValueError(id)
    return view, ''.join(parts)

if __name__ == '__main__':
    output=ROOT/'public/exercises/positions';output.mkdir(parents=True,exist_ok=True)
    for row in json.loads((ROOT/'src/stretchAdditions.json').read_text()):
        view, artwork=draw(row['pose'])
        svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" role="img" aria-labelledby="title desc">
<title id="title">{html.escape(row['name'])}</title><desc id="desc">{html.escape(row['cue'])}. {view} position diagram.</desc>
<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="{ACCENT}" stroke-width="1.5"/></marker></defs>
<rect width="480" height="320" rx="16" fill="#f0f2e9"/>
<text x="22" y="29" fill="#596b60" font-family="sans-serif" font-size="12" letter-spacing="1">{view.upper()}</text>
<path d="M65 272H425" stroke="#ccd6c7" stroke-width="2"/>{artwork}
<text x="240" y="301" fill="#29463e" font-family="sans-serif" font-size="13" text-anchor="middle">{html.escape(row['cue'])}</text></svg>'''
        (output/(row['id']+'.svg')).write_text(svg)
    print(f'Created {len(list(output.glob("*.svg")))} position diagrams')
