/**
 * Paleta oficial — Ambiente Livre
 *
 * Extraída do logotipo (Logo_Separado.png):
 *  - Mãos/tronco (mais escuro): #112520
 *  - Galhos escuros:            #1C3C2E
 *  - Círculos médios:           #4A9080
 *  - Círculos claros:           #6BBBA9
 *
 * Todos os apps usam a MESMA escala. A diferença visual entre apps
 * vem de quais tokens são aplicados em cada contexto (sidebar bg,
 * primary CTA, etc.), não dos valores em si.
 */

export const brand = {
  50:  '#EEF8F4',
  100: '#CCE8DF',
  200: '#9CCFC0',
  300: '#6BBBA9',
  400: '#4FA593',
  500: '#4A9080',  // teal principal (círculos do logotipo)
  600: '#3A7267',
  700: '#2B5649',  // verde escuro (galhos)
  800: '#1C3C2E',  // muito escuro (tronco)
  900: '#112520',  // escuro máximo (mãos)
  950: '#08130F',
} as const

export const semantic = {
  success: '#16A34A',
  warning: '#D97706',
  error:   '#DC2626',
  info:    '#2563EB',
} as const

export const orderStatus = {
  pending:    '#D97706',
  confirmed:  '#2563EB',
  preparing:  '#7C3AED',
  ready:      '#0891B2',
  onDelivery: '#16A34A',
  delivered:  '#15803D',
  cancelled:  '#DC2626',
} as const
