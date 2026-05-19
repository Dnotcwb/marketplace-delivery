/**
 * Converte um texto qualquer em slug URL-friendly.
 * Exemplo: "Horta do João" → "horta-do-joao"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove diacríticos (á→a, ç→c, etc.)
    .replace(/[^a-z0-9\s-]/g, '')      // remove caracteres especiais
    .trim()
    .replace(/\s+/g, '-')              // espaços → hífens
    .replace(/-+/g, '-')               // múltiplos hífens → um
}

/**
 * Garante que o slug seja único adicionando um sufixo numérico se necessário.
 * Útil quando se sabe de antemão que um slug já existe.
 */
export function uniqueSlug(base: string, existingSlugs: string[]): string {
  const root = slugify(base)
  if (!existingSlugs.includes(root)) return root

  let counter = 2
  while (existingSlugs.includes(`${root}-${counter}`)) {
    counter++
  }
  return `${root}-${counter}`
}
