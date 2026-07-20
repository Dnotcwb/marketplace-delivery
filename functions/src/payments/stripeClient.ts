import Stripe from 'stripe'

/**
 * Tipos do Stripe.
 *
 * Nesta versão do SDK, com `moduleResolution: node` (CommonJS), o tipo da
 * instância é `Stripe.Stripe` e os tipos de recurso (PaymentIntent, Event…)
 * não ficam acessíveis como `Stripe.PaymentIntent`. Por isso derivamos os
 * tipos a partir dos métodos da instância — compila e dá tipagem completa.
 */
export type StripeClient = Stripe.Stripe
export type StripeEvent = ReturnType<StripeClient['webhooks']['constructEvent']>
export type StripePaymentIntent = Awaited<ReturnType<StripeClient['paymentIntents']['retrieve']>>
export type StripeAccount = Awaited<ReturnType<StripeClient['accounts']['retrieve']>>

/**
 * Cria uma instância do Stripe usando a secret key disponível em runtime.
 * A secret é injetada via `secrets: ['STRIPE_SECRET_KEY']` em cada function.
 * Lançamos um erro claro se não estiver configurada.
 */
export function getStripe(): StripeClient {
  const key = process.env['STRIPE_SECRET_KEY']
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY não configurada')
  }
  // apiVersion omitida de propósito: usa a versão fixada pelo SDK instalado.
  return new Stripe(key)
}

/** URLs dos apps (usadas em redirects de checkout e onboarding). */
export const CONSUMIDOR_URL =
  process.env['CONSUMIDOR_APP_URL'] ?? 'https://brotadigital.com.br'

export const PRODUTOR_URL =
  process.env['PRODUTOR_APP_URL'] ?? 'https://produtor.brotadigital.com.br'
