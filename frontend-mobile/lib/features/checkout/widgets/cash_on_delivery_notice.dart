import 'package:flutter/material.dart';
import 'package:toko_mart/core/theme/theme_colors.dart';
import 'package:toko_mart/features/refunds/data/refund_models.dart';
import 'package:toko_mart/keys.dart';

/// Shown under Cash on Delivery at checkout: inspect the items before accepting the order and paying.
/// Same wording as the refund section of a delivered order.
class CashOnDeliveryNoticeCard extends StatelessWidget {
  const CashOnDeliveryNoticeCard({super.key});

  @override
  Widget build(BuildContext context) {
    final dark = context.isDark;
    const amber = Color(0xFFF59E0B);
    return Container(
      key: keys.orders.cashOnDeliveryNotice,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: dark ? amber.withAlpha(30) : const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: dark ? amber.withAlpha(90) : const Color(0xFFFDE68A)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.fact_check_outlined,
              size: 20,
              color: dark ? const Color(0xFFFCD34D) : const Color(0xFFB45309)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  cashOnDeliveryNoticeTitle,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: dark ? const Color(0xFFFCD34D) : const Color(0xFF92400E),
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  cashOnDeliveryNoRefundNotice,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: dark ? Colors.white70 : Colors.grey[800],
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
