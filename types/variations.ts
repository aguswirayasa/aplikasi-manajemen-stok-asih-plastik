export type VariationValue = {
  id: string;
  value: string;
  variationTypeId: string;
  _count?: { productVariantValues: number };
};

export type VariationType = {
  id: string;
  name: string;
  values: VariationValue[];
  _count?: { values: number; productVariationTypes: number };
};
