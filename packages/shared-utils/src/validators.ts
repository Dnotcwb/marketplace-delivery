export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false
  const calc = (mod: number) => {
    const sum = digits
      .slice(0, mod - 1)
      .split('')
      .reduce((acc, d, i) => acc + parseInt(d) * (mod - i), 0)
    const rem = (sum * 10) % 11
    return rem === 10 || rem === 11 ? 0 : rem
  }
  return calc(10) === parseInt(digits[9]!) && calc(11) === parseInt(digits[10]!)
}

export function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false
  const calc = (weights: number[]) =>
    weights.reduce((acc, w, i) => acc + parseInt(digits[i]!) * w, 0)
  const mod = (n: number) => {
    const rem = n % 11
    return rem < 2 ? 0 : 11 - rem
  }
  const d1 = mod(calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
  const d2 = mod(calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
  return d1 === parseInt(digits[12]!) && d2 === parseInt(digits[13]!)
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 || digits.length === 11
}
