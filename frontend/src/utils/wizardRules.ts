/** The part of the seller wizard's form that its step checks read. */
export interface WizardStepData {
  name: string;
  category: string;
  description: string;
  hasVariants: boolean;
  variantAttributes: Array<{ name: string; values: string[] }>;
  price: string;
  stock: string;
  imageMode: 'upload' | 'url';
  imageUrl: string;
  shippingOptions: string[];
  shippingFee: string;
  shippingFeeAmounts: Record<string, string>;
}

/**
 * What stops the seller from moving on from a wizard step, or null when the step is fine (REQ-SEL-01, REQ-SEL-06).
 * The server checks the same fields again when the product is saved.
 */
export function validateWizardStep(
  step: number,
  data: WizardStepData,
  images: { fileCount: number; existingUrlCount: number },
): string | null {
  if (step === 1) {
    if (!data.name.trim()) return 'Product name is required.';
    if (!data.category) return 'Category is required.';
  }
  if (step === 2) {
    if (data.hasVariants) {
      const valid = data.variantAttributes.filter(a => a.name.trim() && a.values.length > 0);
      if (valid.length === 0) return 'Add at least one attribute with values, or disable variants.';
    } else {
      if (!data.price || Number(data.price) <= 0) return 'Price must be greater than 0.';
      if (data.stock === '' || Number(data.stock) < 0) return 'Stock quantity is required.';
    }
  }
  if (step === 3) {
    if (!data.description.trim()) return 'Description is required.';
  }
  if (step === 4) {
    const ok = data.imageMode === 'url'
      ? !!data.imageUrl.trim()
      : images.fileCount > 0 || images.existingUrlCount > 0;
    if (!ok) return 'Please add at least one product image.';
  }
  if (step === 5) {
    if (data.shippingOptions.length === 0) return 'Please select at least one delivery option.';
    if (!data.shippingFee) return 'Please select a shipping fee option.';
    if (data.shippingFee === 'buyer_pays') {
      for (const opt of data.shippingOptions) {
        const val = (data.shippingFeeAmounts[opt] ?? '').trim();
        if (!val) return 'Enter a shipping fee amount for each selected delivery option.';
        if (isNaN(Number(val))) return 'Enter a valid fee amount for each delivery option.';
      }
    }
  }
  return null;
}
