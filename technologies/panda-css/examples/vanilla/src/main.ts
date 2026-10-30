import { css } from '../styled-system/css'
import { hstack } from '../styled-system/patterns'
import './index.css'

// Every call is static, so with `transform: true` each becomes a string literal at build time.
const card = css({ p: '6', bg: 'teal.100', borderRadius: 'xl', _hover: { bg: 'teal.200' } })
const row = hstack({ gap: '4' })

const el = document.createElement('div')
el.dataset.testid = 'page'
el.className = row
el.innerHTML = `<section data-testid="card" class="${card}">static</section>`
document.body.append(el)
