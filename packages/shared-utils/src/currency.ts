export function formatCurrency(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(centavos / 100)
}

export function parseCurrency(value: string): number {
  const numeric = value.replace(/[^\d]/g, '')
  return parseInt(numeric, 10)
}
