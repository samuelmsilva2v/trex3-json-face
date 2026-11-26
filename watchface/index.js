/**
 * status.json — mostrador estilo editor de código para Amazfit T-Rex 3 (480x480, Zepp OS)
 *
 *      17:23                       (hora solta, fora do JSON)
 *   1  //PRIVATE INFO do not share (editável: 7 comentários)
 *   2  {
 *   3    "date": "qua 18/11",
 *   4    "steps": 8432,            (linhas 4 a 7 editáveis: steps, heart_rate, kcal,
 *   5    "heart_rate": 72,          battery, distance, spo2, stress, pai, stand, fat_burn)
 *   6    "kcal": 412,
 *   7    "battery": "78%"
 *   8  }
 *
 * Edição: segure o mostrador → Editar → toque na linha e gire a coroa.
 */
import * as zui from '@zos/ui'
import { createWidget, widget, align, prop, text_style } from '@zos/ui'
import { Time, Step, HeartRate, Calorie, Battery, Distance, BloodOxygen, Stress, Pai, Stand, FatBurning } from '@zos/sensor'
import { connectStatus } from '@zos/ble'

// ---------- tema ----------
const C = {
  key: 0x85b7eb, // chaves
  str: 0x97c459, // strings
  num: 0xef9f27, // números
  nul: 0xed93b1, // null
  comment: 0x6b6a65, // // comentário (cinza)
  time: 0xd3d1c7, // hora
  punct: 0x888780, // { } : ,
  gutter: 0x444441, // números de linha
  muted: 0x5f5e5a, // barra de status
  accent: 0x5dcaa5, // BT conectado
  off: 0x444441 // BT desconectado
}

// ---------- tipografia / grade ----------
// JetBrains Mono: cada caractere tem avanço de 600/1000 em, então dá pra
// posicionar cada "token" colorido por coluna, como num editor.
const FONT = 'fonts/JetBrainsMono-Subset.ttf'
const ADV = 0.6

const CODE_X = 100
const GUTTER_X = 50
const GUTTER_W = 40
const GUTTER_SIZE = 18

const TOP = 40
const TIME_SIZE = 64
const TIME_H = 80
const SIZE = 25
const LINE_H = 37
const COMMENT_SIZE = 20 // menor que o resto pra caber na largura da tela

// ---------- comentários (opções do modo de edição) ----------
// tipos próprios precisam ficar acima de 0x186a0 (100000)
const COMMENTS = [
  '//PRIVATE INFO do not share',
  '//TODO: dormir mais',
  '//eslint-disable-line',
  '//FIXME: steps < goal',
  '//do not commit this file',
  '//generated, do not edit',
  '//it works on my wrist'
]
const COMMENT_TYPE_BASE = 100001

// ---------- dados (opções das linhas editáveis) ----------
// edit: nome em edit_type; value(sensor) → [texto, cor]
const nullable = (v) => (v > 0 ? [String(v), C.num] : ['null', C.nul])
const FIELDS = {
  steps: { edit: 'STEP', make: () => new Step(), value: (s) => [String(s.getCurrent()), C.num] },
  heart_rate: {
    edit: 'HEART',
    make: () => new HeartRate(),
    on: 'onLastChange',
    off: 'offLastChange',
    value: (s) => nullable(s.getLast())
  },
  kcal: { edit: 'CAL', make: () => new Calorie(), value: (s) => [String(Math.round(s.getCurrent())), C.num] },
  battery: { edit: 'BATTERY', make: () => new Battery(), value: (s) => [`"${s.getCurrent()}%"`, C.str] },
  distance: { edit: 'DISTANCE', make: () => new Distance(), value: (s) => [`"${(s.getCurrent() / 1000).toFixed(2)}km"`, C.str] },
  spo2: { edit: 'SPO2', make: () => new BloodOxygen(), value: (s) => nullable((s.getCurrent() || {}).value) },
  stress: { edit: 'STRESS', make: () => new Stress(), value: (s) => nullable((s.getCurrent() || {}).value) },
  pai: { edit: 'PAI', make: () => new Pai(), value: (s) => [String(s.getTotal()), C.num] },
  stand: { edit: 'STAND', make: () => new Stand(), value: (s) => [`"${s.getCurrent()}/${s.getTarget()}"`, C.str] },
  fat_burn: { edit: 'FAT_BURN', make: () => new FatBurning(), value: (s) => [String(s.getCurrent()), C.num] }
}
const SLOT_DEFAULTS = ['steps', 'heart_rate', 'kcal', 'battery']

