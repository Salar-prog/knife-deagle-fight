export default class ControlsOverlay
{
    constructor()
    {
        this._used      = new Set()
        this._required  = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'KeyF'])
        this._keyEls    = {}
        this._el        = null
        this._dismissed = false
        this._timeout   = null
        this._onDown    = null
        this._onUp      = null
    }

    show()
    {
        if(this._dismissed) return
        this._build()
        this._listen()
        // Auto-dismiss after 12s even if user hasn't pressed everything
        this._timeout = window.setTimeout(() => this._dismiss(), 12000)
    }

    _build()
    {
        this._el = document.createElement('div')
        Object.assign(this._el.style, {
            position:       'fixed',
            bottom:         '24px',
            left:           '50%',
            transform:      'translateX(-50%)',
            display:        'flex',
            alignItems:     'center',
            gap:            '20px',
            background:     'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
            border:         '1px solid rgba(255,255,255,0.08)',
            borderRadius:   '14px',
            padding:        '12px 18px',
            zIndex:         '400',
            opacity:        '1',
            transition:     'opacity 0.6s',
            fontFamily:     'monospace',
            userSelect:     'none',
            pointerEvents:  'none',
        })

        // W A S D chip + desc (same row style as the extras column)
        const wasd = document.createElement('div')
        wasd.style.cssText = 'display:flex;align-items:center;gap:8px;'

        const wasdKey = this._makeKey('W A S D')
        wasdKey.style.width         = 'auto'
        wasdKey.style.padding       = '0 10px'
        wasdKey.style.minWidth      = '28px'
        wasdKey.style.letterSpacing = '2px'

        const wasdDesc = document.createElement('span')
        wasdDesc.textContent   = 'move'
        wasdDesc.style.cssText = 'color:rgba(255,255,255,0.3);font-size:10px;text-transform:uppercase;letter-spacing:1px;'

        wasd.appendChild(wasdKey)
        wasd.appendChild(wasdDesc)
        ;['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach(code => { this._keyEls[code] = wasdKey })

        // Divider
        const sep = document.createElement('div')
        sep.style.cssText = 'width:1px;height:48px;background:rgba(255,255,255,0.08);flex-shrink:0;'

        // Shift / Space / F / 1-2 / Q+wheel column — WASD MOVE · SHIFT SPRINT · SPACE JUMP · F FIRE · 1/2 WEAPON · Q/WHEEL SWAP
        const extras = document.createElement('div')
        extras.style.cssText = 'display:flex;flex-direction:column;gap:5px;'

        ;[
            { code: 'ShiftLeft', label: 'Shift',    desc: 'sprint' },
            { code: 'Space',     label: 'Space',    desc: 'jump'   },
            { code: 'KeyF',      label: 'F',        desc: 'fire'   },
            { code: 'Digit1',    label: '1 / 2',    desc: 'weapon' },
            { code: 'KeyQ',      label: 'Q / wheel', desc: 'swap'  },
        ].forEach(({ code, label, desc }) =>
        {
            const row = document.createElement('div')
            row.style.cssText = 'display:flex;align-items:center;gap:8px;'

            const k = this._makeKey(label)
            k.style.width      = 'auto'
            k.style.padding    = '0 7px'
            k.style.minWidth   = '28px'

            const d = document.createElement('span')
            d.textContent      = desc
            d.style.cssText    = 'color:rgba(255,255,255,0.3);font-size:10px;text-transform:uppercase;letter-spacing:1px;'

            row.appendChild(k)
            row.appendChild(d)
            extras.appendChild(row)
            if(code) this._keyEls[code] = k
        })

        this._el.appendChild(wasd)
        this._el.appendChild(sep)
        this._el.appendChild(extras)
        document.body.appendChild(this._el)
    }

    _makeKey(label)
    {
        const el = document.createElement('div')
        el.textContent = label
        Object.assign(el.style, {
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            height:         '28px',
            fontSize:       '10px',
            fontWeight:     'bold',
            color:          'rgba(255,255,255,0.25)',
            background:     'rgba(255,255,255,0.04)',
            border:         '1px solid rgba(255,255,255,0.12)',
            borderRadius:   '5px',
            transition:     'background 0.12s, color 0.12s, border-color 0.12s',
        })
        return el
    }

    // Map variant codes to the canonical key stored in _keyEls
    _canonical(code)
    {
        const map = {
            ShiftRight:  'ShiftLeft',
            Digit2:      'Digit1',
            ArrowUp:     'KeyW',
            ArrowDown:   'KeyS',
            ArrowLeft:   'KeyA',
            ArrowRight:  'KeyD',
        }
        return map[code] || code
    }

    _setActive(el, active)
    {
        if(!el) return
        el.style.background   = active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.04)'
        el.style.color        = active ? '#fff'                    : 'rgba(255,255,255,0.25)'
        el.style.borderColor  = active ? 'rgba(255,255,255,0.5)'  : 'rgba(255,255,255,0.12)'
    }

    _setUsed(el)
    {
        if(!el) return
        el.style.background  = 'rgba(255,255,255,0.08)'
        el.style.color       = 'rgba(255,255,255,0.55)'
        el.style.borderColor = 'rgba(255,255,255,0.25)'
    }

    _listen()
    {
        this._onDown = (e) =>
        {
            const canon = this._canonical(e.code)
            const el    = this._keyEls[canon]
            this._setActive(el, true)

            if(this._required.has(canon))
            {
                this._used.add(canon)
                if(this._used.size >= this._required.size)
                {
                    window.setTimeout(() => this._dismiss(), 800)
                }
            }
        }

        this._onUp = (e) =>
        {
            const canon = this._canonical(e.code)
            const el    = this._keyEls[canon]
            if(this._used.has(canon)) this._setUsed(el)
            else                      this._setActive(el, false)
        }

        document.addEventListener('keydown', this._onDown)
        document.addEventListener('keyup',   this._onUp)
    }

    _dismiss()
    {
        if(this._dismissed) return
        this._dismissed = true
        clearTimeout(this._timeout)
        if(this._onDown) document.removeEventListener('keydown', this._onDown)
        if(this._onUp)   document.removeEventListener('keyup',   this._onUp)
        if(this._el)
        {
            this._el.style.opacity = '0'
            window.setTimeout(() => { this._el?.remove(); this._el = null }, 700)
        }
    }
}
