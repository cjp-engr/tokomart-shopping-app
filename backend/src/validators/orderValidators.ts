import { body } from 'express-validator';

const isPlainObject = (value: unknown) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isFilledText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

// The Order model requires these four fields; `country` is optional and defaults to PH. Checking them here
// refuses a bad address before any stock is taken (Open question 19).
const requiredAddressFields = ['street', 'city', 'state', 'zipCode'] as const;

export const createOrderRules = [
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('items.*.productId').notEmpty().withMessage('Each item must have a productId'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('shippingAddress').custom(isPlainObject).withMessage('Shipping address is required'),
  ...requiredAddressFields.map(field =>
    body(`shippingAddress.${field}`)
      .if(body('shippingAddress').custom(isPlainObject))
      .custom(isFilledText)
      .withMessage(`Shipping address ${field} is required`)),
  body('paymentMethod').notEmpty().withMessage('Payment method is required'),
];
