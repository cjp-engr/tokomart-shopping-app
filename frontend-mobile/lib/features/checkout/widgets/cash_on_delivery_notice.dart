import 'package:flutter/material.dart';
import 'package:toko_mart/features/refunds/data/refund_models.dart';
import 'package:toko_mart/keys.dart';

/// Shown under Cash on Delivery at checkout: inspect the items before accepting the order and paying.
/// Same wording as the refund section of a delivered order.
class CashOnDeliveryNoticeCard extends StatelessWidget {
  const CashOnDeliveryNoticeCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      key: keys.orders.cashOnDeliveryNotice,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.fact_check_outlined,
              size: 20, color: Color(0xFFB45309)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  cashOnDeliveryNoticeTitle,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF92400E),
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  cashOnDeliveryNoRefundNotice,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.grey[800],
                        height: 1.4,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