// ---------- API de edição ----------
// A doc só descreve a edição na API antiga (hmUI global); usa @zos/ui quando tiver e cai pra hmUI.
// Os números são os do hmUI (WATCHFACE_EDIT_GROUP = 65539, prop.CURRENT_TYPE = 51).
const LEGACY = typeof hmUI !== 'undefined' ? hmUI : {}
const EDIT_TYPE = zui.edit_type || LEGACY.edit_type || null
const EDIT_GROUP = (widget && widget.WATCHFACE_EDIT_GROUP) || (LEGACY.widget && LEGACY.widget.WATCHFACE_EDIT_GROUP) || 65539
const CURRENT_TYPE = (prop && prop.CURRENT_TYPE) || (LEGACY.prop && LEGACY.prop.CURRENT_TYPE) || 51
const EDIT = 'edit/'
const TIP = { x: 165, y: 50 } // etiqueta com o nome da opção aparece sobre a hora

/** Cria um grupo editável; null se o sistema não suportar (o mostrador segue com o padrão). */
function editGroup(opts) {
  const all = {
    x: CODE_X - 8,
    w: 340,
    h: LINE_H,
    select_image: EDIT + 'select.png',
    un_select_image: EDIT + 'unselect.png',
    tips_BG: EDIT + 'tips.png',
    tips_x: TIP.x - (CODE_X - 8),
    tips_y: TIP.y - opts.y,
    tips_width: 150,
    count: opts.optional_types.length,
    ...opts
  }
  try {
    return createWidget(EDIT_GROUP, all)
  } catch (e) {
    try {
      return LEGACY.createWidget(EDIT_GROUP, all)
    } catch (e2) {
      return null
    }
  }
}

function currentType(group, fallback) {
  try {
    const v = group && group.getProperty(CURRENT_TYPE)
    return typeof v === 'number' ? v : fallback // 0 é um tipo válido (bateria no hmUI)
  } catch (e) {
    return fallback
  }
}

const DAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] // Time.getDay(): 1 = segunda ... 7 = domingo
const pad = (n) => String(n).padStart(2, '0')

function text(props) {
  return createWidget(widget.TEXT, {
    font: FONT,
    align_h: align.LEFT,
    align_v: align.CENTER_V,
    text_style: text_style.NONE,
    ...props
  })
}

/** Uma linha de "código": lista de tokens {text, color} lado a lado, em colunas monoespaçadas. */
class CodeLine {
  constructor(n, y, h, size, tokens) {
    this.y = y
    this.h = h
    this.size = size
    this.tokens = tokens

    text({
      x: GUTTER_X,
      y,
      w: GUTTER_W,
      h,
      text: String(n),
      color: C.gutter,
      text_size: GUTTER_SIZE,
      align_h: align.RIGHT
    })

    this.widgets = tokens.map((t) =>
      text({ x: CODE_X, y, w: 10, h, text: t.text, color: t.color, text_size: size })
    )
    this.layout()
  }

  set(i, value, color) {
    const t = this.tokens[i]
    if (t.text === value && (color === undefined || t.color === color)) return
    t.text = value
    if (color !== undefined) t.color = color
    this.layout()
  }

  layout() {
    const cw = this.size * ADV
    let col = 0
    this.tokens.forEach((t, i) => {
      this.widgets[i].setProperty(prop.MORE, {
        x: Math.round(CODE_X + col * cw),
        y: this.y,
        w: Math.ceil(t.text.length * cw) + this.size, // folga pra nunca entrar em modo de rolagem
        h: this.h,
        text: t.text,
        color: t.color
      })
      col += t.text.length
    })
  }
}

/** Linha `  "chave": valor,` */
function kv(n, y, key, value, color, comma = true) {
  const tokens = [
    { text: `  "${key}"`, color: C.key },
    { text: ': ', color: C.punct },
    { text: value, color },
    { text: comma ? ',' : '', color: C.punct }
  ]
  return new CodeLine(n, y, LINE_H, SIZE, tokens)
}

