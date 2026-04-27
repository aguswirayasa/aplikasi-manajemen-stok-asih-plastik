export function generateSkuString(productName: string, variationValues: string[]): string {
  const abbreviate = (str: string) => {
    const noVowels = str.replace(/[AEIOUaeiou\s-]/g, '').toUpperCase();
    if (noVowels.length >= 3) return noVowels.substring(0, 3);

    return str.replace(/[\s-]/g, '').substring(0, 3).toUpperCase();
  };

  const prodAbbr = abbreviate(productName);
  const valAbbrs = variationValues.map(abbreviate);
  
  return [prodAbbr, ...valAbbrs].join('-');
}
