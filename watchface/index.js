/**
 * status.json — mostrador estilo editor de código para Amazfit T-Rex 3 (480x480, Zepp OS)
 *
 *   1  "17:23"
 *   2  {
 *   3    "date": "qua 18/11",
 *   4    "steps": 8432,
 *   5    "heart_rate": 72,
 *   6    "kcal": 412,
 *   7    "distance": "5.21km",
 *   8    "sleep": "7h32m"     (null sem registro de sono)
 *   9  }
 */
import { createWidget, widget, align, prop, text_style } from '@zos/ui'
import { Time, Step, HeartRate, Calorie, Distance, Sleep } from '@zos/sensor'
import { connectStatus } from '@zos/ble'

// ---------- tema ----------
const C = {
  key: 0x85b7eb, // chaves
  str: 0x97c459, // strings
  num: 0xef9f27, // números
  nul: 0xed93b1, // null
  punct: 0x888780, // { } : ,
  gutter: 0x444441, // números de linha
  muted: 0x5f5e5a, // barra de status
  accent: 0x5dcaa5, // aba ativa / BT conectado
  tabBg: 0x1a1a1a,
  tabText: 0xd3d1c7,
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

const TOP = 62
const TIME_SIZE = 37
const TIME_H = 50
const SIZE = 25
const LINE_H = 38

const DAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] // Time.getDay(): 1 = segunda ... 7 = domingo
const pad = (n) => String(n).padStart(2, '0')
// minutos de sono → "7h32m"; null quando o relógio não registrou sono
const sleepText = (min) => (min > 0 ? `${Math.floor(min / 60)}h${pad(min % 60)}m` : null)
const sleepMinutes = (s) => {
  try {
    return (s.getInfo() || {}).totalTime || 0
  } catch (e) {
    return 0 // sem permissão ou sem dado
  }
}

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
    // ---------- sensores ----------
    this.time = new Time()
    this.step = new Step()
    this.hr = new HeartRate()
    this.cal = new Calorie()
    this.dist = new Distance()
    this.sleep = new Sleep()

    // ---------- aba "status.json" ----------
    const tabSize = 17
    const tabCw = tabSize * ADV
    const tabLabel = ' status.json'
    const tabPad = 13
    const tabW = Math.round((2 + tabLabel.length) * tabCw) + tabPad * 2
    const closeW = 24
    const tabX = Math.round(240 - (tabW + 6 + closeW) / 2)
    const tabY = 26
    const tabH = 30

    createWidget(widget.FILL_RECT, { x: tabX, y: tabY, w: tabW, h: tabH, color: C.tabBg })
    createWidget(widget.FILL_RECT, { x: tabX, y: tabY, w: tabW, h: 3, color: C.accent })
    text({ x: tabX + tabPad, y: tabY + 2, w: 30, h: tabH, text: '{}', color: C.num, text_size: tabSize })
    text({
      x: tabX + tabPad + Math.round(2 * tabCw),
      y: tabY + 2,
      w: Math.ceil(tabLabel.length * tabCw) + tabSize,
      h: tabH,
      text: tabLabel,
      color: C.tabText,
      text_size: tabSize
    })
    text({ x: tabX + tabW + 6, y: tabY + 2, w: closeW, h: tabH, text: '×', color: C.gutter, text_size: tabSize, align_h: align.CENTER_H })

    // ---------- código ----------
    let y = TOP
    this.lTime = new CodeLine(1, y, TIME_H, TIME_SIZE, [{ text: '"00:00"', color: C.str }])
    y += TIME_H
    new CodeLine(2, y, LINE_H, SIZE, [{ text: '{', color: C.punct }])
    y += LINE_H
    this.lDate = kv(3, y, 'date', '""', C.str)
    y += LINE_H
    this.lSteps = kv(4, y, 'steps', '0', C.num)
    y += LINE_H
    this.lHr = kv(5, y, 'heart_rate', 'null', C.nul)
    y += LINE_H
    this.lKcal = kv(6, y, 'kcal', '0', C.num)
    y += LINE_H
    this.lDist = kv(7, y, 'distance', '"0.00km"', C.str)
    y += LINE_H
    this.lSleep = kv(8, y, 'sleep', 'null', C.nul, false)
    y += LINE_H
    new CodeLine(9, y, LINE_H, SIZE, [{ text: '}', color: C.punct }])

    // ---------- barra de status ----------
    const stSize = 16
    const stCw = stSize * ADV
    const stRest = ' BT  ·  JSON  ·  Ln 9'
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
      this.lTime.set(0, `"${pad(t.getHours())}:${pad(t.getMinutes())}"`)
      this.lDate.set(2, `"${DAYS[t.getDay() - 1] || ''} ${pad(t.getDate())}/${pad(t.getMonth())}"`)
      let bt = false
      try {
        bt = !!connectStatus()
      } catch (e) {}
      this.btDot.setProperty(prop.MORE, { color: bt ? C.accent : C.off })
    }
    this.updateSteps = () => this.lSteps.set(2, String(this.step.getCurrent()))
    this.updateHr = () => {
      const v = this.hr.getLast()
      if (v > 0) this.lHr.set(2, String(v), C.num)
      else this.lHr.set(2, 'null', C.nul)
    }
    this.updateKcal = () => this.lKcal.set(2, String(Math.round(this.cal.getCurrent())))
    this.updateDist = () => {
      const meters = this.dist.getCurrent() // em metros
      this.lDist.set(2, `"${(meters / 1000).toFixed(2)}km"`)
    }
    this.updateSleep = () => {
      const s = sleepText(sleepMinutes(this.sleep))
      if (s) this.lSleep.set(2, `"${s}"`, C.str)
      else this.lSleep.set(2, 'null', C.nul)
    }
    this.updateAll = () => {
      this.updateTime()
      this.updateSteps()
      this.updateHr()
      this.updateKcal()
      this.updateDist()
      this.updateSleep()
    }

    // sono não tem evento de mudança (o sistema recalcula a cada ~30 min): lê a cada minuto
    this.time.onPerMinute(() => {
      this.updateTime()
      this.updateSleep()
    })
    this.step.onChange(this.updateSteps)
    this.hr.onLastChange(this.updateHr)
    this.cal.onChange(this.updateKcal)
    this.dist.onChange(this.updateDist)

    // ao acordar a tela, garante tudo atualizado
    createWidget(widget.WIDGET_DELEGATE, { resume_call: this.updateAll })

    this.updateAll()
  },

  onDestroy() {
    this.step && this.step.offChange(this.updateSteps)
    this.hr && this.hr.offLastChange(this.updateHr)
    this.cal && this.cal.offChange(this.updateKcal)
    this.dist && this.dist.offChange(this.updateDist)
  }
})