WatchFace({
  build() {
    this.time = new Time()
    this.sensors = {} // um sensor por tipo de dado em uso
    this.subs = [] // [sensor, nome do off, callback] pra soltar no onDestroy

    // ---------- hora ----------
    let y = TOP
    this.tTime = text({ x: 40, y, w: 400, h: TIME_H, text: '00:00', color: C.time, text_size: TIME_SIZE, align_h: align.CENTER_H })
    y += TIME_H

    // ---------- comentário (editável) ----------
    const cGroup = editGroup({
      edit_id: 110,
      y,
      default_type: COMMENT_TYPE_BASE,
      optional_types: COMMENTS.map((c, i) => ({
        type: COMMENT_TYPE_BASE + i,
        preview: `${EDIT}comment${i}.png`,
        title_en: c,
        title_sc: c,
        title_tc: c
      }))
    })
    const ci = currentType(cGroup, COMMENT_TYPE_BASE) - COMMENT_TYPE_BASE
    new CodeLine(1, y, LINE_H, COMMENT_SIZE, [{ text: COMMENTS[ci] || COMMENTS[0], color: C.comment }])
    y += LINE_H

    new CodeLine(2, y, LINE_H, SIZE, [{ text: '{', color: C.punct }])
    y += LINE_H
    this.lDate = kv(3, y, 'date', '""', C.str)
    y += LINE_H

    // ---------- linhas de dados (editáveis) ----------
    const names = Object.keys(FIELDS)
    this.slots = SLOT_DEFAULTS.map((def, i) => {
      let name = def
      if (EDIT_TYPE) {
        const group = editGroup({
          edit_id: 101 + i,
          y,
          default_type: EDIT_TYPE[FIELDS[def].edit],
          optional_types: names
            .filter((n) => EDIT_TYPE[FIELDS[n].edit] !== undefined)
            .map((n) => ({ type: EDIT_TYPE[FIELDS[n].edit], preview: `${EDIT}${n}.png` }))
        })
        const t = currentType(group, EDIT_TYPE[FIELDS[def].edit])
        name = names.find((n) => EDIT_TYPE[FIELDS[n].edit] === t) || def
      }
      const line = kv(4 + i, y, name, 'null', C.nul, i < SLOT_DEFAULTS.length - 1)
      y += LINE_H
      return { name, line }
    })
    new CodeLine(4 + SLOT_DEFAULTS.length, y, LINE_H, SIZE, [{ text: '}', color: C.punct }])

    // ---------- barra de status ----------
    const stSize = 16
    const stCw = stSize * ADV
    const stRest = ' BT  ·  JSON  ·  Ln 8'
    const stX = Math.round(240 - ((1 + stRest.length) * stCw) / 2)
    const stY = 420
    this.btDot = text({ x: stX, y: stY, w: 20, h: 24, text: '●', color: C.off, text_size: stSize })
    text({
      x: stX + Math.round(stCw),
      y: stY,
      w: Math.ceil(stRest.length * stCw) + stSize,
      h: 24,
      text: stRest,
      color: C.muted,
      text_size: stSize
    })

    // ---------- atualização ----------
    this.updateTime = () => {
      const t = this.time
      this.tTime.setProperty(prop.MORE, { text: `${pad(t.getHours())}:${pad(t.getMinutes())}` })
      this.lDate.set(2, `"${DAYS[t.getDay() - 1] || ''} ${pad(t.getDate())}/${pad(t.getMonth())}"`)
      let bt = false
      try {
        bt = !!connectStatus()
      } catch (e) {}
      this.btDot.setProperty(prop.MORE, { color: bt ? C.accent : C.off })
    }

    this.slots.forEach((slot) => {
      const f = FIELDS[slot.name]
      if (!(slot.name in this.sensors)) {
        try {
          this.sensors[slot.name] = f.make()
        } catch (e) {
          this.sensors[slot.name] = null // sensor indisponível: linha fica null
        }
      }
      const s = this.sensors[slot.name]
      slot.update = () => {
        let v = ['null', C.nul]
        try {
          if (s) v = f.value(s)
        } catch (e) {}
        slot.line.set(2, v[0], v[1])
      }
      const on = f.on || 'onChange'
      if (s && typeof s[on] === 'function') {
        s[on](slot.update)
        this.subs.push([s, f.off || 'offChange', slot.update])
      }
    })

    // alguns sensores (PAI) não têm evento: tudo é relido a cada minuto e ao acender a tela
    this.updateAll = () => {
      this.updateTime()
      this.slots.forEach((s) => s.update())
    }
    this.time.onPerMinute(this.updateAll)
    createWidget(widget.WIDGET_DELEGATE, { resume_call: this.updateAll })

    this.updateAll()
  },

  onDestroy() {
    ;(this.subs || []).forEach(([s, off, cb]) => {
      try {
        s[off](cb)
      } catch (e) {}
    })
  }
})
